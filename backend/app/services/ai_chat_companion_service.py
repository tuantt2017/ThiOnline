import json
import logging
import re
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.document import Document, DocumentChunk, DocumentStatus
from app.models.user import User
from app.schemas.chat import ChatMessageInput, ChatMessageResponse, SgkCitation
from app.services.gemini_service import GeminiKnowledgeService

logger = logging.getLogger(__name__)


class AiChatCompanionService:
    """
    Service for 1-on-1 Interactive AI Study Companion / Q&A Bot.
    Enforces SGK Grounding Rule (strictly limits knowledge & tone to student's grade level 4-9)
    and provides explicit SGK citations (Chapter, Lesson, Page Number).
    """

    @classmethod
    def search_relevant_sgk_chunks(
        cls,
        db: Session,
        query_text: str,
        subject: str,
        grade: int,
        limit: int = 4,
    ) -> List[Dict[str, Any]]:
        """
        RAG Search: Retrieves relevant SGK chunks matching subject and grade from DB.
        """
        keywords = [k.strip() for k in re.split(r"\s+", query_text.strip()) if len(k.strip()) > 1]
        
        base_query = (
            db.query(DocumentChunk)
            .join(Document, DocumentChunk.document_id == Document.id)
            .filter(
                Document.subject.ilike(f"%{subject.strip()}%"),
                Document.grade == grade,
                Document.status == DocumentStatus.COMPLETED,
            )
        )

        results: List[DocumentChunk] = []
        if keywords:
            # Match chunks containing keywords in content, chapter, or lesson
            filters = []
            for kw in keywords[:5]:
                filters.append(DocumentChunk.content.ilike(f"%{kw}%"))
                filters.append(DocumentChunk.chapter.ilike(f"%{kw}%"))
                filters.append(DocumentChunk.lesson.ilike(f"%{kw}%"))
                filters.append(DocumentChunk.topic.ilike(f"%{kw}%"))
            
            results = base_query.filter(or_(*filters)).limit(limit).all()

        if not results:
            # Fallback: get general chunks for the subject & grade
            results = base_query.limit(limit).all()

        retrieved_chunks = []
        for chunk in results:
            doc = chunk.document
            retrieved_chunks.append({
                "document_title": doc.title if doc else f"SGK {subject} Lớp {grade}",
                "chapter": chunk.chapter or f"Chương trình {subject} Lớp {grade}",
                "lesson": chunk.lesson or "Bài học trọng tâm",
                "page_number": chunk.page_number,
                "content": chunk.content,
                "topic": chunk.topic or "",
                "concept": chunk.concept or "",
            })

        return retrieved_chunks

    @classmethod
    def generate_chat_reply(
        cls,
        db: Session,
        student: User,
        chat_in: ChatMessageInput,
    ) -> ChatMessageResponse:
        """
        Main entry point for generating AI Companion chat responses.
        """
        # Determine grade level (use input grade or fallback to student's grade or default 5)
        grade = chat_in.grade or (student.grade if student.grade and 4 <= student.grade <= 9 else 5)
        subject = chat_in.subject.strip()
        user_message = chat_in.message.strip()

        # 1. RAG Search for relevant SGK chunks
        retrieved_chunks = cls.search_relevant_sgk_chunks(
            db=db,
            query_text=user_message,
            subject=subject,
            grade=grade,
            limit=4,
        )

        # 2. Check if Gemini AI is available
        if GeminiKnowledgeService.is_gemini_configured():
            try:
                return cls._generate_with_gemini(
                    user_message=user_message,
                    subject=subject,
                    grade=grade,
                    student_name=student.full_name,
                    history=chat_in.conversation_history or [],
                    chunks=retrieved_chunks,
                )
            except Exception as exc:
                logger.error(f"Lỗi khi gọi Gemini AI Chat Companion: {exc}. Chuyển sang bộ trả lời dự phòng.", exc_info=True)

        # 3. Fallback Response Generator
        return cls._generate_fallback_reply(
            user_message=user_message,
            subject=subject,
            grade=grade,
            student_name=student.full_name,
            chunks=retrieved_chunks,
        )

    @classmethod
    def _generate_with_gemini(
        cls,
        user_message: str,
        subject: str,
        grade: int,
        student_name: str,
        history: List[Any],
        chunks: List[Dict[str, Any]],
    ) -> ChatMessageResponse:
        """Generates structured response using Gemini AI with strict SGK Grounding Rule."""

        context_str = ""
        if chunks:
            context_str = "DỮ LIỆU SÁCH GIÁO KHOA THAM CHIẾU NỘI BỘ:\n"
            for idx, c in enumerate(chunks, 1):
                page_info = f"Trang {c['page_number']}" if c.get("page_number") else "SGK"
                context_str += f"[{idx}] {c['document_title']} | {c['chapter']} | {c['lesson']} ({page_info}):\n{c['content']}\n\n"

        history_str = ""
        if history:
            history_str = "LỊCH SỬ HỘI THOẠI TRƯỚC ĐÓ:\n"
            for item in history[-4:]:  # last 4 turns
                role = "Học sinh" if getattr(item, "role", "user") == "user" else "AI Tutor"
                content = getattr(item, "content", "")
                history_str += f"{role}: {content}\n"

        prompt = f"""Bạn là **Trợ Lý Học Tập AI 1-on-1** chuyên trách hỗ trợ học sinh Phổ thông (GDPT Việt Nam Lớp 4–9).
Hiện tại bạn đang giải đáp thắc mắc cho học sinh **{student_name}** về môn **{subject}** khối **Lớp {grade}**.

QUY TẮC SGK GROUNDING BẮT BUỘC (CRITICAL):
1. **Phạm vi kiến thức**: TUYỆT ĐỐI KHÔNG sử dụng khái niệm, công thức hoặc thuật ngữ thuộc chương trình khối lớp cao hơn Lớp {grade}. Giải thích bằng ngôn ngữ thân thiện, dễ hiểu, sinh động và trực quan chuẩn độ tuổi Lớp {grade}.
2. **Ví dụ minh họa**: Luôn cung cấp 1–2 ví dụ thực tế hoặc bài toán mẫu cụ thể kèm lời giải từng bước rõ ràng.
3. **Trích dẫn nguồn SGK**: Phải liệt kê chính xác tên Bài học, Chương/Chủ đề và Số trang SGK tham chiếu để học sinh mở sách đối chiếu.
4. **Gợi ý học tập tiếp theo**: Đề xuất 3 câu hỏi gợi mở đào sâu tiếp theo.

{context_str}
{history_str}

CÂU HỎI CỦA HỌC SINH: "{user_message}"

YÊU CẦU ĐẦU RA JSON CHÍNH XÁC (KHÔNG KÈM VĂN BẢN NGOÀI):
{{
  "reply": "Nội dung giải thích chi tiết, thân thiện, từng bước kèm ví dụ trực quan...",
  "citations": [
    {{
      "document_title": "Sách giáo khoa {subject} Lớp {grade}",
      "chapter": "Tên Chương / Chủ đề SGK",
      "lesson": "Tên Bài học SGK",
      "page_number": 42,
      "snippet": "Tóm tắt ngắn 1 câu kiến thức cốt lõi từ SGK"
    }}
  ],
  "suggested_followups": [
    "Câu hỏi gợi mở 1...",
    "Câu hỏi gợi mở 2...",
    "Câu hỏi gợi mở 3..."
  ]
}}
"""

        api_key = settings.GEMINI_API_KEY.strip()
        # Prioritize non-2.5 models as per gemini_service standard
        models_to_try = [settings.GEMINI_MODEL, "gemini-flash-latest", "gemini-3.5-flash-lite"]
        models_to_try = list(dict.fromkeys([m for m in models_to_try if m and "2.5" not in m]))

        with httpx.Client(timeout=35.0) as client:
            for model_name in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.3,
                        "responseMimeType": "application/json",
                    },
                }
                try:
                    resp = client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            text_content = candidates[0]["content"]["parts"][0]["text"]
                            cleaned = re.sub(r"^```(?:json)?\s*", "", text_content.strip())
                            cleaned = re.sub(r"\s*```$", "", cleaned.strip())
                            parsed = json.loads(cleaned)

                            citations = [
                                SgkCitation(
                                    document_title=c.get("document_title") or f"SGK {subject} Lớp {grade}",
                                    chapter=c.get("chapter") or f"Chương trình {subject} Lớp {grade}",
                                    lesson=c.get("lesson") or "Bài học trọng tâm",
                                    page_number=c.get("page_number"),
                                    snippet=c.get("snippet") or "Kiến thức chuẩn SGK GDPT 2018.",
                                )
                                for c in parsed.get("citations", [])
                            ]

                            return ChatMessageResponse(
                                reply=parsed.get("reply") or f"Chào {student_name}, AI đã tiếp nhận câu hỏi của em về môn {subject} Lớp {grade}.",
                                subject=subject,
                                grade=grade,
                                citations=citations,
                                suggested_followups=parsed.get("suggested_followups") or [
                                    f"Em có muốn thử giải một bài tập mẫu về {subject} Lớp {grade} không?",
                                    "Em có thắc mắc nào về ví dụ trên không?",
                                    "Em muốn tìm hiểu thêm về bài học tiếp theo trong SGK?",
                                ],
                            )
                except Exception as e:
                    logger.warning(f"Thử mô hình Gemini {model_name} thất bại: {e}")

        raise RuntimeError("Không nhận được phản hồi từ Gemini AI.")

    @classmethod
    def _generate_fallback_reply(
        cls,
        user_message: str,
        subject: str,
        grade: int,
        student_name: str,
        chunks: List[Dict[str, Any]],
    ) -> ChatMessageResponse:
        """Rule-based / RAG Fallback Chat Response Generator."""
        
        if chunks:
            first_chunk = chunks[0]
            chapter_name = first_chunk["chapter"]
            lesson_name = first_chunk["lesson"]
            page_num = first_chunk["page_number"]
            doc_title = first_chunk["document_title"]
            content_snippet = first_chunk["content"]

            reply_text = (
                f"Chào **{student_name}**! Trợ lý Học tập AI đã tra cứu hệ thống Sách Giáo Khoa môn **{subject} Lớp {grade}** "
                f"và tìm thấy thông tin cho câu hỏi của em:\n\n"
                f"📌 **Nội dung cốt lõi ({lesson_name})**:\n"
                f"{content_snippet}\n\n"
                f"💡 **Hướng dẫn học tập chuẩn GDPT Lớp {grade}**:\n"
                f"- Để nắm chắc bài học này, em nên đọc kỹ lý thuyết và làm các bài tập tự luyện trong SGK {subject} Lớp {grade}.\n"
                f"- Nhớ áp dụng đúng công thức và quy tắc dành riêng cho học sinh Lớp {grade} nhé!"
            )

            citations = [
                SgkCitation(
                    document_title=doc_title,
                    chapter=chapter_name,
                    lesson=lesson_name,
                    page_number=page_num,
                    snippet=content_snippet[:150] + "..." if len(content_snippet) > 150 else content_snippet,
                )
            ]
        else:
            chapter_name = f"Chương trình chuẩn GDPT môn {subject} Lớp {grade}"
            lesson_name = f"Kiến thức trọng tâm môn {subject} Lớp {grade}"
            
            reply_text = (
                f"Chào **{student_name}**! Về câu hỏi *\"{user_message}\"* thuộc môn **{subject} Lớp {grade}**:\n\n"
                f"📖 **Giải thích kiến thức**:\n"
                f"Theo chương trình Sách giáo khoa {subject} Lớp {grade} (GDPT 2018), đây là kiến thức cơ bản trọng tâm. "
                f"Em cần lưu ý áp dụng đúng phương pháp giải dành riêng cho khối Lớp {grade}, chú ý các quy tắc tính toán và phân tích bài toán step-by-step.\n\n"
                f"✨ **Ví dụ trực quan**:\n"
                f"Hãy mở SGK môn {subject} Lớp {grade} để xem lại các hình vẽ minh họa và các ví dụ mẫu ở đầu bài học."
            )

            citations = [
                SgkCitation(
                    document_title=f"Sách giáo khoa {subject} Lớp {grade}",
                    chapter=chapter_name,
                    lesson=lesson_name,
                    page_number=None,
                    snippet=f"Kiến thức trọng tâm chương trình {subject} Lớp {grade} chuẩn bộ GD&ĐT.",
                )
            ]

        suggested_followups = [
            f"Cho em xin ví dụ bài tập cụ thể về nội dung này trong SGK {subject} Lớp {grade}?",
            f"Nhờ AI giải thích chi tiết hơn từng bước làm bài toán này?",
            f"Em muốn làm thử câu hỏi trắc nghiệm tự luyện về {subject} Lớp {grade}!",
        ]

        return ChatMessageResponse(
            reply=reply_text,
            subject=subject,
            grade=grade,
            citations=citations,
            suggested_followups=suggested_followups,
        )
