import random
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.exam import (
    AttemptAnswer,
    AttemptStatus,
    Exam,
    ExamAssignment,
    ExamAttempt,
    ExamQuestion,
    ExamStatus,
)
from app.models.question import Question, QuestionOption, QuestionStatus
from app.models.user import User, UserRole
from app.schemas.exam import (
    AnswerSubmitInput,
    ExamAttemptResultResponse,
    ExamCreateInput,
    ExamReportResponse,
    ExamUpdateInput,
    StudentAttemptReport,
    StudentExamTakeResponse,
    StudentOptionTakeResponse,
    StudentQuestionTakeResponse,
    TeacherExamsSummaryItem,
    QuestionAnalyticsItem,
)
from app.services.reward_service import RewardService



def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Helper ensuring datetime is offset-aware UTC for robust comparisons across DB drivers."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def create_exam(
    db: Session,
    exam_in: ExamCreateInput,
    user_id: int,
) -> Exam:
    """Create a new exam with selected questions and configuration."""
    if exam_in.grade < 4 or exam_in.grade > 9:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hệ thống chỉ hỗ trợ tạo đề thi cho khối lớp từ 4 đến 9",
        )

    db_exam = Exam(
        title=exam_in.title.strip(),
        description=exam_in.description.strip() if exam_in.description else None,
        subject=exam_in.subject.strip(),
        grade=exam_in.grade,
        duration_minutes=exam_in.duration_minutes,
        total_points=exam_in.total_points,
        passing_score=exam_in.passing_score,
        shuffle_questions=exam_in.shuffle_questions,
        shuffle_options=exam_in.shuffle_options,
        start_time=exam_in.start_time,
        end_time=exam_in.end_time,
        status=ExamStatus.DRAFT,
        created_by_id=user_id,
    )
    db.add(db_exam)
    db.flush()

    if exam_in.question_ids:
        # Fetch approved questions
        questions = (
            db.query(Question)
            .filter(
                Question.id.in_(exam_in.question_ids),
                Question.status == QuestionStatus.APPROVED,
            )
            .all()
        )
        if len(questions) != len(exam_in.question_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Chỉ những câu hỏi ĐÃ DUYỆT (APPROVED) mới được đưa vào đề thi chính thức",
            )

        q_count = len(questions)
        pts_per_question = round(exam_in.total_points / q_count, 2) if q_count > 0 else 1.0

        for idx, q_id in enumerate(exam_in.question_ids):
            eq = ExamQuestion(
                exam_id=db_exam.id,
                question_id=q_id,
                order_index=idx,
                points=pts_per_question,
            )
            db.add(eq)

        db_exam.total_questions = q_count

    # Optional assignments
    if exam_in.assigned_student_ids:
        for s_id in exam_in.assigned_student_ids:
            db.add(ExamAssignment(exam_id=db_exam.id, assigned_to_user_id=s_id))
    elif exam_in.assigned_grade:
        db.add(ExamAssignment(exam_id=db_exam.id, assigned_grade=exam_in.assigned_grade))

    db.commit()
    db.refresh(db_exam)
    return db_exam


def get_exam(db: Session, exam_id: int) -> Exam:
    """Retrieve single exam by ID."""
    exam = (
        db.query(Exam)
        .options(
            joinedload(Exam.exam_questions).joinedload(ExamQuestion.question).joinedload(Question.options)
        )
        .filter(Exam.id == exam_id)
        .first()
    )
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đề thi với ID {exam_id}",
        )
    return exam


from sqlalchemy import or_
from sqlalchemy.orm import aliased, joinedload

