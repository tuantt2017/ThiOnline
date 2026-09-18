import random
from typing import List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.models.user import User
from app.models.question import Question, QuestionStatus, QuestionDifficulty
from app.models.exam import Exam, ExamQuestion, ExamAssignment, ExamAttempt, ExamStatus, AttemptStatus
from app.models.exam import AttemptAnswer
from app.schemas.ai import AdaptivePracticeRequest, AdaptivePracticeResponse
from app.services import exam_service


class AdaptivePracticeService:
    @staticmethod
    def create_adaptive_practice(
        db: Session,
        student: User,
        req: AdaptivePracticeRequest,
    ) -> AdaptivePracticeResponse:
        """
        Creates a personalized AI practice exam tailored to the student's weak areas.
        
        1. Analyzes student's past exam attempts for weak topics (questions answered incorrectly).
        2. Selects or generates questions targeting those weak topics.
        3. Creates a PUBLISHED practice exam, assigns it to the student, and starts an attempt immediately.
        """
        subject = req.subject
        count = max(3, min(20, req.count))
        grade = student.grade if student.grade and 4 <= student.grade <= 9 else 5

        # 1. Determine target topics (user selected topics vs past weak topics)
        selected_topics = [t.strip() for t in (req.topics or []) if t and t.strip()]
        weak_topics: List[str] = []

        if selected_topics:
            target_topics = selected_topics
        else:
            # Analyze student's past incorrect answers for this subject
            past_wrong_query = (
                db.query(
                    Question.topic,
                    Question.chapter,
                    Question.lesson,
                    func.count(AttemptAnswer.id).label("wrong_count"),
                )
                .join(AttemptAnswer, AttemptAnswer.question_id == Question.id)
                .join(ExamAttempt, ExamAttempt.id == AttemptAnswer.attempt_id)
                .filter(
                    ExamAttempt.student_id == student.id,
                    Question.subject == subject,
                    Question.grade == grade,
                    AttemptAnswer.is_correct == False,
                )
                .group_by(Question.topic, Question.chapter, Question.lesson)
                .order_by(desc("wrong_count"))
                .all()
            )
            for row in past_wrong_query:
                topic_name = row.topic or row.chapter or row.lesson
                if topic_name and topic_name not in weak_topics:
                    weak_topics.append(topic_name)
            target_topics = weak_topics if weak_topics else [f"Kiến thức trọng tâm môn {subject} Lớp {grade}"]

        # 2. Find question IDs already answered by student in past attempts to avoid repeating exact same questions
        previous_attempt_q_ids = [
            q_id
            for (q_id,) in (
                db.query(AttemptAnswer.question_id)
                .join(ExamAttempt, ExamAttempt.id == AttemptAnswer.attempt_id)
                .filter(ExamAttempt.student_id == student.id)
                .all()
            )
        ]

        selected_questions: List[Question] = []

        # 3. Try to fetch unused existing APPROVED questions targeting target_topics
        if target_topics:
            from sqlalchemy import or_
            filters = []
            for tp in target_topics:
                filters.append(Question.topic.ilike(f"%{tp}%"))
                filters.append(Question.chapter.ilike(f"%{tp}%"))
                filters.append(Question.lesson.ilike(f"%{tp}%"))

            matching_query = db.query(Question).filter(
                Question.subject == subject,
                Question.grade == grade,
                Question.status == QuestionStatus.APPROVED,
                or_(*filters),
            )
            if previous_attempt_q_ids:
                matching_query = matching_query.filter(Question.id.notin_(previous_attempt_q_ids))

            matching_questions = matching_query.limit(count * 2).all()
            if matching_questions:
                random.shuffle(matching_questions)
                selected_questions.extend(matching_questions[:count])

        # 4. If not enough questions, dynamically generate FRESH randomized AI questions via Gemini
        if len(selected_questions) < count:
            needed = count - len(selected_questions)
            chosen_topic = random.choice(target_topics) if target_topics else f"Kiến thức môn {subject} Lớp {grade}"

            from app.schemas.ai import AiQuestionGenerateRequest
            from app.services.ai_question_service import GeminiQuestionGenerator
            from app.models.question import QuestionOption, QuestionType, QuestionSource

            ai_req = AiQuestionGenerateRequest(
                subject=subject,
                grade=grade,
                document_id=req.document_id,
                topic=chosen_topic,
                topics=target_topics,
                chapter=target_topics[0] if target_topics else None,
                count=needed,
                use_web_context=True,
                save_as_draft=False,
            )

            try:
                ai_res = GeminiQuestionGenerator.generate_questions(db=db, req=ai_req, user_id=student.id)
                for q_item in ai_res.questions:
                    if not q_item.is_valid:
                        continue
                    synth_q = Question(
                        content=q_item.question_text,
                        question_type=QuestionType.MULTIPLE_CHOICE_SINGLE,
                        difficulty=q_item.difficulty,
                        status=QuestionStatus.APPROVED,
                        source=QuestionSource.AI_GENERATED,
                        subject=subject,
                        grade=grade,
                        topic=q_item.topic or chosen_topic,
                        learning_objective=q_item.learning_objective,
                        explanation=q_item.explanation,
                        created_by_id=student.id,
                    )
                    db.add(synth_q)
                    db.flush()

                    for idx, opt in enumerate(q_item.options):
                        db.add(
                            QuestionOption(
                                question_id=synth_q.id,
                                option_key=opt.key,
                                content=opt.text,
                                is_correct=opt.is_correct,
                                order_index=idx,
                            )
                        )
                    db.flush()
                    selected_questions.append(synth_q)
                    if len(selected_questions) >= count:
                        break
            except Exception as exc:
                import logging
                logging.getLogger(__name__).warning(f"Lỗi khi sinh câu hỏi AI tự luyện: {exc}")

        # Final randomize question order
        random.shuffle(selected_questions)
        db.commit()

        # 5. Create new Exam
        duration = max(10, count * 3)
        topics_str = ", ".join(weak_topics[:3]) if weak_topics else "Tổng hợp chương trình SGK"
        exam_title = f"🚀 Đề Tự Luyện AI - {subject} Lớp {grade}"

        exam = Exam(
            title=exam_title,
            description=f"Đề thi tự luyện cá nhân hóa do AI khởi tạo dành cho học sinh {student.full_name}. Tập trung củng cố: {topics_str}.",
            subject=subject,
            grade=grade,
            duration_minutes=duration,
            total_points=10.0,
            passing_score=5.0,
            shuffle_questions=True,
            shuffle_options=True,
            status=ExamStatus.PUBLISHED,
            created_by_id=student.id,
        )
        db.add(exam)
        db.flush()

        # Link questions with equal points
        points_per_q = round(10.0 / len(selected_questions), 2)
        for idx, q in enumerate(selected_questions):
            eq = ExamQuestion(
                exam_id=exam.id,
                question_id=q.id,
                points=points_per_q,
                order_index=idx,
            )
            db.add(eq)

        # Assign exam to student
        assignment = ExamAssignment(
            exam_id=exam.id,
            assigned_to_user_id=student.id,
            assigned_grade=grade,
        )
        db.add(assignment)
        db.commit()
        db.refresh(exam)

        # 6. Start exam attempt immediately
        attempt = exam_service.start_exam_attempt(db=db, exam_id=exam.id, student=student)

        message = (
            f"AI đã phân tích điểm yếu và khởi tạo thành công đề tự luyện gồm {len(selected_questions)} câu hỏi môn {subject} Lớp {grade}."
            if weak_topics
            else f"AI đã khởi tạo bộ {len(selected_questions)} câu hỏi tự luyện tổng hợp chuẩn SGK môn {subject} Lớp {grade}."
        )

        return AdaptivePracticeResponse(
            exam_id=exam.id,
            attempt_id=attempt.id,
            title=exam.title,
            subject=subject,
            grade=grade,
            total_questions=len(selected_questions),
            duration_minutes=duration,
            weak_topics_targeted=weak_topics[:5],
            message=message,
        )
