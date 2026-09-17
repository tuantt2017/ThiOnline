import json
import logging
from typing import Any, Dict, List, Optional
import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.exam import ExamAttempt, AttemptStatus
from app.models.question import Question
from app.models.user import User
from app.schemas.ai import AiTutorFeedbackItem, AiTutorResponse
from app.services import exam_service
from app.services.gemini_service import GeminiKnowledgeService

logger = logging.getLogger(__name__)


class AiTutorService:
    """
    AI Tutor Service implementing Phase 6 Specification.
    Analyzes submitted/timed out exam attempts, groups incorrect answers by topic/concept,
    and calls Google Gemini API (with SGK grounding rules) to generate feedback.
    """

    @classmethod
    def generate_tutor_feedback(
        cls,
        db: Session,
        attempt_id: int,
        user: User,
    ) -> AiTutorResponse:
        attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
        if not attempt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy lượt làm bài thi.",
            )

        # RBAC Check: Student can only analyze their own attempt
        if attempt.student_id != user.id and user.role.value == "STUDENT":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập kết quả lượt thi này.",
            )

        # Execution check: AI Tutor only operates on completed attempts
        if attempt.status == AttemptStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Lượt thi chưa hoàn thành. AI Tutor chỉ hoạt động sau khi bài thi đã được nộp.",
            )

        result_obj = exam_service.get_attempt_result(db, attempt.id, user)
        detailed_answers = result_obj.detailed_answers

        incorrect_items = [ans for ans in detailed_answers if not ans.get("is_correct")]
        total_incorrect = len(incorrect_items)

        if total_incorrect == 0:
            return AiTutorResponse(
                attempt_id=attempt.id,
                total_incorrect=0,
                score=result_obj.score,
                percentage=result_obj.percentage,
                summary_advice=(
                    f"Chúc mừng {user.full_name}! Bạn đã xuất sắc trả lời đúng 100% tất cả các câu hỏi trong "
                    f"đề thi '{result_obj.exam_title}'. Hãy tiếp tục phát huy kiến thức xuất sắc này!"
                ),
                feedbacks=[],
            )

        # Prepare question context payload for AI tutor analysis
        question_payloads = []
        for item in incorrect_items:
            q_id = item.get("question_id")
            q_db = db.query(Question).filter(Question.id == q_id).first()

            selected_key = item.get("selected_option_key")
            correct_key = item.get("correct_option_key")

            opts = item.get("options") or []
            selected_text = next((o.get("content") for o in opts if o.get("option_key") == selected_key), "Không chọn")
            correct_text = next((o.get("content") for o in opts if o.get("option_key") == correct_key), "")

            question_payloads.append({
                "question_id": q_id,
                "question_text": item.get("question_text"),
                "selected_option_key": selected_key,
                "selected_option_text": selected_text,
                "correct_option_key": correct_key,
                "correct_option_text": correct_text,
                "explanation": item.get("explanation") or (q_db.explanation if q_db else ""),
                "subject": q_db.subject if q_db else "Môn học",
                "grade": q_db.grade if q_db else 5,
                "chapter": q_db.chapter if q_db else "",
                "lesson": q_db.lesson if q_db else "",
                "topic": q_db.topic if q_db else "",
            })

        # Check if Gemini API is available and configured
        if GeminiKnowledgeService.is_gemini_configured():
            try:
                return cls._generate_with_gemini(attempt.id, result_obj, question_payloads)
            except Exception as exc:
                logger.error(f"Lỗi khi gọi Gemini AI Tutor: {exc}. Chuyển sang bộ sinh dự phòng.", exc_info=True)

        # Smart Fallback Feedback Generator
        return cls._generate_fallback_feedback(attempt.id, result_obj, question_payloads)

    @classmethod
    def _generate_with_gemini(
        cls,
        attempt_id: int,
        result_obj: Any,
        question_payloads: List[Dict[str, Any]],
    ) -> AiTutorResponse:
        prompt = f"""
Bạn là AI Tutor — Trợ lý Gia sư AI Thông minh cho học sinh Phổ thông (GDPT Việt Nam Lớp 4-9).
Nhiệm vụ của bạn là phân tích bài thi của học sinh sau khi nộp bài, đưa ra chỉ dẫn và giải thích chi tiết cho từng câu trả lời chưa chính xác.

NGUYÊN TẮC AI TUTOR GROUNDING:
1. Kiến thức cốt lõi (correct_concept) và nguồn tham chiếu (source_reference) PHẢI bám sát chương trình Sách Giáo Khoa.
2. Với mỗi câu sai, hãy giải thích rõ tại sao phương án học sinh chọn lại chưa đúng (why_wrong), kiến thức đúng là gì (correct_concept), gợi ý phương pháp ôn lại bài (study_hint) và trích dẫn bài học (source_reference).
3. Đưa ra một nhận xét tổng quan ngắn gọn (summary_advice) động viên học sinh.

Danh sách các câu chưa chính xác trong đề thi '{result_obj.exam_title}':
{json.dumps(question_payloads, ensure_ascii=False, indent=2)}

YÊU CẦU ĐẦU RA JSON ĐÚNG ĐỊNH DẠNG SAU:
{{
  "summary_advice": "Đánh giá tổng quan điểm mạnh, điểm cần khắc phục và lời khuyên tổng thể cho học sinh...",
  "feedbacks": [
    {{
      "question_id": 10,
      "why_wrong": "Bạn đã chọn phương án A vì nhầm lẫn giữa...",
      "correct_concept": "Theo SGK, khái niệm chuẩn là...",
      "study_hint": "Hãy đọc lại Bài 5 Chương 2 môn Toán...",
      "source_reference": "SGK Lớp 5 - Chương 2 Bài 5"
    }}
  ]
}}
"""

        models_to_try = [settings.GEMINI_MODEL, "gemini-1.5-flash", "gemini-2.0-flash"]
        models_to_try = list(dict.fromkeys([m for m in models_to_try if m]))

        with httpx.Client(timeout=30.0) as client:
            for model_name in models_to_try:
                endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={settings.GEMINI_API_KEY.strip()}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"responseMimeType": "application/json", "temperature": 0.3},
                }
                resp = client.post(endpoint, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    break
            else:
                resp.raise_for_status()


        text_content = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text_content)

        feedbacks_map = {f["question_id"]: f for f in parsed.get("feedbacks", []) if "question_id" in f}

        feedback_items = []
        for qp in question_payloads:
            q_id = qp["question_id"]
            ai_f = feedbacks_map.get(q_id, {})

            why_wrong = ai_f.get("why_wrong") or f"Phương án {qp['selected_option_key']} chưa đúng. Đáp án chuẩn là phương án {qp['correct_option_key']}."
            correct_concept = ai_f.get("correct_concept") or (qp.get("explanation") or f"Đáp án đúng là {qp['correct_option_key']}: {qp['correct_option_text']}")
            study_hint = ai_f.get("study_hint") or f"Nên xem lại phần kiến thức thuộc {qp.get('chapter') or 'chủ đề bài học'}."
            source_ref = ai_f.get("source_reference") or f"SGK {qp.get('subject')} Lớp {qp.get('grade')} - {qp.get('chapter') or ''}"

            feedback_items.append(
                AiTutorFeedbackItem(
                    question_id=q_id,
                    question_text=qp["question_text"],
                    selected_option_key=qp["selected_option_key"],
                    selected_option_text=qp["selected_option_text"],
                    correct_option_key=qp["correct_option_key"],
                    correct_option_text=qp["correct_option_text"],
                    why_wrong=why_wrong,
                    correct_concept=correct_concept,
                    study_hint=study_hint,
                    source_reference=source_ref,
                )
            )

        return AiTutorResponse(
            attempt_id=attempt_id,
            total_incorrect=len(feedback_items),
            score=result_obj.score,
            percentage=result_obj.percentage,
            summary_advice=parsed.get("summary_advice") or f"Bài làm đạt {result_obj.score}/10.0 điểm. Hãy xem lại các câu chưa chính xác bên dưới để củng cố kiến thức.",
            feedbacks=feedback_items,
        )

    @classmethod
    def _generate_fallback_feedback(
        cls,
        attempt_id: int,
        result_obj: Any,
        question_payloads: List[Dict[str, Any]],
    ) -> AiTutorResponse:
        feedback_items = []
        for qp in question_payloads:
            selected_key = qp["selected_option_key"] or "Bỏ qua"
            correct_key = qp["correct_option_key"]
            explanation = qp.get("explanation") or "Chưa có giải thích chi tiết."

            chapter_info = qp.get("chapter") or "Chủ đề học tập"
            lesson_info = qp.get("lesson") or "Bài học"
            subject_info = qp.get("subject") or "Môn học"
            grade_info = qp.get("grade") or 5

            why_wrong = (
                f"Bạn chọn phương án [{selected_key}: {qp['selected_option_text']}]. "
                f"Phương án này chưa chính xác với yêu cầu của bài tập."
            )
            correct_concept = (
                f"Đáp án chính xác là [{correct_key}: {qp['correct_option_text']}]. "
                f"{explanation}"
            )
            study_hint = (
                f"Hãy ôn luyện lại nội dung kiến thức trong {lesson_info} ({chapter_info}) "
                f"để nắm vững cách giải dạng bài này."
            )
            source_ref = f"Sách giáo khoa {subject_info} Lớp {grade_info} — {chapter_info}"

            feedback_items.append(
                AiTutorFeedbackItem(
                    question_id=qp["question_id"],
                    question_text=qp["question_text"],
                    selected_option_key=qp["selected_option_key"],
                    selected_option_text=qp["selected_option_text"],
                    correct_option_key=qp["correct_option_key"],
                    correct_option_text=qp["correct_option_text"],
                    why_wrong=why_wrong,
                    correct_concept=correct_concept,
                    study_hint=study_hint,
                    source_reference=source_ref,
                )
            )

        return AiTutorResponse(
            attempt_id=attempt_id,
            total_incorrect=len(feedback_items),
            score=result_obj.score,
            percentage=result_obj.percentage,
            summary_advice=(
                f"Gia sư AI đã tổng hợp {len(feedback_items)} câu chưa chính xác trong bài thi '{result_obj.exam_title}'. "
                f"Hãy dành thời gian đọc kỹ các chỉ dẫn và gợi ý học tập bên dưới để sẵn sàng cho bài thi tiếp theo!"
            ),
            feedbacks=feedback_items,
        )