def get_exams(
    db: Session,
    subject: Optional[str] = None,
    grade: Optional[int] = None,
    status_filter: Optional[ExamStatus] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: Optional[User] = None,
) -> Tuple[List[Exam], int]:
    """
    List exams with role-based scoping & pagination:
    - ADMIN: Sees all exams across the system with creator metadata.
    - TEACHER: Only sees exams created by themselves.
    - STUDENT: Sees official teacher/admin published exams + their own AI practice exams (hides other students' AI practice exams).
    """
    query = db.query(Exam).options(joinedload(Exam.created_by))

    # Apply Role Scoping Rules
    if current_user:
        if current_user.role == UserRole.TEACHER:
            # Teacher only sees their own created exams
            query = query.filter(Exam.created_by_id == current_user.id)
        elif current_user.role == UserRole.STUDENT:
            # Student sees official teacher/admin exams OR their own practice exams
            Creator = aliased(User)
            query = query.outerjoin(Creator, Exam.created_by_id == Creator.id).filter(
                or_(
                    Exam.created_by_id == current_user.id,
                    Creator.role != UserRole.STUDENT,
                    Exam.created_by_id.is_(None),
                )
            )

    if subject:
        query = query.filter(Exam.subject.ilike(f"%{subject.strip()}%"))
    if grade is not None:
        query = query.filter(Exam.grade == grade)
    if status_filter is not None:
        query = query.filter(Exam.status == status_filter)

    total = query.count()
    items = (
        query.order_by(Exam.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # Attach creator metadata to each exam model instance for ExamResponse serialization
    for exam in items:
        if exam.created_by:
            exam.created_by_name = exam.created_by.full_name
            exam.created_by_role = exam.created_by.role.value if hasattr(exam.created_by.role, "value") else str(exam.created_by.role)

    return items, total


def update_exam(
    db: Session,
    exam_id: int,
    exam_in: ExamUpdateInput,
    user: User,
) -> Exam:
    """Update exam configuration and question set."""
    exam = get_exam(db, exam_id)
    if user.role != UserRole.ADMIN and exam.created_by_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền chỉnh sửa đề thi này",
        )

    update_data = exam_in.model_dump(exclude_unset=True)
    q_ids = update_data.pop("question_ids", None)

    for field, val in update_data.items():
        setattr(exam, field, val)

    if q_ids is not None:
        db.query(ExamQuestion).filter(ExamQuestion.exam_id == exam.id).delete()
        questions = (
            db.query(Question)
            .filter(
                Question.id.in_(q_ids),
                Question.status == QuestionStatus.APPROVED,
            )
            .all()
        )
        q_count = len(questions)
        pts_per_question = round(exam.total_points / q_count, 2) if q_count > 0 else 1.0

        for idx, q_id in enumerate(q_ids):
            db.add(
                ExamQuestion(
                    exam_id=exam.id,
                    question_id=q_id,
                    order_index=idx,
                    points=pts_per_question,
                )
            )
        exam.total_questions = q_count

    db.commit()
    db.refresh(exam)
    return exam


def publish_exam(db: Session, exam_id: int, user: User) -> Exam:
    """Publish exam so students can take it."""
    exam = get_exam(db, exam_id)
    if exam.total_questions == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Đề thi chưa có câu hỏi nào. Vui lòng thêm câu hỏi trước khi xuất bản",
        )
    exam.status = ExamStatus.PUBLISHED
    db.commit()
    db.refresh(exam)
    return exam


# --- STUDENT EXAM ENGINE & SECURITY LOGIC ---

