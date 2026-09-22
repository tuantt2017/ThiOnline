import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.document import Document, DocumentChunk
from app.models.question import (
    Question,
    QuestionDifficulty,
    QuestionOption,
    QuestionSource,
    QuestionStatus,
    QuestionType,
)
from app.schemas.ai import (
    AiGeneratedOption,
    AiGeneratedQuestionItem,
    AiQuestionGenerateRequest,
    AiQuestionGenerateResponse,
    ContextSourceInfo,
    KnowledgeSourceInfo,
)

logger = logging.getLogger(__name__)


def clean_math_notation(text: str) -> str:
    """
    Sanitizes raw AI math text to follow standard Vietnamese GDPT notation.
    - Replaces LaTeX operators (\\times, \\div, \\cdot, \\le, \\ge) with Unicode (×, :, ., ≤, ≥).
    - Converts \\frac{a}{b} -> a/b.
    - Removes raw LaTeX inline/display dollar delimiters ($...$, $$...$$) and stray $ signs.
    """
    if not text or not isinstance(text, str):
        return ""

    s = text

    # 1. Replace LaTeX operators with standard Vietnamese Math symbols
    s = re.sub(r'\\times\b', '×', s)
    s = re.sub(r'\\div\b', ':', s)
    s = re.sub(r'\\cdot\b', '.', s)
    s = re.sub(r'\\leq?\b', '≤', s)
    s = re.sub(r'\\geq?\b', '≥', s)
    s = re.sub(r'\\neq\b', '≠', s)
    s = re.sub(r'\\approx\b', '≈', s)
    s = re.sub(r'\\pm\b', '±', s)
    s = re.sub(r'\\degree\b|\\deg\b', '°', s)

    # 2. Fractions: \frac{a}{b} -> a/b
    def _frac_sub(m):
        n = m.group(1).strip()
        d = m.group(2).strip()
        if ' ' in n or '+' in n or '-' in n:
            n = f"({n})"
        if ' ' in d or '+' in d or '-' in d:
            d = f"({d})"
        return f"{n}/{d}"

    s = re.sub(r'\\frac\{([^{}]+)\}\{([^{}]+)\}', _frac_sub, s)

    # 3. Square roots: \sqrt{x} -> √(x)
    s = re.sub(r'\\sqrt\{([^{}]+)\}', r'√(\1)', s)

    # 4. Remove LaTeX dollar sign delimiters: $...$ or $$...$$
    s = re.sub(r'\$\$([^\$]+)\$\$', r'\1', s)
    s = re.sub(r'\$([^\$]+)\$', r'\1', s)

    # 5. Clean remaining stray dollar signs or stray backslashes before words
    s = s.replace('$', '')
    s = re.sub(r'\\([a-zA-Z]+)', r'\1', s)

    # 6. Normalize multiple spaces
    s = re.sub(r'  +', ' ', s)
    return s.strip()


class BackendQuestionValidator:
    """Validates raw question structures returned by AI against strict system invariants."""

    @staticmethod
    def validate_question(q_item: Dict[str, Any]) -> Tuple[bool, List[str]]:
        errors: List[str] = []

        q_text = str(q_item.get("question_text") or q_item.get("content") or "").strip()
        if not q_text:
            errors.append("Nội dung câu hỏi không được để trống.")

        options = q_item.get("options", [])
        if not isinstance(options, list) or len(options) != 4:
            errors.append(f"Câu hỏi phải chứa chính xác 4 phương án (nhận được {len(options) if isinstance(options, list) else 0}).")
        else:
            seen_keys = set()
            seen_texts = set()
            correct_count = 0

            for opt in options:
                if not isinstance(opt, dict):
                    errors.append("Phương án có định dạng không hợp lệ.")
                    continue

                key = str(opt.get("key") or "").strip().upper()
                text = str(opt.get("text") or opt.get("content") or "").strip()
                is_correct = bool(opt.get("is_correct"))

                if key not in {"A", "B", "C", "D"}:
                    errors.append(f"Mã phương án '{key}' phải là một trong các giá trị A, B, C, D.")
                if key in seen_keys:
                    errors.append(f"Trùng lặp mã phương án '{key}'.")
                seen_keys.add(key)

                if not text:
                    errors.append(f"Nội dung phương án {key} không được để trống.")

                if text.lower() in seen_texts:
                    errors.append(f"Trùng lặp nội dung giữa các phương án ('{text[:30]}').")
                seen_texts.add(text.lower())

                if is_correct:
                    correct_count += 1

            if correct_count != 1:
                errors.append(f"Câu hỏi phải chứa duy nhất 1 đáp án đúng (tìm thấy {correct_count} đáp án đúng).")

        explanation = str(q_item.get("explanation") or "").strip()
        if not explanation:
            errors.append("Lời giải / Giải thích không được để trống.")

        diff_str = str(q_item.get("difficulty") or "MEDIUM").strip().upper()
        if diff_str not in {"EASY", "MEDIUM", "HARD"}:
            errors.append(f"Độ khó '{diff_str}' không hợp lệ (chấp nhận EASY, MEDIUM, HARD).")

        is_valid = len(errors) == 0
        return is_valid, errors


