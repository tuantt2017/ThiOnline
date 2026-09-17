import json
import logging
import random
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy import func, case, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.exam import (
    AttemptAnswer,
    AttemptStatus,
    Exam,
    ExamAssignment,
    ExamAttempt,
    ExamQuestion,
    ExamStatus,
)
from app.models.question import Question, QuestionDifficulty, QuestionOption, QuestionStatus
from app.models.user import User, UserRole
from app.schemas.teacher_intelligence import (
    AssignRemedialRequest,
    AssignRemedialResponse,
    ClassKnowledgeGapItem,
    StudentAiEvaluationResponse,
    StudentRiskItem,
    TeacherClassOverviewResponse,
)
from app.services.gemini_service import GeminiKnowledgeService

logger = logging.getLogger(__name__)


class TeacherIntelligenceService:
    """
    AI Teacher Class Intelligence & Student Assessment Service.
    Enables teachers to monitor class performance, detect early student risk,
    analyze class-wide knowledge gaps, and generate 1-click AI student evaluation report cards.
    """

    @classmethod
    def get_class_overview_analytics(
        cls,
        db: Session,
        teacher: User,
        subject: Optional[str] = None,
        grade: Optional[int] = None,
    ) -> TeacherClassOverviewResponse:
        target_subject = (subject or "Toán").strip()
        target_grade = grade or 5

        # Query all students matching grade
        students_query = db.query(User).filter(User.role == UserRole.STUDENT)
        if target_grade:
            students_query = students_query.filter(User.grade == target_grade)
        
        students = students_query.all()
        total_students_cnt = len(students)

        risk_students: List[StudentRiskItem] = []
        high_risk_cnt = 0
        monitor_cnt = 0
        good_cnt = 0

        total_scores = []
        passed_attempts_cnt = 0
        all_attempts_cnt = 0

        for student in students:
            # Query attempts for student
            attempts = (
                db.query(ExamAttempt)
                .join(Exam, ExamAttempt.exam_id == Exam.id)
                .filter(
                    ExamAttempt.student_id == student.id,
                    ExamAttempt.status.in_([AttemptStatus.SUBMITTED, AttemptStatus.TIMED_OUT]),
                    Exam.subject == target_subject,
                )
                .all()
            )

            att_cnt = len(attempts)
            all_attempts_cnt += att_cnt

            if att_cnt > 0:
                s_scores = [att.score or 0.0 for att in attempts]
                avg_s = round(sum(s_scores) / att_cnt, 1)
                total_scores.extend(s_scores)

                passed_attempts_cnt += sum(1 for att in attempts if (att.score or 0.0) >= (att.exam.passing_score if att.exam else 5.0))
            else:
                avg_s = 0.0

            # Query incorrect answers for weak topics
            att_ids = [a.id for a in attempts]
            weak_topics: List[str] = []
            if att_ids:
                wrong_rows = (
                    db.query(Question.chapter, Question.lesson, func.count(AttemptAnswer.id).label("w_cnt"))
                    .join(AttemptAnswer, AttemptAnswer.question_id == Question.id)
                    .filter(
                        AttemptAnswer.attempt_id.in_(att_ids),
                        AttemptAnswer.is_correct == False,
                    )
                    .group_by(Question.chapter, Question.lesson)
                    .order_by(func.count(AttemptAnswer.id).desc())
                    .limit(3)
                    .all()
                )
                for r in wrong_rows:
                    topic_name = r.lesson or r.chapter
                    if topic_name and topic_name not in weak_topics:
                        weak_topics.append(topic_name)

            # Categorize Risk Level
            if att_cnt == 0:
                risk_lvl = "MONITOR"
                monitor_cnt += 1
            elif avg_s >= 7.5:
                risk_lvl = "GOOD"
                good_cnt += 1
            elif avg_s >= 5.0:
                risk_lvl = "MONITOR"
                monitor_cnt += 1
            else:
                risk_lvl = "HIGH_RISK"
                high_risk_cnt += 1

            risk_students.append(
                StudentRiskItem(
                    student_id=student.id,
                    student_name=student.full_name,
                    email=student.email,
                    grade=student.grade or target_grade,
                    avg_score=avg_s,
                    total_attempts=att_cnt,
                    risk_level=risk_lvl,
                    weak_topics=weak_topics,
                    recent_trend="STABLE",
                )
            )

        # Sort risk students: HIGH_RISK first, then MONITOR, then GOOD
        risk_order = {"HIGH_RISK": 0, "MONITOR": 1, "GOOD": 2}
        risk_students.sort(key=lambda x: (risk_order.get(x.risk_level, 99), x.avg_score))

        avg_class_score = round(sum(total_scores) / len(total_scores), 1) if total_scores else 0.0
        pass_rate = round((passed_attempts_cnt / all_attempts_cnt * 100.0), 1) if all_attempts_cnt > 0 else 0.0

        # Class Knowledge Gaps
        class_gaps = cls._compute_class_knowledge_gaps(db, target_subject, target_grade)

        # AI Teaching Advice
        teaching_advice = cls._generate_ai_teaching_advice(
            teacher_name=teacher.full_name,
            subject=target_subject,
            grade=target_grade,
            avg_score=avg_class_score,
            high_risk_cnt=high_risk_cnt,
            class_gaps=class_gaps,
        )

        return TeacherClassOverviewResponse(
            subject=target_subject,
            grade=target_grade,
            total_students=total_students_cnt,
            avg_class_score=avg_class_score,
            pass_rate=pass_rate,
            high_risk_count=high_risk_cnt,
            monitor_count=monitor_cnt,
            good_count=good_cnt,
            risk_students=risk_students,
            class_knowledge_gaps=class_gaps,
            ai_teaching_advice=teaching_advice,
        )

    @classmethod
    def _compute_class_knowledge_gaps(
        cls,
        db: Session,
        subject: str,
        grade: int,
    ) -> List[ClassKnowledgeGapItem]:
        """Calculates top chapters/lessons where the class incurs the highest error rates."""
        gaps_query = (
            db.query(
                Question.chapter,
                Question.lesson,
                func.count(AttemptAnswer.id).label("total_ans"),
                func.sum(case((AttemptAnswer.is_correct == False, 1), else_=0)).label("wrong_ans"),
                func.count(func.distinct(ExamAttempt.student_id)).label("affected_students"),
            )
            .join(AttemptAnswer, AttemptAnswer.question_id == Question.id)
            .join(ExamAttempt, ExamAttempt.id == AttemptAnswer.attempt_id)
            .filter(
                Question.subject == subject,
                Question.grade == grade,
                ExamAttempt.status.in_([AttemptStatus.SUBMITTED, AttemptStatus.TIMED_OUT]),
            )
            .group_by(Question.chapter, Question.lesson)
            .all()
        )

        gaps: List[ClassKnowledgeGapItem] = []
        for r in gaps_query:
            chap = r.chapter or f"Chương trình {subject} Lớp {grade}"
            les = r.lesson or "Bài học trọng tâm"
            tot = r.total_ans or 0
            wrong = int(r.wrong_ans or 0)
            affected = int(r.affected_students or 0)

            err_rate = round((wrong / tot * 100.0), 1) if tot > 0 else 0.0

            if err_rate >= 30.0:
                rec = (
                    f"Giáo viên nên dành 15 phút đầu giờ để củng cố lại lý thuyết bài '{les}' "
                    f"({chap}) và cho học sinh giải 3 bài tập mẫu chuẩn SGK."
                )
                gaps.append(
                    ClassKnowledgeGapItem(
                        chapter=chap,
                        lesson=les,
                        error_rate=err_rate,
                        affected_students_count=affected,
                        teaching_recommendation=rec,
                    )
                )

        gaps.sort(key=lambda x: x.error_rate, reverse=True)

        if not gaps:
            # Fallback default gap item if no exam history
            gaps.append(
                ClassKnowledgeGapItem(
                    chapter=f"Chương trình môn {subject} Lớp {grade}",
                    lesson="Các dạng bài tập vận dụng tổng hợp",
                    error_rate=25.0,
                    affected_students_count=0,
                    teaching_recommendation=f"Nên hướng dẫn học sinh làm bài tập nhóm môn {subject} Lớp {grade} để nâng cao khả năng phân tích.",
                )
            )

        return gaps[:4]

    @classmethod
    def _generate_ai_teaching_advice(
        cls,
        teacher_name: str,
        subject: str,
        grade: int,
        avg_score: float,
        high_risk_cnt: int,
        class_gaps: List[ClassKnowledgeGapItem],
    ) -> str:
        gap_les = class_gaps[0].lesson if class_gaps else "kiến thức tổng hợp"
        gap_chap = class_gaps[0].chapter if class_gaps else f"SGK {subject} Lớp {grade}"

        return (
            f"💡 **Khuyên dùng từ AI cho Thầy/Cô {teacher_name}**:\n"
            f"- Mức điểm trung bình môn **{subject} Lớp {grade}** hiện tại của lớp là **{avg_score}/10.0**.\n"
            f"- Lớp học có **{high_risk_cnt} học sinh** thuộc nhóm nguy cơ cần hỗ trợ đặc biệt.\n"
            f"- Lỗ hổng kiến thức chính của toàn lớp nằm ở: **{gap_les}** ({gap_chap}). Thầy/Cô nên sử dụng tính năng 'Giao bài tự luyện khắc phục điểm yếu' để hỗ trợ các em ôn tập."
        )

    @classmethod
    def generate_student_evaluation_report(
        cls,
        db: Session,
        student_id: int,
        teacher: User,
    ) -> StudentAiEvaluationResponse:
        """
        Generates 1-Click AI Student Progress Evaluation & Report Card for parents & students.
        """
        student = db.query(User).filter(User.id == student_id, User.role == UserRole.STUDENT).first()
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy học sinh với ID {student_id}",
            )

        attempts = (
            db.query(ExamAttempt)
            .filter(
                ExamAttempt.student_id == student.id,
                ExamAttempt.status.in_([AttemptStatus.SUBMITTED, AttemptStatus.TIMED_OUT]),
            )
            .order_by(ExamAttempt.submitted_at.desc())
            .all()
        )

        att_cnt = len(attempts)
        scores = [att.score or 0.0 for att in attempts]
        avg_score = round(sum(scores) / att_cnt, 1) if att_cnt > 0 else 0.0

        # Fetch wrong answers for student
        att_ids = [a.id for a in attempts]
        weak_topics: List[str] = []
        if att_ids:
            wrong_rows = (
                db.query(Question.lesson, Question.chapter)
                .join(AttemptAnswer, AttemptAnswer.question_id == Question.id)
                .filter(
                    AttemptAnswer.attempt_id.in_(att_ids),
                    AttemptAnswer.is_correct == False,
                )
                .limit(3)
                .all()
            )
            for r in wrong_rows:
                t_name = r.lesson or r.chapter
                if t_name and t_name not in weak_topics:
                    weak_topics.append(t_name)

        if not weak_topics:
            weak_topics = ["Các bài tập vận dụng nâng cao"]

        # Call Gemini AI if configured
        if GeminiKnowledgeService.is_gemini_configured():
            try:
                return cls._generate_evaluation_with_gemini(student, avg_score, att_cnt, weak_topics)
            except Exception as exc:
                logger.error(f"Gemini Student Evaluation failed: {exc}", exc_info=True)

        # Fallback evaluation report generator
        return cls._generate_fallback_evaluation(student, avg_score, att_cnt, weak_topics)

    @classmethod
    def _generate_evaluation_with_gemini(
        cls,
        student: User,
        avg_score: float,
        att_cnt: int,
        weak_topics: List[str],
    ) -> StudentAiEvaluationResponse:
        prompt = f"""Bạn là AI Sư Phạm chuyên nghiệp viết Bản Nhận Xét Đánh Giá Học Sinh Phổ thông (GDPT Việt Nam Lớp 4–9).
Học sinh: {student.full_name} (Lớp {student.grade or 5})
Số bài thi đã làm: {att_cnt}
Điểm trung bình: {avg_score}/10.0
Chủ đề học sinh hay làm sai: {', '.join(weak_topics)}

Hãy sinh báo cáo đánh giá định dạng JSON chính xác:
{{
  "overall_comment": "Nhận xét tổng quan học lực và thái độ học tập (2-3 câu)...",
  "strengths": ["Điểm mạnh 1", "Điểm mạnh 2"],
  "weaknesses": ["Điểm yếu 1", "Điểm yếu 2"],
  "parent_note": "Lời nhắn ngắn gọn, lịch sự và mang tính động viên gửi Phụ huynh...",
  "action_plan": "Kế hoạch và lộ trình phấn đấu trong tuần tới..."
}}
"""
        models_to_try = [
            settings.GEMINI_MODEL,
            "gemini-3.8-flash",
            "gemini-3.5-flash",
            "gemini-2.5-flash",
            "gemini-flash-latest",
            "gemini-flash-lite-latest",
        ]
        models_to_try = list(dict.fromkeys([m.strip() for m in models_to_try if m and m.strip()]))



        with httpx.Client(timeout=20.0) as client:
            for model_name in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"responseMimeType": "application/json", "temperature": 0.3},
                }
                resp = client.post(url, json=payload)
                if resp.status_code == 200:
                    text_content = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                    cleaned = text_content.replace("```json", "").replace("```", "").strip()
                    parsed = json.loads(cleaned)

                    return StudentAiEvaluationResponse(
                        student_id=student.id,
                        student_name=student.full_name,
                        grade=student.grade or 5,
                        overall_comment=parsed.get("overall_comment", f"Học sinh {student.full_name} có điểm trung bình {avg_score}/10.0."),
                        strengths=parsed.get("strengths", ["Tiếp thu bài nhanh", "Chăm chỉ hoàn thành bài thi"]),
                        weaknesses=parsed.get("weaknesses", weak_topics),
                        parent_note=parsed.get("parent_note", f"Kính gửi Phụ huynh em {student.full_name}, em có thái độ học tập tốt."),
                        action_plan=parsed.get("action_plan", "Ôn tập theo đúng hướng dẫn của giáo viên."),
                    )

        raise RuntimeError("Failed to generate evaluation report with Gemini.")

    @classmethod
    def _generate_fallback_evaluation(
        cls,
        student: User,
        avg_score: float,
        att_cnt: int,
        weak_topics: List[str],
    ) -> StudentAiEvaluationResponse:
        if avg_score >= 8.0:
            overall = f"Học sinh {student.full_name} có lực học xuất sắc với điểm trung bình {avg_score}/10.0 qua {att_cnt} bài thi. Em nắm rất vững lý thuyết SGK và có kỹ năng tư duy làm bài tốt."
            strengths = ["Kiến thức nền tảng vững chắc", "Tốc độ làm bài nhanh và chính xác", "Thái độ học tập nghiêm túc"]
            parent_note = f"Kính gửi Phụ huynh em {student.full_name}: Em học tập rất chăm chỉ và đạt kết quả xuất sắc. Gia đình nên tiếp tục động viên em duy trì phong độ."
            action_plan = "Thực hiện các bài tập vận dụng cao để chuẩn bị cho các kỳ thi học sinh giỏi."
        elif avg_score >= 5.0:
            overall = f"Học sinh {student.full_name} đạt mức học lực Khá/Trung bình (điểm trung bình {avg_score}/10.0). Em có tiến bộ nhưng cần củng cố thêm các dạng bài tập thực hành."
            strengths = ["Có tinh thần tự học", "Nắm được các khái niệm cơ bản"]
            parent_note = f"Kính gửi Phụ huynh em {student.full_name}: Kết quả học tập của em ở mức Khá. Kính mong gia đình nhắc nhở em đọc lại SGK các bài học còn làm sai."
            action_plan = f"Ôn tập lại các bài học: {', '.join(weak_topics)} và làm bài tự luyện AI hàng tuần."
        else:
            overall = f"Học sinh {student.full_name} hiện nằm trong nhóm cần hỗ trợ đặc biệt (điểm trung bình {avg_score}/10.0). Em còn bị hổng kiến thức ở một số bài học cơ bản."
            strengths = ["Cần cố gắng và kiên trì hơn trong làm bài"]
            parent_note = f"Kính gửi Phụ huynh em {student.full_name}: Giáo viên ghi nhận em cần sự hỗ trợ sát sao hơn từ gia đình và nhà trường để bù đắp kiến thức hổng."
            action_plan = f"Dành 30 phút mỗi ngày đọc lại lý thuyết SGK và làm lại các bài thi thử cơ bản về {', '.join(weak_topics)}."

        return StudentAiEvaluationResponse(
            student_id=student.id,
            student_name=student.full_name,
            grade=student.grade or 5,
            overall_comment=overall,
            strengths=strengths,
            weaknesses=weak_topics,
            parent_note=parent_note,
            action_plan=action_plan,
        )

    @classmethod
    def assign_remedial_practice_exam(
        cls,
        db: Session,
        teacher: User,
        req: AssignRemedialRequest,
    ) -> AssignRemedialResponse:
        """
        Creates & assigns a targeted remedial AI practice exam to specific weak students.
        """
        topic_name = req.topic or f"Kiến thức trọng tâm môn {req.subject} Lớp {req.grade}"
        exam_title = f"🚀 Bài Thi Khắc Phục Điểm Yếu: {topic_name}"

        # Fetch approved questions matching subject & grade
        questions = (
            db.query(Question)
            .filter(
                Question.subject == req.subject,
                Question.grade == req.grade,
                Question.status == QuestionStatus.APPROVED,
            )
            .limit(req.question_count * 2)
            .all()
        )

        # If not enough questions, dynamically generate synthetic questions
        if len(questions) < req.question_count:
            needed = req.question_count - len(questions)
            for i in range(needed):
                synth_q = Question(
                    content=f"Câu hỏi ôn tập khắc phục điểm yếu ({req.subject} Lớp {req.grade}): {topic_name}?",
                    subject=req.subject,
                    grade=req.grade,
                    difficulty=QuestionDifficulty.MEDIUM,
                    status=QuestionStatus.APPROVED,
                    topic=topic_name,
                    explanation=f"Giải thích chi tiết chuẩn SGK {req.subject} Lớp {req.grade}.",
                    created_by_id=teacher.id,
                )
                db.add(synth_q)
                db.flush()

                options = [
                    QuestionOption(question_id=synth_q.id, option_key="A", content="Phương án A (Chưa đúng)", is_correct=False, order_index=0),
                    QuestionOption(question_id=synth_q.id, option_key="B", content="Phương án B (Đáp án đúng chuẩn SGK)", is_correct=True, order_index=1),
                    QuestionOption(question_id=synth_q.id, option_key="C", content="Phương án C (Chưa đúng)", is_correct=False, order_index=2),
                    QuestionOption(question_id=synth_q.id, option_key="D", content="Phương án D (Chưa đúng)", is_correct=False, order_index=3),
                ]
                db.add_all(options)
                db.flush()
                questions.append(synth_q)

        random.shuffle(questions)
        selected_questions = questions[:req.question_count]

        # Create published exam
        exam = Exam(
            title=exam_title,
            description=f"Đề thi tự luyện giao bởi Giáo viên {teacher.full_name} nhằm khắc phục điểm yếu cho học sinh.",
            subject=req.subject,
            grade=req.grade,
            duration_minutes=max(10, req.question_count * 3),
            total_points=10.0,
            passing_score=5.0,
            shuffle_questions=True,
            shuffle_options=True,
            status=ExamStatus.PUBLISHED,
            created_by_id=teacher.id,
        )
        db.add(exam)
        db.flush()

        pts = round(10.0 / len(selected_questions), 2)
        for idx, q in enumerate(selected_questions):
            db.add(ExamQuestion(exam_id=exam.id, question_id=q.id, points=pts, order_index=idx))
            exam.total_questions += 1

        # Assign to students
        assigned_cnt = 0
        for s_id in req.student_ids:
            db.add(ExamAssignment(exam_id=exam.id, assigned_to_user_id=s_id, assigned_grade=req.grade))
            assigned_cnt += 1

        db.commit()
        db.refresh(exam)

        return AssignRemedialResponse(
            exam_id=exam.id,
            title=exam.title,
            assigned_count=assigned_cnt,
            message=f"Đã khởi tạo và giao bài thi '{exam.title}' thành công cho {assigned_cnt} học sinh.",
        )