def start_exam_attempt(
    db: Session,
    exam_id: int,
    student: User,
) -> ExamAttempt:
    """
    Start a student attempt for an exam.
    Calculates server-authoritative started_at and deadline_at.
    """
    exam = get_exam(db, exam_id)
    if exam.status != ExamStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Đề thi này chưa được xuất bản hoặc đã đóng",
        )

    now = _ensure_utc(datetime.now(timezone.utc))
    st = _ensure_utc(exam.start_time)
    et = _ensure_utc(exam.end_time)

    if st and now < st:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chưa đến thời gian bắt đầu mở đề thi",
        )
    if et and now > et:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Đã hết thời hạn làm bài đề thi này",
        )

    # Check for existing IN_PROGRESS attempt
    existing_attempt = (
        db.query(ExamAttempt)
        .filter(
            ExamAttempt.exam_id == exam.id,
            ExamAttempt.student_id == student.id,
            ExamAttempt.status == AttemptStatus.IN_PROGRESS,
        )
        .first()
    )
    if existing_attempt:
        existing_deadline = _ensure_utc(existing_attempt.deadline_at)
        if now >= existing_deadline:
            _auto_submit_attempt(db, existing_attempt)
        else:
            return existing_attempt

    # Create new attempt with server-authoritative timer
    started_at = now
    deadline_at = started_at + timedelta(minutes=exam.duration_minutes)

    attempt = ExamAttempt(
        exam_id=exam.id,
        student_id=student.id,
        status=AttemptStatus.IN_PROGRESS,
        started_at=started_at,
        deadline_at=deadline_at,
        total_count=exam.total_questions,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


def get_student_attempt_room(
    db: Session,
    attempt_id: int,
    student: User,
) -> StudentExamTakeResponse:
    """
    Get student attempt data with SECURITY EXAM MASKING:
    Correct options (is_correct) and explanations are COMPLETELY MASKED from the response payload.
    """
    attempt = (
        db.query(ExamAttempt)
        .filter(ExamAttempt.id == attempt_id)
        .first()
    )
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy lượt làm bài này",
        )

    if attempt.student_id != student.id and student.role.value == "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập lượt thi của người khác",
        )

    now = _ensure_utc(datetime.now(timezone.utc))
    deadline = _ensure_utc(attempt.deadline_at)

    # Server-Authoritative Timer expiration check
    if attempt.status == AttemptStatus.IN_PROGRESS and now >= deadline:
        _auto_submit_attempt(db, attempt)

    exam = get_exam(db, attempt.exam_id)

    # Fetch saved answers
    answers_rows = (
        db.query(AttemptAnswer)
        .filter(AttemptAnswer.attempt_id == attempt.id)
        .all()
    )
    saved_answers = {a.question_id: a.selected_option_key for a in answers_rows if a.selected_option_key}

    # Build masked question objects for student
    masked_questions: List[StudentQuestionTakeResponse] = []
    eq_list = list(exam.exam_questions)

    # Deterministic or random shuffle based on attempt ID seed
    if exam.shuffle_questions:
        rnd = random.Random(attempt.id)
        rnd.shuffle(eq_list)

    for idx, eq in enumerate(eq_list):
        q = eq.question
        options_list = list(q.options)
        if exam.shuffle_options:
            rnd_opt = random.Random(attempt.id + q.id)
            rnd_opt.shuffle(options_list)

        # MASKED OPTIONS: Only option_key, content, order_index (is_correct OMITTED!)
        masked_options = [
            StudentOptionTakeResponse(
                option_key=opt.option_key,
                content=opt.content,
                order_index=opt.order_index,
            )
            for opt in options_list
        ]

        # MASKED QUESTION: explanation & learning_objective OMITTED!
        masked_q = StudentQuestionTakeResponse(
            id=q.id,
            content=q.content,
            question_type=q.question_type,
            difficulty=q.difficulty,
            subject=q.subject,
            grade=q.grade,
            order_index=idx,
            points=eq.points,
            options=masked_options,
        )
        masked_questions.append(masked_q)

    remaining_sec = max(0, int((deadline - now).total_seconds()))

    return StudentExamTakeResponse(
        attempt_id=attempt.id,
        exam_id=exam.id,
        title=exam.title,
        subject=exam.subject,
        grade=exam.grade,
        duration_minutes=exam.duration_minutes,
        started_at=_ensure_utc(attempt.started_at),
        deadline_at=deadline,
        remaining_seconds=remaining_sec,
        status=attempt.status,
        questions=masked_questions,
        saved_answers=saved_answers,
    )


def autosave_answer(
    db: Session,
    attempt_id: int,
    answer_in: AnswerSubmitInput,
    student: User,
) -> AttemptAnswer:
    """
    Autosave answer for a specific question during an active exam attempt.
    Enforces Server-Authoritative Timer.
    """
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy lượt thi",
        )

    if attempt.student_id != student.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thực hiện trên lượt thi này",
        )

    now = _ensure_utc(datetime.now(timezone.utc))
    deadline = _ensure_utc(attempt.deadline_at)

    if attempt.status != AttemptStatus.IN_PROGRESS or now >= deadline:
        if attempt.status == AttemptStatus.IN_PROGRESS:
            _auto_submit_attempt(db, attempt)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thời gian làm bài đã kết thúc. Bài thi đã được tự động nộp.",
        )

    # Upsert attempt answer
    ans_obj = (
        db.query(AttemptAnswer)
        .filter(
            AttemptAnswer.attempt_id == attempt.id,
            AttemptAnswer.question_id == answer_in.question_id,
        )
        .first()
    )
    if not ans_obj:
        ans_obj = AttemptAnswer(
            attempt_id=attempt.id,
            question_id=answer_in.question_id,
            selected_option_key=answer_in.selected_option_key,
        )
        db.add(ans_obj)
    else:
        ans_obj.selected_option_key = answer_in.selected_option_key

    db.commit()
    db.refresh(ans_obj)
    return ans_obj