class GeminiQuestionGenerator:
    """Service generating standardized curriculum-aligned multiple-choice questions via Google Gemini API."""

    @classmethod
    def is_gemini_configured(cls) -> bool:
        import os
        if os.environ.get("PYTEST_CURRENT_TEST") and not settings.RUN_LIVE_AI_TESTS:
            return False
        key = settings.GEMINI_API_KEY
        if not key:
            return False
        cleaned = key.strip()
        return bool(cleaned and cleaned != "your_gemini_api_key_here" and len(cleaned) > 10)

    @classmethod
    def generate_questions(
        cls,
        db: Session,
        req: AiQuestionGenerateRequest,
        user_id: int,
    ) -> AiQuestionGenerateResponse:
        """Main entrypoint for generating questions."""
        # 1. Fetch document context if document_id is provided
        doc_context_text = ""
        doc_obj: Optional[Document] = None
        if req.document_id:
            doc_obj = db.query(Document).filter(Document.id == req.document_id).first()
            if doc_obj:
                chunk_query = db.query(DocumentChunk).filter(DocumentChunk.document_id == req.document_id)
                
                selected_chapters = [c.strip() for c in (req.chapters or []) if c and c.strip()]
                if not selected_chapters and req.chapter:
                    selected_chapters = [req.chapter.strip()]

                selected_topics = [t.strip() for t in (req.topics or []) if t and t.strip()]
                if not selected_topics and req.lesson:
                    selected_topics = [req.lesson.strip()]

                chunks = []
                if selected_chapters or selected_topics:
                    from sqlalchemy import or_
                    filters = []
                    for ch in selected_chapters:
                        filters.append(DocumentChunk.chapter.ilike(f"%{ch}%"))
                    for tp in selected_topics:
                        filters.append(DocumentChunk.lesson.ilike(f"%{tp}%"))
                        filters.append(DocumentChunk.topic.ilike(f"%{tp}%"))
                    if filters:
                        chunks = chunk_query.filter(or_(*filters)).order_by(DocumentChunk.chunk_index).limit(15).all()

                if not chunks:
                    chunks = chunk_query.order_by(DocumentChunk.chunk_index).limit(15).all()

                if chunks:
                    doc_context_text = "\n\n".join(
                        f"[Phân đoạn {c.chunk_index} - Trang {c.page_number or '?'} - {c.chapter or ''} / {c.lesson or ''}]: {c.content}"
                        for c in chunks
                    )

        # 2. Call Gemini API or fallback generator
        raw_items: List[Dict[str, Any]] = []
        api_error: Optional[str] = None

        if cls.is_gemini_configured():
            try:
                raw_items = cls._call_gemini_api(req, doc_obj, doc_context_text)
            except Exception as e:
                logger.warning(f"Lỗi khi gọi Gemini API để tạo câu hỏi: {e}. Sử dụng bộ sinh dự phòng.")
                api_error = str(e)
                raw_items = cls._fallback_generate_questions(req, doc_context_text)
        else:
            raw_items = cls._fallback_generate_questions(req, doc_context_text)

        # 3. Process, validate and construct schema objects
        validated_questions: List[AiGeneratedQuestionItem] = []
        errors_summary: List[str] = []
        if api_error:
            errors_summary.append(f"Cảnh báo Gemini API: {api_error}")

        saved_count = 0

        for raw in raw_items:
            # Sanitize math notation in question text, options, and explanation
            q_text_clean = clean_math_notation(str(raw.get("question_text") or raw.get("content") or ""))
            expl_clean = clean_math_notation(str(raw.get("explanation") or ""))
            raw["question_text"] = q_text_clean
            raw["content"] = q_text_clean
            raw["explanation"] = expl_clean

            # Build options
            options_list: List[AiGeneratedOption] = []
            for opt_raw in raw.get("options", []):
                opt_text_clean = clean_math_notation(str(opt_raw.get("text") or opt_raw.get("content") or ""))
                opt_raw["text"] = opt_text_clean
                opt_raw["content"] = opt_text_clean
                options_list.append(
                    AiGeneratedOption(
                        key=str(opt_raw.get("key", "A")).upper(),
                        text=opt_text_clean,
                        is_correct=bool(opt_raw.get("is_correct")),
                    )
                )

            is_valid, val_errors = BackendQuestionValidator.validate_question(raw)

            diff_val = QuestionDifficulty.MEDIUM
            diff_str = str(raw.get("difficulty") or "MEDIUM").upper()
            if diff_str in QuestionDifficulty.__members__:
                diff_val = QuestionDifficulty[diff_str]

            k_source = None
            if doc_obj or raw.get("knowledge_source"):
                k_source = KnowledgeSourceInfo(
                    document_id=doc_obj.id if doc_obj else None,
                    document_title=(doc_obj.filename or doc_obj.title) if doc_obj else None,
                    chapter=req.chapter or raw.get("knowledge_source", {}).get("chapter"),
                    lesson=req.lesson or raw.get("knowledge_source", {}).get("lesson"),
                    page=raw.get("knowledge_source", {}).get("page"),
                )

            c_source = None
            if req.use_web_context and raw.get("context_source"):
                c_raw = raw.get("context_source", {})
                c_source = ContextSourceInfo(
                    type=c_raw.get("type", "web"),
                    title=c_raw.get("title", f"Tình huống thực tế môn {req.subject}"),
                    url=c_raw.get("url"),
                    summary=c_raw.get("summary"),
                )
            elif req.use_web_context:
                c_source = ContextSourceInfo(
                    type="web",
                    title=f"Bối cảnh ứng dụng thực tế GDPT Lớp {req.grade}",
                    summary="Tình huống áp dụng kiến thức vào cuộc sống thực tế",
                )

            item = AiGeneratedQuestionItem(
                question_text=q_text_clean,
                options=options_list,
                difficulty=diff_val,
                topic=req.topic or raw.get("topic"),
                learning_objective=raw.get("learning_objective"),
                explanation=expl_clean,
                knowledge_source=k_source,
                context_source=c_source,
                is_valid=is_valid,
                validation_errors=val_errors,
            )

            # Save valid questions as DRAFT in DB if requested
            if req.save_as_draft and is_valid:
                created_q = cls._save_question_to_db(db, item, req, user_id)
                if created_q:
                    item.created_question_id = created_q.id
                    saved_count += 1

            validated_questions.append(item)

        valid_count = sum(1 for q in validated_questions if q.is_valid)
        invalid_count = len(validated_questions) - valid_count

        return AiQuestionGenerateResponse(
            total_generated=len(validated_questions),
            valid_count=valid_count,
            invalid_count=invalid_count,
            saved_count=saved_count,
            questions=validated_questions,
            errors=errors_summary,
        )

    @classmethod
    def _call_gemini_api(
        cls,
        req: AiQuestionGenerateRequest,
        doc_obj: Optional[Document],
        doc_context_text: str,
    ) -> List[Dict[str, Any]]:
        """Invokes Google Gemini API with pedal-to-the-metal pedagogical prompt & JSON output mode."""
        api_key = settings.GEMINI_API_KEY.strip()
        models_to_try = [
            settings.GEMINI_MODEL_QUESTION_GEN,
            settings.GEMINI_MODEL,
            "gemini-3.8-flash",
            "gemini-3.5-flash",
            "gemini-2.5-flash",
            "gemini-flash-latest",
            "gemini-flash-lite-latest",
        ]
        models_to_try = list(dict.fromkeys([m.strip() for m in models_to_try if m and m.strip()]))

        web_grounding_instruction = ""
        if req.use_web_context:
            web_grounding_instruction = """
- AI GROUNDING RULE (BỐI CẢNH THỰC TẾ):
  - Hãy kết hợp các tình huống thực tế đời sống sinh động (ví dụ: bài toán mua sắm khuyến mãi, số liệu môi trường, khoa học thực tiễn, hiện tượng tự nhiên...).
  - TUYỆT ĐỐI KHÔNG để bối cảnh thực tế làm thay đổi hoặc vượt quá phạm vi kiến thức chuẩn của Lớp """ + str(req.grade) + """.
  - Trong từng câu hỏi, ghi kèm "context_source": {"type": "web", "title": "Tên tình huống thực tế..."}
"""
        else:
            web_grounding_instruction = """
- Không dùng bối cảnh web ngoài SGK. Tập trung hoàn toàn vào lý thuyết và dạng bài tập thuần túy của SGK.
"""

        doc_instruction = ""
        if doc_context_text:
            doc_instruction = f"""
--- TÀI LIỆU SGK THAM CHIẾU (DOCUMENT CONTEXT) ---
{doc_context_text[:12000]}
--- HẾT TÀI LIỆU SGK ---
"""

        chapter_str = ", ".join(req.chapters) if (req.chapters and len(req.chapters) > 0) else (req.chapter or 'Tổng hợp kiến thức')
        lesson_str = ", ".join(req.topics) if (req.topics and len(req.topics) > 0) else (req.lesson or req.topic or 'Tất cả các bài học')

        prompt = f"""Bạn là Chuyên gia biên soạn Đề thi và Đánh giá Giáo dục theo chương trình GDPT 2018 Bộ Giáo dục & Đào tạo Việt Nam.

NHIỆM VỤ:
Tạo danh sách {req.count} câu hỏi trắc nghiệm chuẩn hóa 4 lựa chọn (Single-Choice Multiple Choice) dành cho:
- Môn học: {req.subject}
- Khối lớp: Lớp {req.grade}
- Các Chương / Đầu mục được chọn: {chapter_str}
- Các Bài học / Chủ đề con được chọn: {lesson_str}
- Tỷ lệ độ khó yêu cầu: Dễ {req.difficulty_distribution.easy}%, Trung bình {req.difficulty_distribution.medium}%, Khó {req.difficulty_distribution.hard}%.

QUY TẮC BẮT BUỘC:
1. Mỗi câu hỏi PHẢI CÓ CHÍNH XÁC 4 PHƯƠNG ÁN A, B, C, D.
2. CHỈ CÓ DUY NHẤT 1 ĐÁP ÁN ĐÚNG (`"is_correct": true`). Các phương án còn lại là `"is_correct": false`.
3. Phải có Lời giải / Giải thích chi tiết (`explanation`) giải thích rõ vì sao đáp án đúng và vì sao các phương án khác sai.
5. QUY TẮC BẮT BUỘC VỀ KÝ HIỆU TOÁN HỌC (ĐẶC BIỆT MÔN TOÁN GDPT VIỆT NAM):
   - KHÔNG DÙNG MÃ LATEX '\\times', '\\div', '\\cdot'. Phép nhân phải viết bằng ký hiệu Unicode '×', phép chia viết bằng ':' hoặc '÷'.
   - TUYỆT ĐỐI KHÔNG bao quanh các biểu thức/công thức toán bằng các dấu '$' hoặc '$$' (Ví dụ: Viết 'A = a × 4 + b : 2 - c' chứ KHÔNG được viết '$A = a \\times 4 + b : 2 - c$').
   - Phân số viết dạng 'a/b' hoặc '(a+b)/c'. Ký hiệu so sánh dùng '≤', '≥', '≠'.
{web_grounding_instruction}
{doc_instruction}

ĐỊNH DẠNG TRẢ VỀ:
CHỈ trả về DUY NHẤT một chuỗi JSON hợp lệ theo cấu trúc sau (không thêm bất kỳ văn bản giải thích nào bên ngoài):
[
  {{
    "question_text": "Nội dung câu hỏi...",
    "difficulty": "EASY",
    "topic": "Tên bài học / chủ đề",
    "learning_objective": "Mục tiêu cần đạt...",
    "explanation": "Lời giải chi tiết...",
    "options": [
      {{"key": "A", "text": "Phương án A", "is_correct": false}},
      {{"key": "B", "text": "Phương án B", "is_correct": true}},
      {{"key": "C", "text": "Phương án C", "is_correct": false}},
      {{"key": "D", "text": "Phương án D", "is_correct": false}}
    ],
    "context_source": {{
      "type": "web",
      "title": "Ứng dụng thực tế bài toán..."
    }}
  }}
]
"""

        with httpx.Client(timeout=45.0) as client:
            for model_name in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.4,
                        "responseMimeType": "application/json",
                    },
                }
                try:
                    resp = client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            text_content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                            cleaned = re.sub(r"^```(?:json)?\s*", "", text_content.strip())
                            cleaned = re.sub(r"\s*```$", "", cleaned.strip())
                            parsed = json.loads(cleaned)
                            if isinstance(parsed, list):
                                return parsed
                            elif isinstance(parsed, dict) and "questions" in parsed:
                                return parsed["questions"]
                    else:
                        logger.warning(f"Gemini API ({model_name}) error {resp.status_code}: {resp.text[:200]}")
                except Exception as e:
                    logger.warning(f"Gemini API call ({model_name}) failed: {e}")

        raise RuntimeError(f"Không thể kết nối Gemini API qua các mô hình: {', '.join(models_to_try)}")

    @classmethod
    def _fallback_generate_questions(
        cls,
        req: AiQuestionGenerateRequest,
        doc_context_text: str,
    ) -> List[Dict[str, Any]]:
        """Generates realistic curriculum questions when Gemini API is offline or unconfigured."""
        items: List[Dict[str, Any]] = []
        count = min(req.count, 20)

        diff_pool = []
        easy_n = max(1, int(count * (req.difficulty_distribution.easy / 100)))
        hard_n = int(count * (req.difficulty_distribution.hard / 100))
        med_n = count - easy_n - hard_n

        diff_pool.extend(["EASY"] * easy_n)
        diff_pool.extend(["MEDIUM"] * max(0, med_n))
        diff_pool.extend(["HARD"] * hard_n)

        # Pad to count
        while len(diff_pool) < count:
            diff_pool.append("MEDIUM")

        # Subject templates
        if "Toán" in req.subject:
            templates = [
                {
                    "content": f"Cho bài toán thực tế: Một cửa hàng giảm giá 15% cho mặt hàng cặp sách có giá niêm yết 200.000 đồng. Số tiền người mua được giảm là:",
                    "diff": "EASY",
                    "topic": "Tỉ số phần trăm và ứng dụng",
                    "obj": "Tính được giá trị phần trăm của một số trong thực tiễn.",
                    "expl": "Số tiền được giảm là: 200.000 x 15% = 30.000 (đồng). Chọn B.",
                    "opts": [
                        {"key": "A", "text": "15.000 đồng", "is_correct": False},
                        {"key": "B", "text": "30.000 đồng", "is_correct": True},
                        {"key": "C", "text": "170.000 đồng", "is_correct": False},
                        {"key": "D", "text": "35.000 đồng", "is_correct": False},
                    ],
                },
                {
                    "content": f"Trung bình cộng số bước chân học sinh đi bộ đến trường trong 3 ngày đầu tuần lần lượt là 2.500, 3.100 và 2.800 bước. Trung bình mỗi ngày học sinh đi được bao nhiêu bước?",
                    "diff": "MEDIUM",
                    "topic": "Số trung bình cộng",
                    "obj": "Giải bài toán tìm số trung bình cộng trong chuỗi thống kê đơn giản.",
                    "expl": "Trung bình cộng = (2.500 + 3.100 + 2.800) / 3 = 8.400 / 3 = 2.800 (bước). Chọn A.",
                    "opts": [
                        {"key": "A", "text": "2.800 bước", "is_correct": True},
                        {"key": "B", "text": "2.700 bước", "is_correct": False},
                        {"key": "C", "text": "2.900 bước", "is_correct": False},
                        {"key": "D", "text": "8.400 bước", "is_correct": False},
                    ],
                },
                {
                    "content": f"Một mảnh vườn hình chữ nhật có chiều dài 15 m và chiều rộng 8 m. Người ta dùng 20% diện tích đất để trồng hoa. Diện tích đất trồng hoa là:",
                    "diff": "HARD",
                    "topic": "Diện tích hình chữ nhật & Tỉ số phần trăm",
                    "obj": "Vận dụng công thức diện tích và tỉ số phần trăm giải bài toán thực tế.",
                    "expl": "Diện tích mảnh vườn = 15 x 8 = 120 m². Diện tích trồng hoa = 120 x 20% = 24 m². Chọn C.",
                    "opts": [
                        {"key": "A", "text": "12 m²", "is_correct": False},
                        {"key": "B", "text": "18 m²", "is_correct": False},
                        {"key": "C", "text": "24 m²", "is_correct": True},
                        {"key": "D", "text": "96 m²", "is_correct": False},
                    ],
                },
            ]
        else:
            templates = [
                {
                    "content": f"Trong môi trường tự nhiên, quá trình quang hợp của cây xanh hấp thụ khí nào và giải phóng khí nào?",
                    "diff": "EASY",
                    "topic": "Sự quang hợp ở thực vật",
                    "obj": "Nêu được vai trò và sản phẩm của quá trình quang hợp ở cây xanh.",
                    "expl": "Trong quá trình quang hợp dưới ánh sáng, cây hấp thụ khí Cacbonic (CO2) và giải phóng khí Ôxi (O2). Chọn C.",
                    "opts": [
                        {"key": "A", "text": "Hấp thụ Ôxi, giải phóng Cacbonic", "is_correct": False},
                        {"key": "B", "text": "Hấp thụ Nitơ, giải phóng Ôxi", "is_correct": False},
                        {"key": "C", "text": "Hấp thụ Cacbonic, giải phóng Ôxi", "is_correct": True},
                        {"key": "D", "text": "Hấp thụ Hơi nước, giải phóng Nitơ", "is_correct": False},
                    ],
                },
                {
                    "content": f"Từ nào sau đây là từ ghép tổng hợp trong tiếng Việt?",
                    "diff": "MEDIUM",
                    "topic": "Từ ghép và từ phân loại",
                    "obj": "Phân biệt được từ ghép tổng hợp và từ ghép phân loại.",
                    "expl": "'Sách vở' là từ ghép tổng hợp chỉ chung các loại sách và vở học tập. Chọn A.",
                    "opts": [
                        {"key": "A", "text": "Sách vở", "is_correct": True},
                        {"key": "B", "text": "Sách Toán", "is_correct": False},
                        {"key": "C", "text": "Xe đạp", "is_correct": False},
                        {"key": "D", "text": "Hoa hồng", "is_correct": False},
                    ],
                },
            ]

        for i in range(count):
            tpl = templates[i % len(templates)]
            diff = diff_pool[i] if i < len(diff_pool) else tpl["diff"]
            items.append({
                "question_text": f"[{req.subject} Lớp {req.grade}] {tpl['content']} (Câu AI #{i+1})",
                "difficulty": diff,
                "topic": req.topic or req.chapter or tpl["topic"],
                "learning_objective": tpl["obj"],
                "explanation": tpl["expl"],
                "options": tpl["opts"],
                "context_source": {
                    "type": "web" if req.use_web_context else "textbook",
                    "title": f"Bối cảnh bài tập thực tế GDPT Lớp {req.grade}",
                },
            })

        return items

    @classmethod
    def _save_question_to_db(
        cls,
        db: Session,
        item: AiGeneratedQuestionItem,
        req: AiQuestionGenerateRequest,
        user_id: int,
    ) -> Optional[Question]:
        """Saves validated AI question to the database under DRAFT/REVIEW status."""
        try:
            q_db = Question(
                content=item.question_text,
                question_type=QuestionType.MULTIPLE_CHOICE_SINGLE,
                difficulty=item.difficulty,
                status=QuestionStatus.REVIEW,  # AI questions require teacher review
                source=QuestionSource.AI_GENERATED,
                subject=req.subject,
                grade=req.grade,
                chapter=req.chapter or (item.knowledge_source.chapter if item.knowledge_source else None),
                lesson=req.lesson or (item.knowledge_source.lesson if item.knowledge_source else None),
                topic=item.topic,
                learning_objective=item.learning_objective,
                explanation=item.explanation,
                document_id=req.document_id,
                created_by_id=user_id,
            )
            db.add(q_db)
            db.flush()

            for idx, opt in enumerate(item.options):
                db_opt = QuestionOption(
                    question_id=q_db.id,
                    option_key=opt.key,
                    content=opt.text,
                    is_correct=opt.is_correct,
                    order_index=idx,
                )
                db.add(db_opt)

            db.commit()
            db.refresh(q_db)
            return q_db
        except Exception as e:
            db.rollback()
            logger.error(f"Lỗi khi lưu câu hỏi AI vào CSDL: {e}")
            return None
