import json
import logging
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.document import Document, DocumentChunk
from app.models.exam import AttemptAnswer, AttemptStatus, Exam, ExamAttempt
from app.models.question import Question
from app.models.user import User
from app.schemas.roadmap import LearningRoadmapResponse, TopicMasteryItem
from app.services.gemini_service import GeminiKnowledgeService

logger = logging.getLogger(__name__)


class LearningRoadmapService:
    """
    Service for AI Personalized Learning Roadmap & Weakness Map (Lộ Trình Ôn Tập & Bản Đồ Điểm Yếu).
    Analyzes student's historical exam performance, computes SGK topic/chapter mastery levels (0%-100%),
    and generates actionable daily study recommendations grounded in SGK GDPT 2018.
    """

    @classmethod
    def get_student_roadmap(
        cls,
        db: Session,
        student: User,
        subject: Optional[str] = None,
    ) -> LearningRoadmapResponse:
        target_subject = (subject or "Toán").strip()
        grade = student.grade if student.grade and 4 <= student.grade <= 9 else 5

        # 1. Fetch completed attempts of this student
        completed_attempts = (
            db.query(ExamAttempt)
            .filter(
                ExamAttempt.student_id == student.id,
                ExamAttempt.status.in_([AttemptStatus.SUBMITTED, AttemptStatus.TIMED_OUT]),
            )
            .all()
        )
        total_attempts_count = len(completed_attempts)
        attempt_ids = [a.id for a in completed_attempts]

        # 2. Query question performance grouped by Chapter & Lesson
        stats_map: Dict[str, Dict[str, Any]] = {}

        if attempt_ids:
            answers_query = (
                db.query(
                    Question.chapter,
                    Question.lesson,
                    Question.topic,
                    func.count(AttemptAnswer.id).label("total"),
                    func.sum(case((AttemptAnswer.is_correct == True, 1), else_=0)).label("correct"),
                )
                .join(AttemptAnswer, AttemptAnswer.question_id == Question.id)
                .filter(
                    AttemptAnswer.attempt_id.in_(attempt_ids),
                    Question.subject == target_subject,
                    Question.grade == grade,
                )
                .group_by(Question.chapter, Question.lesson, Question.topic)
                .all()
            )

            for row in answers_query:
                chap = row.chapter or f"Chương trình {target_subject} Lớp {grade}"
                les = row.lesson or "Bài học trọng tâm"
                top = row.topic
                tot = row.total or 0
                corr = int(row.correct or 0)

                key = f"{chap}::{les}"
                if key not in stats_map:
                    stats_map[key] = {
                        "chapter": chap,
                        "lesson": les,
                        "topic": top,
                        "total": 0,
                        "correct": 0,
                    }
                stats_map[key]["total"] += tot
                stats_map[key]["correct"] += corr

        # 3. If no past exam attempts exist yet for this subject, populate from SGK document chunks in DB
        if not stats_map:
            sgk_chunks = (
                db.query(DocumentChunk)
                .join(Document, DocumentChunk.document_id == Document.id)
                .filter(
                    Document.subject.ilike(f"%{target_subject}%"),
                    Document.grade == grade,
                )
                .limit(10)
                .all()
            )

            if sgk_chunks:
                for c in sgk_chunks:
                    chap = c.chapter or f"Chương trình {target_subject} Lớp {grade}"
                    les = c.lesson or "Bài học SGK"
                    key = f"{chap}::{les}"
                    if key not in stats_map:
                        stats_map[key] = {
                            "chapter": chap,
                            "lesson": les,
                            "topic": c.topic,
                            "total": 0,
                            "correct": 0,
                            "page": c.page_number,
                        }

        # Fallback default chapters if database is totally empty
        if not stats_map:
            default_lessons = [
                ("Chương 1: Khái niệm ban đầu", "Bài 1. Luyện tập lý thuyết và bài tập cơ bản", 12),
                ("Chương 1: Khái niệm ban đầu", "Bài 2. Ôn tập phương pháp tính toán", 18),
                ("Chương 2: Chủ đề nâng cao", "Bài 3. Quy tắc tổng hợp kiến thức", 28),
                ("Chương 2: Chủ đề nâng cao", "Bài 4. Ứng dụng giải bài tập thực tế", 35),
            ]
            for chap, les, p in default_lessons:
                key = f"{chap}::{les}"
                stats_map[key] = {
                    "chapter": chap,
                    "lesson": les,
                    "topic": "Nội dung học tập",
                    "total": 0,
                    "correct": 0,
                    "page": p,
                }

        # 4. Build TopicMasteryItem list & compute status levels
        chapter_breakdown: List[TopicMasteryItem] = []
        mastered_cnt = 0
        practice_cnt = 0
        weak_cnt = 0

        total_ans_overall = 0
        total_corr_overall = 0

        weak_topic_names: List[str] = []

        for item_data in stats_map.values():
            tot = item_data["total"]
            corr = item_data["correct"]
            total_ans_overall += tot
            total_corr_overall += corr

            if tot > 0:
                pct = round((corr / tot) * 100.0, 1)
            else:
                pct = 0.0

            if pct >= 80.0:
                st_level = "MASTERED"  # 🟢 Đã vững
                mastered_cnt += 1
            elif pct >= 50.0:
                st_level = "PRACTICE_NEEDED"  # 🟡 Cần rèn luyện
                practice_cnt += 1
            else:
                st_level = "WEAK"  # 🔴 Điểm yếu
                weak_cnt += 1
                weak_topic_names.append(f"{item_data['lesson']} ({item_data['chapter']})")

            chapter_breakdown.append(
                TopicMasteryItem(
                    chapter=item_data["chapter"],
                    lesson=item_data["lesson"],
                    topic=item_data.get("topic"),
                    total_questions=tot,
                    correct_count=corr,
                    mastery_percentage=pct,
                    status_level=st_level,
                    page_reference=item_data.get("page"),
                )
            )

        overall_mastery = round((total_corr_overall / total_ans_overall * 100.0), 1) if total_ans_overall > 0 else 0.0

        # Sort breakdown: WEAK first, then PRACTICE_NEEDED, then MASTERED
        level_order = {"WEAK": 0, "PRACTICE_NEEDED": 1, "MASTERED": 2}
        chapter_breakdown.sort(key=lambda x: (level_order.get(x.status_level, 99), x.mastery_percentage))

        # 5. Generate AI Daily Action Advice
        ai_action = cls._generate_ai_daily_advice(
            student_name=student.full_name,
            subject=target_subject,
            grade=grade,
            overall_mastery=overall_mastery,
            weak_topics=weak_topic_names[:3],
            first_weak_item=chapter_breakdown[0] if chapter_breakdown else None,
        )

        return LearningRoadmapResponse(
            subject=target_subject,
            grade=grade,
            overall_mastery_percentage=overall_mastery,
            total_attempts=total_attempts_count,
            mastered_count=mastered_cnt,
            practice_needed_count=practice_cnt,
            weak_count=weak_cnt,
            chapter_breakdown=chapter_breakdown,
            ai_daily_action=ai_action,
            recommended_weak_topics=weak_topic_names[:5],
        )

    @classmethod
    def _generate_ai_daily_advice(
        cls,
        student_name: str,
        subject: str,
        grade: int,
        overall_mastery: float,
        weak_topics: List[str],
        first_weak_item: Optional[TopicMasteryItem],
    ) -> str:
        """Generates clear actionable daily study recommendation for the student."""
        
        target_lesson = first_weak_item.lesson if first_weak_item else "Chủ đề kiến thức trọng tâm"
        target_chapter = first_weak_item.chapter if first_weak_item else f"SGK {subject} Lớp {grade}"
        page_str = f"Trang {first_weak_item.page_reference}" if first_weak_item and first_weak_item.page_reference else "phần lý thuyết bài học"

        if weak_topics:
            weak_str = ", ".join(weak_topics[:2])
            fallback_advice = (
                f"🎯 **Gợi ý hành động hôm nay cho {student_name}**:\n"
                f"AI phát hiện bạn cần củng cố lại kiến thức: **{weak_str}**.\n"
                f"👉 **Hành động ngay**: Hôm nay bạn nên đọc lại **{target_lesson}** ({target_chapter} - {page_str}) "
                f"trong SGK môn {subject} Lớp {grade} và nhấn nút 'Tạo Đề Tự Luyện AI' làm 5 câu tự luyện nhé!"
            )
        else:
            fallback_advice = (
                f"🌟 **Gợi ý hành động hôm nay cho {student_name}**:\n"
                f"Bạn đang duy trì tiến độ học tập xuất sắc môn {subject} Lớp {grade} với mức thành thạo **{overall_mastery}%**!\n"
                f"👉 **Hành động ngay**: Đọc qua **{target_lesson}** trong SGK và thực hiện 1 đề tự luyện ôn tập tổng hợp để giữ vững phong độ."
            )

        if not GeminiKnowledgeService.is_gemini_configured():
            return fallback_advice

        try:
            prompt = f"""Bạn là AI Tutor lập Lộ Trình Học Tập Cá Nhân Hóa cho học sinh Phổ thông GDPT 2018 Việt Nam.
Học sinh: {student_name}
Môn học: {subject} Lớp {grade}
Mức độ thành thạo hiện tại: {overall_mastery}%
Chủ đề điểm yếu cần khắc phục: {', '.join(weak_topics) if weak_topics else 'Không có điểm yếu nghiêm trọng'}
Bài học cần ưu tiên: {target_lesson} ({target_chapter})

Hãy viết 1 đoạn LỜI KHUYÊN HÀNH ĐỘNG CỤ THỂ HÔM NAY (dưới 3 câu, ngắn gọn, truyền cảm hứng, cực kỳ cụ thể).
Mẫu câu bắt buộc theo định dạng:
"🎯 Hôm nay bạn nên đọc lại [Bài X - Trang Y SGK Môn Lớp] và làm 5 câu tự luyện AI để làm chủ kiến thức này!"
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



            with httpx.Client(timeout=15.0) as client:
                for model_name in models_to_try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                    payload = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.3},
                    }
                    resp = client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            text = candidates[0]["content"]["parts"][0]["text"].strip()
                            if len(text) > 20:
                                return text
        except Exception as exc:
            logger.warning(f"Gemini AI advice call failed: {exc}")

        return fallback_advice