def submit_exam_attempt(
    db: Session,
    attempt_id: int,
    student: User,
) -> ExamAttemptResultResponse:
    """
    Submit exam attempt and calculate final grades on the backend.
    """
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy lượt thi",
        )

    if attempt.student_id != student.id and student.role.value == "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền nộp bài lượt thi này",
        )

    if attempt.status != AttemptStatus.IN_PROGRESS:
        # Return existing result if already submitted
        return get_attempt_result(db, attempt.id, student)

    return _auto_submit_attempt(db, attempt)


def _auto_submit_attempt(db: Session, attempt: ExamAttempt) -> ExamAttemptResultResponse:
    """Internal function to grade attempt and finalize status."""
    now = _ensure_utc(datetime.now(timezone.utc))
    deadline = _ensure_utc(attempt.deadline_at)
    is_timed_out = now >= deadline

    exam = get_exam(db, attempt.exam_id)

    # Fetch all answers saved by student
    saved_answers = (
        db.query(AttemptAnswer)
        .filter(AttemptAnswer.attempt_id == attempt.id)
        .all()
    )
    ans_map = {a.question_id: a for a in saved_answers}

    total_correct = 0
    total_score = 0.0

    detailed_answers = []

    for eq in exam.exam_questions:
        q = eq.question
        ans_obj = ans_map.get(q.id)

        selected_key = ans_obj.selected_option_key if ans_obj else None

        # Find correct option
        correct_opt = next((opt for opt in q.options if opt.is_correct), None)
        correct_key = correct_opt.option_key if correct_opt else None

        is_correct = (selected_key is not None) and (selected_key == correct_key)
        points_earned = eq.points if is_correct else 0.0

        if is_correct:
            total_correct += 1
            total_score += points_earned

        if ans_obj:
            ans_obj.is_correct = is_correct
            ans_obj.points_earned = points_earned
        else:
            db.add(
                AttemptAnswer(
                    attempt_id=attempt.id,
                    question_id=q.id,
                    selected_option_key=None,
                    is_correct=False,
                    points_earned=0.0,
                )
            )

        detailed_answers.append({
            "question_id": q.id,
            "question_text": q.content,
            "selected_option_key": selected_key,
            "correct_option_key": correct_key,
            "is_correct": is_correct,
            "points_earned": points_earned,
            "explanation": q.explanation,
            "options": [
                {
                    "option_key": opt.option_key,
                    "content": opt.content,
                    "is_correct": opt.is_correct,
                }
                for opt in q.options
            ],
        })

    # Finalize attempt stats
    attempt.status = AttemptStatus.TIMED_OUT if is_timed_out else AttemptStatus.SUBMITTED
    attempt.submitted_at = now
    attempt.score = round(total_score, 2)
    attempt.percentage = round((total_score / exam.total_points) * 100, 2) if exam.total_points > 0 else 0.0
    attempt.correct_count = total_correct
    attempt.total_count = exam.total_questions

    db.commit()

    # Award diamonds based on exam score (>9.0 => 2 diamonds, <9.0 => 1 diamond, based on best score rules)
    reward_res = RewardService.award_exam_diamonds(
        db, attempt.student_id, exam.id, attempt.score, attempt.id
    )
    diamonds_awarded = reward_res.get("awarded", 0)

    return ExamAttemptResultResponse(
        attempt_id=attempt.id,
        exam_id=exam.id,
        exam_title=exam.title,
        status=attempt.status,
        score=attempt.score,
        percentage=attempt.percentage,
        correct_count=attempt.correct_count,
        total_count=attempt.total_count,
        passing_score=exam.passing_score,
        is_passed=attempt.score >= exam.passing_score,
        diamonds_awarded=diamonds_awarded,
        started_at=_ensure_utc(attempt.started_at),
        submitted_at=_ensure_utc(attempt.submitted_at),
        detailed_answers=detailed_answers,
    )


def get_attempt_result(db: Session, attempt_id: int, user: User) -> ExamAttemptResultResponse:
    """Get exam attempt result with detailed answers after completion."""
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy lượt thi",
        )

    if attempt.student_id != user.id and user.role.value == "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xem kết quả bài thi này",
        )

    exam = get_exam(db, attempt.exam_id)

    answers = (
        db.query(AttemptAnswer)
        .filter(AttemptAnswer.attempt_id == attempt.id)
        .all()
    )
    ans_map = {a.question_id: a for a in answers}

    detailed_answers = []
    for eq in exam.exam_questions:
        q = eq.question
        ans_obj = ans_map.get(q.id)
        selected_key = ans_obj.selected_option_key if ans_obj else None
        correct_opt = next((opt for opt in q.options if opt.is_correct), None)
        correct_key = correct_opt.option_key if correct_opt else None

        is_corr = ans_obj.is_correct if ans_obj else False
        pts = ans_obj.points_earned if ans_obj else 0.0

        detailed_answers.append({
            "question_id": q.id,
            "question_text": q.content,
            "selected_option_key": selected_key,
            "correct_option_key": correct_key,
            "is_correct": is_corr,
            "points_earned": pts,
            "explanation": q.explanation,
            "options": [
                {
                    "option_key": opt.option_key,
                    "content": opt.content,
                    "is_correct": opt.is_correct,
                }
                for opt in q.options
            ],
        })

    return ExamAttemptResultResponse(
        attempt_id=attempt.id,
        exam_id=exam.id,
        exam_title=exam.title,
        status=attempt.status,
        score=attempt.score or 0.0,
        percentage=attempt.percentage or 0.0,
        correct_count=attempt.correct_count,
        total_count=attempt.total_count,
        passing_score=exam.passing_score,
        is_passed=(attempt.score or 0.0) >= exam.passing_score,
        started_at=_ensure_utc(attempt.started_at),
        submitted_at=_ensure_utc(attempt.submitted_at),
        detailed_answers=detailed_answers,
    )


def get_student_attempts(db: Session, student: User) -> List[ExamAttemptResultResponse]:
    """Get all exam attempts for the current student."""
    attempts = (
        db.query(ExamAttempt)
        .filter(ExamAttempt.student_id == student.id)
        .order_by(ExamAttempt.started_at.desc())
        .all()
    )
    results = []
    for att in attempts:
        if att.status in [AttemptStatus.SUBMITTED, AttemptStatus.TIMED_OUT]:
            results.append(get_attempt_result(db=db, attempt_id=att.id, user=student))
        else:
            exam = att.exam
            results.append(
                ExamAttemptResultResponse(
                    attempt_id=att.id,
                    exam_id=att.exam_id,
                    exam_title=exam.title if exam else "",
                    status=att.status,
                    score=att.score or 0.0,
                    percentage=att.percentage or 0.0,
                    correct_count=att.correct_count or 0,
                    total_count=att.total_count or 0,
                    passing_score=exam.passing_score if exam else 5.0,
                    is_passed=(att.score or 0.0) >= (exam.passing_score if exam else 5.0),
                    started_at=_ensure_utc(att.started_at),
                    submitted_at=_ensure_utc(att.submitted_at),
                    detailed_answers=[],
                )
            )
    return results


def get_exam_report(db: Session, exam_id: int, user: User) -> ExamReportResponse:
    """
    Get detailed student attempts report for a specific exam.
    Available to Teachers and Admins.
    """
    exam = get_exam(db, exam_id)

    # Fetch attempts with student info
    attempts = (
        db.query(ExamAttempt)
        .options(joinedload(ExamAttempt.student))
        .filter(ExamAttempt.exam_id == exam.id)
        .order_by(ExamAttempt.started_at.desc())
        .all()
    )

    total_attempts = len(attempts)
    submitted_attempts = [
        att for att in attempts if att.status in [AttemptStatus.SUBMITTED, AttemptStatus.TIMED_OUT]
    ]
    submitted_count = len(submitted_attempts)

    if submitted_count > 0:
        scores = [att.score or 0.0 for att in submitted_attempts]
        avg_score = round(sum(scores) / len(scores), 2)
        highest_score = round(max(scores), 2)
        lowest_score = round(min(scores), 2)
    else:
        avg_score = 0.0
        highest_score = 0.0
        lowest_score = 0.0

    pass_attempts = [
        att for att in submitted_attempts if (att.score or 0.0) >= exam.passing_score
    ]
    pass_count = len(pass_attempts)
    pass_rate = round((pass_count / total_attempts * 100.0), 1) if total_attempts > 0 else 0.0

    student_reports = []
    for att in attempts:
        student = att.student
        dt_answers = []
        if att.status in [AttemptStatus.SUBMITTED, AttemptStatus.TIMED_OUT]:
            try:
                res_obj = get_attempt_result(db, att.id, user)
                dt_answers = res_obj.detailed_answers
            except Exception:
                dt_answers = []

        student_reports.append(
            StudentAttemptReport(
                attempt_id=att.id,
                student_id=att.student_id,
                student_name=student.full_name if student else f"Học sinh #{att.student_id}",
                student_email=student.email if student else "",
                status=att.status,
                score=round(att.score or 0.0, 2),
                percentage=round(att.percentage or 0.0, 1),
                correct_count=att.correct_count or 0,
                total_count=att.total_count or 0,
                is_passed=(att.score or 0.0) >= exam.passing_score if att.status in [AttemptStatus.SUBMITTED, AttemptStatus.TIMED_OUT] else False,
                started_at=_ensure_utc(att.started_at),
                submitted_at=_ensure_utc(att.submitted_at),
                detailed_answers=dt_answers,
            )
        )

    # Compute question analytics (accuracy rate & option distribution A/B/C/D)
    question_analytics_items = []
    for eq in exam.exam_questions:
        q = eq.question
        q_correct = 0
        q_wrong = 0
        dist = {"A": 0, "B": 0, "C": 0, "D": 0}

        for s_rep in student_reports:
            for dt in s_rep.detailed_answers:
                if dt.get("question_id") == q.id:
                    sel_k = dt.get("selected_option_key")
                    if sel_k in dist:
                        dist[sel_k] += 1
                    if dt.get("is_correct"):
                        q_correct += 1
                    else:
                        q_wrong += 1

        tot_ans = q_correct + q_wrong
        acc = round((q_correct / tot_ans * 100.0), 1) if tot_ans > 0 else 0.0

        question_analytics_items.append(
            QuestionAnalyticsItem(
                question_id=q.id,
                question_text=q.content,
                correct_count=q_correct,
                wrong_count=q_wrong,
                accuracy_rate=acc,
                option_distribution=dist,
            )
        )

    return ExamReportResponse(
        exam_id=exam.id,
        exam_title=exam.title,
        subject=exam.subject,
        grade=exam.grade,
        duration_minutes=exam.duration_minutes,
        passing_score=exam.passing_score,
        total_points=exam.total_points,
        total_questions=exam.total_questions,
        total_attempts=total_attempts,
        submitted_count=submitted_count,
        avg_score=avg_score,
        pass_count=pass_count,
        pass_rate=pass_rate,
        highest_score=highest_score,
        lowest_score=lowest_score,
        student_attempts=student_reports,
        question_analytics=question_analytics_items,
    )



def get_teacher_exams_summary(db: Session, user: User) -> List[TeacherExamsSummaryItem]:
    """
    Get high-level summary of exam attempts for all exams created by teacher/admin.
    """
    query = db.query(Exam)
    if user.role.value == "TEACHER":
        query = query.filter(Exam.created_by_id == user.id)
    exams = query.order_by(Exam.created_at.desc()).all()

    summary_items = []
    for exam in exams:
        attempts = (
            db.query(ExamAttempt)
            .filter(ExamAttempt.exam_id == exam.id)
            .all()
        )
        total_attempts = len(attempts)
        submitted = [a for a in attempts if a.status in [AttemptStatus.SUBMITTED, AttemptStatus.TIMED_OUT]]
        submitted_count = len(submitted)
        if submitted_count > 0:
            scores = [a.score or 0.0 for a in submitted]
            avg_score = round(sum(scores) / len(scores), 2)
            passed = [a for a in submitted if (a.score or 0.0) >= exam.passing_score]
            pass_rate = round((len(passed) / total_attempts * 100.0), 1) if total_attempts > 0 else 0.0
        else:
            avg_score = 0.0
            pass_rate = 0.0

        summary_items.append(
            TeacherExamsSummaryItem(
                exam_id=exam.id,
                title=exam.title,
                subject=exam.subject,
                grade=exam.grade,
                status=exam.status,
                created_at=_ensure_utc(exam.created_at),
                total_attempts=total_attempts,
                submitted_count=submitted_count,
                avg_score=avg_score,
                pass_rate=pass_rate,
            )
        )
    return summary_items

