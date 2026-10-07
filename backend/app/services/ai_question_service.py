import json
import logging
import random
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
    - Removes LaTeX digit space commands (\\, \\; \\: \\! \\ ) e.g. 400\\,000 -> 400 000.
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

    # 2. Replace LaTeX spacing commands (\, \; \: \! \ ) e.g. 400\,000 -> 400 000
    s = re.sub(r'\\,', ' ', s)
    s = re.sub(r'\\([;:!])', ' ', s)
    s = re.sub(r'\\ ', ' ', s)

    # 3. Fractions: \frac{a}{b} -> a/b
    def _frac_sub(m):
        n = m.group(1).strip()
        d = m.group(2).strip()
        if ' ' in n or '+' in n or '-' in n:
            n = f"({n})"
        if ' ' in d or '+' in d or '-' in d:
            d = f"({d})"
        return f"{n}/{d}"

    s = re.sub(r'\\frac\{([^{}]+)\}\{([^{}]+)\}', _frac_sub, s)

    # 4. Square roots: \sqrt{x} -> √(x)
    s = re.sub(r'\\sqrt\{([^{}]+)\}', r'√(\1)', s)

    # 5. Remove LaTeX dollar sign delimiters: $...$ or $$...$$
    s = re.sub(r'\$\$([^\$]+)\$\$', r'\1', s)
    s = re.sub(r'\$([^\$]+)\$', r'\1', s)

    # 6. Clean remaining stray dollar signs or stray backslashes
    s = s.replace('$', '')
    s = re.sub(r'\\([a-zA-Z]+)', r'\1', s)
    s = re.sub(r'\\([#$%&_{}])', r'\1', s)
    s = s.replace('\\', '')

    # 7. Normalize multiple spaces
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

        # Fetch recent questions from DB/exams to avoid duplicates in newly generated questions
        existing_sample_qs = (
            db.query(Question.content)
            .filter(
                Question.subject == req.subject,
                Question.grade == req.grade,
            )
            .order_by(Question.created_at.desc())
            .limit(10)
            .all()
        )
        existing_q_texts = [q[0][:120].strip() for q in existing_sample_qs if q[0]]

        if cls.is_gemini_configured():
            try:
                raw_items = cls._call_gemini_api(req, doc_obj, doc_context_text, existing_q_texts)
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
        existing_q_texts: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Invokes Google Gemini API with pedal-to-the-metal pedagogical prompt & JSON output mode."""
        api_key = settings.GEMINI_API_KEY.strip()
        models_to_try = [
            settings.GEMINI_MODEL_QUESTION_GEN,
            settings.GEMINI_MODEL,
            "gemini-2.5-flash",
            "gemini-3.6-flash",
            "gemini-3.7-flash",
            "gemini-3.5-flash-lite",
            "gemini-flash-lite-latest",
            "gemini-3.5-flash",
            "gemini-3.8-flash",
            "gemini-flash-latest",
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

        avoid_duplicate_instruction = ""
        if existing_q_texts:
            sample_list = "\n".join(f"- {txt}" for txt in existing_q_texts[:8])
            avoid_duplicate_instruction = f"""
- QUY TẮC TRÁNH TRÙNG LẶP CÂU HỎI ĐÃ CÓ TRONG HỆ THỐNG / ĐỀ THI:
  Hệ thống đã có một số câu hỏi trước đây môn {req.subject} Lớp {req.grade}:
{sample_list}
  TUYỆT ĐỐI KHÔNG sinh lại các câu hỏi này hoặc tương tự. Hãy tạo các câu hỏi MỚI với ngữ cảnh và dữ liệu mới hoàn toàn!
"""

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
   - TUYỆT ĐỐI KHÔNG dùng mã '\\,' hay mã khoảng trắng LaTeX trong các số chục nghìn, trăm nghìn, triệu (Ví dụ: Viết '400 000' hoặc '400000', KHÔNG được viết '400\\,000' hay '9\\,600\\,000').
   - Phân số viết dạng 'a/b' hoặc '(a+b)/c'. Ký hiệu so sánh dùng '≤', '≥', '≠'.
{web_grounding_instruction}
{doc_instruction}
{avoid_duplicate_instruction}

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
                            cleaned = re.sub(r"^```(?:json)?\s*", "", text_content.strip(), flags=re.IGNORECASE)
                            cleaned = re.sub(r"\s*```$", "", cleaned.strip())
                            
                            parsed = None
                            try:
                                parsed = json.loads(cleaned)
                            except Exception:
                                match_obj = re.search(r"(\{.*\}|\[.*\])", cleaned, re.DOTALL)
                                if match_obj:
                                    raw_json = match_obj.group(1).strip()
                                    try:
                                        parsed = json.loads(raw_json)
                                    except Exception:
                                        fixed_json = re.sub(r",\s*([\}\]])", r"\1", raw_json)
                                        try:
                                            parsed = json.loads(fixed_json)
                                        except Exception:
                                            pass

                            if isinstance(parsed, list):
                                return parsed
                            elif isinstance(parsed, dict) and "questions" in parsed:
                                return parsed["questions"]
                    else:
                        logger.warning(f"Gemini API ({model_name}) error {resp.status_code}: {resp.text[:200]}")
                except Exception as e:
                    logger.warning(f"Gemini API call ({model_name}) failed: {e}")

        raise RuntimeError(f"Không thể kết nối Gemini API qua các mô hình: {', '.join(models_to_try)}")


    @staticmethod
    def _normalize_subject(sub: str) -> str:
        s = (sub or "").lower()
        if any(k in s for k in ["sử", "địa", "lịch sử", "địa lí", "địa lý"]):
            return "LICH_SU_DIA_LI"
        if any(k in s for k in ["tiếng việt", "ngữ văn", "văn học"]):
            return "TIENG_VIET"
        if any(k in s for k in ["toán", "toan", "hình học", "đại số"]):
            return "TOAN"
        if any(k in s for k in ["khoa học", "khtn", "sinh học", "vật lí", "vật lý", "hóa học"]):
            return "KHOA_HOC"
        if any(k in s for k in ["tiếng anh", "anh văn", "english"]):
            return "TIENG_ANH"
        if any(k in s for k in ["tin học", "tin hoc", "công nghệ thông tin"]):
            return "TIN_HOC"
        if any(k in s for k in ["đạo đức", "gdcd", "giáo dục công dân", "kinh tế và pháp luật"]):
            return "DAO_DUC"
        if any(k in s for k in ["công nghệ", "kĩ thuật", "kỹ thuật"]):
            return "CONG_NGHE"
        return "CHUNG"

    @staticmethod
    def _generate_parametric_math_question(idx: int, diff: str) -> Dict[str, Any]:
        q_type = idx % 6
        if q_type == 0:
            base_price = random.choice([120, 150, 180, 200, 240, 250, 300, 350, 400, 500]) * 1000
            pct = random.choice([10, 15, 20, 25, 30])
            discount = int(base_price * pct / 100)
            pay_price = base_price - discount
            item_name = random.choice(["chiếc cặp sách", "bộ đồng phục học sinh", "bộ sách tham khảo", "chiếc đèn bàn học", "đôi giày thể thao"])
            content = f"Một cửa hàng văn phòng phẩm niêm yết giá một {item_name} là {base_price:,} đồng và đang có chương trình khuyến mãi giảm giá {pct}%. Số tiền khách hàng được giảm khi mua mặt hàng này là:".replace(",", ".")
            correct_val = f"{discount:,} đồng".replace(",", ".")
            wrong_vals = [
                f"{pay_price:,} đồng".replace(",", "."),
                f"{int(discount * 0.8):,} đồng".replace(",", "."),
                f"{int(discount * 1.2):,} đồng".replace(",", "."),
            ]
            topic = "Tỉ số phần trăm và ứng dụng thực tế"
            obj = "Tính được giá trị phần trăm của một số trong tình huống mua sắm thực tiễn."
            expl = f"Số tiền được giảm là: {base_price:,} × {pct}% = {discount:,} (đồng).".replace(",", ".")
        elif q_type == 1:
            num_diff = random.choice([12, 14, 16, 18, 20, 22, 24, 26, 28, 30])
            small = random.randint(25, 60)
            big = small + num_diff
            total = big + small
            content = f"Tổng của hai số tự nhiên là {total} và hiệu của hai số đó là {num_diff}. Số lớn trong hai số đó là:"
            correct_val = str(big)
            wrong_vals = [str(small), str(big + 10), str(small - 10)]
            topic = "Tìm hai số khi biết tổng và hiệu"
            obj = "Vận dụng công thức tìm số lớn = (tổng + hiệu) : 2."
            expl = f"Số lớn = ({total} + {num_diff}) : 2 = {big}. Số bé = {small}."
        elif q_type == 2:
            length = random.randint(15, 30)
            width = random.randint(6, 12)
            area = length * width
            perimeter = 2 * (length + width)
            content = f"Một khu vườn thực nghiệm hình chữ nhật có chiều dài {length} m và chiều rộng {width} m. Diện tích của khu vườn đó là:"
            correct_val = f"{area} m²"
            wrong_vals = [f"{perimeter} m²", f"{area - 20} m²", f"{area + 20} m²"]
            topic = "Diện tích hình chữ nhật"
            obj = "Vận dụng công thức tính diện tích hình chữ nhật."
            expl = f"Diện tích khu vườn = {length} × {width} = {area} m²."
        elif q_type == 3:
            step1 = random.choice([2400, 2600, 2800, 3000])
            step2 = random.choice([2500, 2700, 2900, 3100])
            step3 = random.choice([2600, 2800, 3000, 3200])
            avg = (step1 + step2 + step3) // 3
            content = f"Số bước chân của bạn Nam đi bộ trong ba ngày lần lượt là {step1:,}, {step2:,} và {step3:,} bước. Trung bình mỗi ngày bạn Nam đi được số bước chân là:".replace(",", ".")
            correct_val = f"{avg:,} bước".replace(",", ".")
            wrong_vals = [f"{avg - 200:,} bước".replace(",", "."), f"{avg + 200:,} bước".replace(",", "."), f"{step1 + step2 + step3:,} bước".replace(",", ".")]
            topic = "Số trung bình cộng"
            obj = "Tính số trung bình cộng trong chuỗi số liệu thực tế."
            expl = f"Trung bình mỗi ngày = ({step1:,} + {step2:,} + {step3:,}) : 3 = {avg:,} (bước).".replace(",", ".")
        elif q_type == 4:
            ton = random.randint(2, 7)
            ta = random.randint(3, 8)
            kg = ton * 1000 + ta * 100
            content = f"Đổi {ton} tấn {ta} tạ ra đơn vị ki-lô-gam (kg), kết quả đúng là:"
            correct_val = f"{kg:,} kg".replace(",", ".")
            wrong_vals = [f"{ton * 100 + ta * 10:,} kg".replace(",", "."), f"{ton * 1000 + ta * 10:,} kg".replace(",", "."), f"{kg + 500:,} kg".replace(",", ".")]
            topic = "Bảng đơn vị đo khối lượng"
            obj = "Chuyển đổi thành thạo các đơn vị đo khối lượng tấn, tạ sang kg."
            expl = f"{ton} tấn = {ton * 1000} kg; {ta} tạ = {ta * 100} kg. Tổng cộng = {kg:,} kg.".replace(",", ".")
        else:
            a = random.choice([1, 2])
            b = 7
            c = random.choice([3, 4])
            res_num = a + c
            content = f"Thực hiện phép tính cộng phân số: {a}/{b} + {c}/{b} = ?"
            correct_val = f"{res_num}/{b}"
            used = {correct_val}
            wrong_vals = []
            candidates = [f"{res_num}/{b * 2}", f"{abs(a - c) + 1}/{b}", f"{res_num + 2}/{b}", f"{res_num - 1}/{b}", f"1/{b}"]
            for cand in candidates:
                if cand not in used:
                    used.add(cand)
                    wrong_vals.append(cand)
                    if len(wrong_vals) == 3:
                        break
            topic = "Phép cộng phân số cùng mẫu số"
            obj = "Thực hiện phép cộng hai phân số cùng mẫu số."
            expl = f"Muốn cộng hai phân số cùng mẫu số, ta cộng hai tử số và giữ nguyên mẫu số: ({a} + {c})/{b} = {res_num}/{b}."

        all_opts = [{"text": correct_val, "is_correct": True}] + [{"text": w, "is_correct": False} for w in wrong_vals]
        random.shuffle(all_opts)
        opts = []
        for i, o in enumerate(all_opts):
            opts.append({"key": chr(65 + i), "text": o["text"], "is_correct": o["is_correct"]})

        correct_key = next(o["key"] for o in opts if o["is_correct"])
        return {
            "content": content,
            "diff": diff,
            "topic": topic,
            "obj": obj,
            "expl": f"Chọn {correct_key}. {expl}",
            "opts": opts,
        }

    @classmethod
    def _fallback_generate_questions(
        cls,
        req: AiQuestionGenerateRequest,
        doc_context_text: str,
    ) -> List[Dict[str, Any]]:
        """Generates realistic curriculum questions when Gemini API is offline or unconfigured."""
        items: List[Dict[str, Any]] = []
        count = min(req.count, 20)
        sub_cat = cls._normalize_subject(req.subject)

        diff_pool = []
        easy_n = max(1, int(count * (req.difficulty_distribution.easy / 100)))
        hard_n = int(count * (req.difficulty_distribution.hard / 100))
        med_n = count - easy_n - hard_n

        diff_pool.extend(["EASY"] * easy_n)
        diff_pool.extend(["MEDIUM"] * max(0, med_n))
        diff_pool.extend(["HARD"] * hard_n)

        while len(diff_pool) < count:
            diff_pool.append("MEDIUM")
        diff_pool = diff_pool[:count]
        random.shuffle(diff_pool)

        if sub_cat == "TOAN":
            for i in range(count):
                diff = diff_pool[i]
                q_data = cls._generate_parametric_math_question(i, diff)
                items.append({
                    "question_text": q_data["content"],
                    "difficulty": diff,
                    "topic": req.topic or req.chapter or q_data["topic"],
                    "learning_objective": q_data["obj"],
                    "explanation": q_data["expl"],
                    "options": q_data["opts"],
                    "context_source": {
                        "type": "web" if req.use_web_context else "textbook",
                        "title": f"Bối cảnh bài tập thực tế GDPT Lớp {req.grade}",
                    },
                })
            return items

        # Subject template repositories
        lich_su_dia_li_templates = [
            {
                "content": "Vua Lý Thái Tổ quyết định dời đô từ Hoa Lư về Thăng Long vào mùa thu năm nào?",
                "diff": "EASY",
                "topic": "Thăng Long - Hà Nội",
                "obj": "Nhớ được mốc thời gian Lý Thái Tổ dời đô về Thăng Long.",
                "expl": "Mùa thu năm Canh Tuất (1010), vua Lý Thái Tổ quyết định dời đô từ Hoa Lư về thành Đại La và đổi tên là Thăng Long.",
                "opts": [
                    {"text": "Năm 1010", "is_correct": True},
                    {"text": "Năm 938", "is_correct": False},
                    {"text": "Năm 1288", "is_correct": False},
                    {"text": "Năm 1789", "is_correct": False},
                ],
            },
            {
                "content": "Khu di tích Văn Miếu - Quốc Tử Giám ở Hà Nội có ý nghĩa lịch sử đặc biệt nào đối với nền giáo dục Việt Nam?",
                "diff": "EASY",
                "topic": "Thăng Long - Hà Nội",
                "obj": "Biết được vai trò lịch sử của Văn Miếu - Quốc Tử Giám.",
                "expl": "Văn Miếu - Quốc Tử Giám được xây dựng dưới thời nhà Lý và được coi là trường đại học đầu tiên của Việt Nam.",
                "opts": [
                    {"text": "Được coi là trường đại học đầu tiên của Việt Nam", "is_correct": True},
                    {"text": "Là nơi ở chính thức của các vị vua triều Nguyễn", "is_correct": False},
                    {"text": "Là thương cảng quốc tế sầm uất nhất thời phong kiến", "is_correct": False},
                    {"text": "Là căn cứ kháng chiến chống thực dân Pháp", "is_correct": False},
                ],
            },
            {
                "content": "Hệ thống đê điều dọc theo các con sông ở vùng Đồng bằng Bắc Bộ có vai trò quan trọng nhất là gì?",
                "diff": "MEDIUM",
                "topic": "Vùng Đồng bằng Bắc Bộ",
                "obj": "Hiểu được vai trò của hệ thống đê sông Hồng.",
                "expl": "Hệ thống đê điều ở Đồng bằng Bắc Bộ có vai trò chính là ngăn lũ lụt, bảo vệ tính mạng, mùa màng và xóm làng của người dân.",
                "opts": [
                    {"text": "Ngăn lũ lụt từ sông ngòi, bảo vệ mùa màng và đời sống nhân dân", "is_correct": True},
                    {"text": "Ngăn nước biển mặn tràn sâu vào đất liền", "is_correct": False},
                    {"text": "Làm đường băng cho các phương tiện giao thông", "is_correct": False},
                    {"text": "Giữ cát sỏi phục vụ khai thác công nghiệp", "is_correct": False},
                ],
            },
            {
                "content": "Làng nghề gốm sứ truyền thống nổi tiếng lâu đời nằm ven sông Hồng thuộc thành phố Hà Nội là làng nào?",
                "diff": "EASY",
                "topic": "Vùng Đồng bằng Bắc Bộ",
                "obj": "Nhận biết làng nghề truyền thống Bát Tràng.",
                "expl": "Làng gốm Bát Tràng (Gia Lâm, Hà Nội) là làng nghề gốm sứ truyền thống nức tiếng ven sông Hồng có lịch sử hàng trăm năm.",
                "opts": [
                    {"text": "Làng gốm Bát Tràng", "is_correct": True},
                    {"text": "Làng lụa Vạn Phúc", "is_correct": False},
                    {"text": "Làng đúc đồng Ngũ Xã", "is_correct": False},
                    {"text": "Làng tranh Đông Hồ", "is_correct": False},
                ],
            },
            {
                "content": "Loại đất chiếm diện tích lớn nhất và có độ phì nhiêu màu mỡ cao nhất ở vùng Tây Nguyên là loại đất nào?",
                "diff": "EASY",
                "topic": "Vùng Tây Nguyên",
                "obj": "Nhận biết đặc điểm đất đỏ ba-dan Tây Nguyên.",
                "expl": "Đất đỏ ba-dan màu mỡ, tầng đất dày rất thích hợp trồng các loại cây công nghiệp lâu năm ở Tây Nguyên.",
                "opts": [
                    {"text": "Đất đỏ ba-dan", "is_correct": True},
                    {"text": "Đất phù sa ngọt ven sông", "is_correct": False},
                    {"text": "Đất phèn, đất mặn", "is_correct": False},
                    {"text": "Đất cát pha ven biển", "is_correct": False},
                ],
            },
            {
                "content": "Cây công nghiệp lâu năm được trồng nhiều nhất và mang lại giá trị xuất khẩu hàng đầu ở vùng Tây Nguyên là:",
                "diff": "EASY",
                "topic": "Vùng Tây Nguyên",
                "obj": "Nêu được cây trồng chủ lực của Tây Nguyên.",
                "expl": "Tây Nguyên là thủ phủ cà phê lớn nhất Việt Nam, đặc biệt là tỉnh Đắk Lắk với thương hiệu cà phê Buôn Ma Thuột nổi tiếng.",
                "opts": [
                    {"text": "Cây cà phê", "is_correct": True},
                    {"text": "Cây lúa nước", "is_correct": False},
                    {"text": "Cây mía đường", "is_correct": False},
                    {"text": "Cây sen lấy hạt", "is_correct": False},
                ],
            },
            {
                "content": "Di sản văn hóa phi vật thể tiêu biểu của đồng bào các dân tộc vùng Tây Nguyên được UNESCO công nhận là:",
                "diff": "MEDIUM",
                "topic": "Văn hóa Tây Nguyên",
                "obj": "Biết được giá trị Không gian văn hóa Cồng chiêng Tây Nguyên.",
                "expl": "Không gian văn hóa Cồng chiêng Tây Nguyên được UNESCO công nhận là Kiệt tác truyền khẩu và di sản phi vật thể nhân loại.",
                "opts": [
                    {"text": "Không gian văn hóa Cồng chiêng Tây Nguyên", "is_correct": True},
                    {"text": "Hát xoan Phú Thọ", "is_correct": False},
                    {"text": "Nhã nhạc cung đình Huế", "is_correct": False},
                    {"text": "Đờn ca tài tử Nam Bộ", "is_correct": False},
                ],
            },
            {
                "content": "Hội đua voi truyền thống độc đáo là nét sinh hoạt văn hóa đặc sắc của đồng bào các dân tộc tại địa phương nào ở Tây Nguyên?",
                "diff": "MEDIUM",
                "topic": "Văn hóa Tây Nguyên",
                "obj": "Biết lễ hội đua voi ở Buôn Đôn.",
                "expl": "Hội đua voi diễn ra vào mùa xuân tại Buôn Đôn (Đắk Lắk), thể hiện tinh thần thượng võ và sự gắn bó giữa con người với voi rừng được thuần dưỡng.",
                "opts": [
                    {"text": "Buôn Đôn (tỉnh Đắk Lắk)", "is_correct": True},
                    {"text": "Đà Lạt (tỉnh Lâm Đồng)", "is_correct": False},
                    {"text": "Pleiku (tỉnh Gia Lai)", "is_correct": False},
                    {"text": "Kon Tum (tỉnh Kon Tum)", "is_correct": False},
                ],
            },
            {
                "content": "Quần thể di tích Cố đô Huế gắn liền với dòng sông thơ mộng nào và từng là kinh đô của triều đại nào trong lịch sử Việt Nam?",
                "diff": "EASY",
                "topic": "Vùng Duyên hải miền Trung",
                "obj": "Nhận biết Cố đô Huế, sông Hương và triều Nguyễn.",
                "expl": "Cố đô Huế nằm ven dòng sông Hương êm đềm, là kinh đô của triều Nguyễn từ năm 1802 đến năm 1945.",
                "opts": [
                    {"text": "Sông Hương - Triều đại nhà Nguyễn", "is_correct": True},
                    {"text": "Sông Hồng - Triều đại nhà Lý", "is_correct": False},
                    {"text": "Sông Mã - Triều đại nhà Hậu Lê", "is_correct": False},
                    {"text": "Sông Hàn - Triều đại nhà Trần", "is_correct": False},
                ],
            },
            {
                "content": "Vào mùa hạ, khu vực Duyên hải miền Trung thường chịu ảnh hưởng của loại gió nào gây ra hiện tượng thời tiết khô và rất nóng?",
                "diff": "MEDIUM",
                "topic": "Vùng Duyên hải miền Trung",
                "obj": "Hiểu được đặc điểm gió Tây Nam khô nóng ở miền Trung.",
                "expl": "Gió mùa Tây Nam khi vượt qua dãy Trường Sơn bị biến tính trở nên khô và rất nóng (hiệu ứng phơn), thường gọi là gió Tây Nam khô nóng.",
                "opts": [
                    {"text": "Gió Tây Nam khô nóng (gió phơn)", "is_correct": True},
                    {"text": "Gió mùa Đông Bắc lạnh buốt", "is_correct": False},
                    {"text": "Gió mậu dịch ẩm ướt", "is_correct": False},
                    {"text": "Gió bấc khô hanh", "is_correct": False},
                ],
            },
            {
                "content": "Đô thị cổ Hội An từng là thương cảng quốc tế sầm uất vào các thế kỉ XVI - XVII thuộc địa bàn tỉnh nào ngày nay?",
                "diff": "EASY",
                "topic": "Vùng Duyên hải miền Trung",
                "obj": "Biết vị trí địa lí của Đô thị cổ Hội An.",
                "expl": "Phố cổ Hội An là đô thị cổ nằm ở hạ lưu sông Thu Bồn, thuộc tỉnh Quảng Nam ngày nay.",
                "opts": [
                    {"text": "Tỉnh Quảng Nam", "is_correct": True},
                    {"text": "Tỉnh Thừa Thiên Huế", "is_correct": False},
                    {"text": "Tỉnh Bình Định", "is_correct": False},
                    {"text": "Tỉnh Khánh Hòa", "is_correct": False},
                ],
            },
            {
                "content": "Đồng bằng Nam Bộ (Đồng bằng sông Cửu Long) được bồi đắp chủ yếu bởi lượng phù sa dồi dào của hệ thống sông nào?",
                "diff": "EASY",
                "topic": "Vùng Nam Bộ",
                "obj": "Nêu được hệ thống sông bồi đắp Đồng bằng Nam Bộ.",
                "expl": "Đồng bằng Nam Bộ được bồi đắp bởi hệ thống sông Mê Kông (gồm sông Tiền và sông Hậu) và hệ thống sông Đồng Nai.",
                "opts": [
                    {"text": "Hệ thống sông Mê Kông (sông Tiền và sông Hậu)", "is_correct": True},
                    {"text": "Hệ thống sông Hồng và sông Thái Bình", "is_correct": False},
                    {"text": "Hệ thống sông Mã và sông Chu", "is_correct": False},
                    {"text": "Hệ thống sông Cả (sông Lam)", "is_correct": False},
                ],
            },
            {
                "content": "Hình thức giao thương mua bán hàng hóa nông sản đặc trưng trên sông nước của người dân vùng Nam Bộ là:",
                "diff": "EASY",
                "topic": "Vùng Nam Bộ",
                "obj": "Nhận biết nét văn hóa chợ nổi Nam Bộ.",
                "expl": "Chợ nổi (như chợ nổi Cái Răng, Ngã Bảy...) là hình thức họp chợ trên sông đặc sắc gắn liền với mạng lưới sông ngòi chằng chịt ở Nam Bộ.",
                "opts": [
                    {"text": "Chợ nổi trên sông", "is_correct": True},
                    {"text": "Chợ phiên vùng cao", "is_correct": False},
                    {"text": "Hội chợ triển lãm trên cạn", "is_correct": False},
                    {"text": "Chợ hoa xuân ven đồi", "is_correct": False},
                ],
            },
            {
                "content": "Hai quần đảo xa bờ của Việt Nam nằm trên Biển Đông có ý nghĩa chiến lược to lớn về chủ quyền quốc gia là:",
                "diff": "EASY",
                "topic": "Biển đảo Việt Nam",
                "obj": "Ghi nhớ tên hai quần đảo Hoàng Sa và Trường Sa.",
                "expl": "Quần đảo Hoàng Sa (thuộc thành phố Đà Nẵng) và quần đảo Trường Sa (thuộc tỉnh Khánh Hòa) là hai quần đảo thiêng liêng thuộc chủ quyền của Việt Nam.",
                "opts": [
                    {"text": "Quần đảo Hoàng Sa và quần đảo Trường Sa", "is_correct": True},
                    {"text": "Quần đảo Cát Bà và quần đảo Cô Tô", "is_correct": False},
                    {"text": "Đảo Phú Quốc và đảo Côn Đảo", "is_correct": False},
                    {"text": "Đảo Lý Sơn và đảo Phú Quý", "is_correct": False},
                ],
            },
            {
                "content": "Cuộc khởi nghĩa Hai Bà Trưng chống lại ách cai trị của nhà Hán nổ ra vào năm nào?",
                "diff": "EASY",
                "topic": "Khởi nghĩa Hai Bà Trưng",
                "obj": "Nhớ được mốc thời gian khởi nghĩa Hai Bà Trưng (năm 40).",
                "expl": "Năm 40 sau Công nguyên, Hai Bà Trưng (Trưng Trắc và Trưng Nhị) đã phất cờ khởi nghĩa tại Hát Môn đánh đuổi thái thú Tô Định.",
                "opts": [
                    {"text": "Năm 40", "is_correct": True},
                    {"text": "Năm 938", "is_correct": False},
                    {"text": "Năm 248", "is_correct": False},
                    {"text": "Năm 542", "is_correct": False},
                ],
            },
            {
                "content": "Chiến thắng trên sông Bạch Đằng năm 938 do Ngô Quyền lãnh đạo có ý nghĩa lịch sử to lớn nào sau đây?",
                "diff": "MEDIUM",
                "topic": "Chiến thắng Bạch Đằng năm 938",
                "obj": "Nêu được ý nghĩa chiến thắng Bạch Đằng năm 938.",
                "expl": "Chiến thắng Bạch Đằng năm 938 của Ngô Quyền đã đánh tan quân Nam Hán, chấm dứt hơn một nghìn năm Bắc thuộc, mở ra thời kỳ độc lập tự chủ lâu dài cho dân tộc.",
                "opts": [
                    {"text": "Chấm dứt hơn 1000 năm Bắc thuộc, mở ra kỉ nguyên độc lập tự chủ lâu dài", "is_correct": True},
                    {"text": "Thành lập triều đại phong kiến nhà Lý", "is_correct": False},
                    {"text": "Bắt đầu cuộc kháng chiến chống quân xâm lược Minh", "is_correct": False},
                    {"text": "Dời đô từ Hoa Lư về Thăng Long", "is_correct": False},
                ],
            },
            {
                "content": "Kế sách độc đáo mà Ngô Quyền đã áp dụng để đánh tan quân Nam Hán trên sông Bạch Đằng năm 938 là gì?",
                "diff": "MEDIUM",
                "topic": "Chiến thắng Bạch Đằng năm 938",
                "obj": "Hiểu kế sách cọc ngầm của Ngô Quyền.",
                "expl": "Ngô Quyền đã cho đóng cọc gỗ vót nhọn bịt sắt xuống lòng sông Bạch Đằng, lợi dụng thủy triều lên xuống để nhử thuyền giặc vào bãi cọc và tiêu diệt.",
                "opts": [
                    {"text": "Cắm bãi cọc ngầm vót nhọn dưới lòng sông và lợi dụng thủy triều", "is_correct": True},
                    {"text": "Đắp đập chặn dòng nước rồi phá đập tạo lũ quét", "is_correct": False},
                    {"text": "Sử dụng súng thần công công phá chiến thuyền địch từ trên cao", "is_correct": False},
                    {"text": "Vây hãm đường vận chuyển lương thực trong rừng sâu", "is_correct": False},
                ],
            },
            {
                "content": "Trong cuộc kháng chiến chống quân xâm lược Nguyên Mông lần thứ ba (năm 1288), danh tướng nào đã chỉ huy quân dân nhà Trần lập nên chiến thắng vang dội trên sông Bạch Đằng?",
                "diff": "HARD",
                "topic": "Nhà Trần kháng chiến chống Mông Nguyên",
                "obj": "Ghi nhớ công lao của Hưng Đạo Đại Vương Trần Quốc Tuấn.",
                "expl": "Hưng Đạo Đại Vương Trần Quốc Tuấn đã chỉ huy quân dân Đại Việt tiêu diệt đạo thủy binh của Ô Mã Nhi trên sông Bạch Đằng năm 1288.",
                "opts": [
                    {"text": "Trần Hưng Đạo (Trần Quốc Tuấn)", "is_correct": True},
                    {"text": "Trần Thủ Độ", "is_correct": False},
                    {"text": "Trần Quang Khải", "is_correct": False},
                    {"text": "Trần Quốc Toản", "is_correct": False},
                ],
            },
            {
                "content": "Khởi nghĩa Lam Sơn kéo dài 10 năm gian khổ đánh đuổi quân Minh xâm lược giành lại độc lập do vị anh hùng nào lãnh đạo?",
                "diff": "MEDIUM",
                "topic": "Khởi nghĩa Lam Sơn",
                "obj": "Biết lãnh tụ khởi nghĩa Lam Sơn là Lê Lợi.",
                "expl": "Lê Lợi cùng các nghĩa sĩ đã dựng cờ khởi nghĩa Lam Sơn (Thanh Hóa) năm 1418, đánh tan giặc Minh và lập nên triều đại Hậu Lê.",
                "opts": [
                    {"text": "Lê Lợi", "is_correct": True},
                    {"text": "Nguyễn Huệ", "is_correct": False},
                    {"text": "Đinh Bộ Lĩnh", "is_correct": False},
                    {"text": "Lý Thường Kiệt", "is_correct": False},
                ],
            },
            {
                "content": "Mùa xuân năm 1789, vua Quang Trung (Nguyễn Huệ) đã chỉ huy nghĩa quân Tây Sơn đánh tan 29 vạn quân xâm lược nào trong trận Ngọc Hồi - Đống Đa lịch sử?",
                "diff": "HARD",
                "topic": "Phong trào Tây Sơn",
                "obj": "Ghi nhớ chiến công đại phá quân Thanh của vua Quang Trung.",
                "expl": "Mùa xuân Kỷ Dậu (1789), vua Quang Trung đã thần tốc tiến quân ra Thăng Long, đại phá 29 vạn quân Mãn Thanh xâm lược.",
                "opts": [
                    {"text": "Quân xâm lược Mãn Thanh", "is_correct": True},
                    {"text": "Quân xâm lược Nguyên Mông", "is_correct": False},
                    {"text": "Quân xâm lược Nam Hán", "is_correct": False},
                    {"text": "Quân xâm lược Xiêm", "is_correct": False},
                ],
            },
            {
                "content": "Địa hình nước ta có đặc điểm cơ bản nào sau đây chiếm phần lớn diện tích lãnh thổ đất liền?",
                "diff": "MEDIUM",
                "topic": "Địa hình Việt Nam",
                "obj": "Nêu được đặc điểm cơ bản của địa hình Việt Nam.",
                "expl": "Địa hình đồi núi chiếm tới 3/4 diện tích lãnh thổ đất liền của Việt Nam, trong đó chủ yếu là đồi núi thấp dưới 1000m.",
                "opts": [
                    {"text": "Đồi núi chiếm 3/4 diện tích lãnh thổ, đồng bằng chiếm 1/4", "is_correct": True},
                    {"text": "Đồng bằng chiếm 3/4 diện tích lãnh thổ, đồi núi chiếm 1/4", "is_correct": False},
                    {"text": "Địa hình hoang mạc và bán hoang mạc chiếm phần lớn diện tích", "is_correct": False},
                    {"text": "Địa hình cao nguyên băng giá chiếm phần lớn diện tích", "is_correct": False},
                ],
            },
            {
                "content": "Vùng Trung du và miền núi Bắc Bộ nổi tiếng cả nước với cảnh quan nông nghiệp độc đáo nào được công nhận là di tích quốc gia đặc biệt?",
                "diff": "EASY",
                "topic": "Vùng Trung du và miền núi Bắc Bộ",
                "obj": "Nhận biết ruộng bậc thang Mù Cang Chải, Sa Pa.",
                "expl": "Ruộng bậc thang (như ở Mù Cang Chải, Sa Pa) là phương thức canh tác lúa nước độc đáo trên các sườn đồi dốc của đồng bào các dân tộc vùng cao phía Bắc.",
                "opts": [
                    {"text": "Ruộng bậc thang kỳ vĩ trên các sườn núi", "is_correct": True},
                    {"text": "Những cánh đồng muối trắng bạt ngàn ven biển", "is_correct": False},
                    {"text": "Hệ thống kênh rạch chằng chịt và rừng ngập mặn", "is_correct": False},
                    {"text": "Những đồi cát bay di động ven bờ đại dương", "is_correct": False},
                ],
            },
        ]

        tieng_viet_templates = [
            {
                "content": "Từ nào sau đây là từ ghép tổng hợp trong tiếng Việt?",
                "diff": "MEDIUM",
                "topic": "Từ ghép và từ phân loại",
                "obj": "Phân biệt được từ ghép tổng hợp và từ ghép phân loại.",
                "expl": "'Sách vở' là từ ghép tổng hợp mang ý nghĩa khái quát chỉ chung các loại sách và vở học tập.",
                "opts": [
                    {"text": "Sách vở", "is_correct": True},
                    {"text": "Sách Toán", "is_correct": False},
                    {"text": "Xe đạp", "is_correct": False},
                    {"text": "Hoa hồng", "is_correct": False},
                ],
            },
            {
                "content": "Từ nào sau đây là từ ghép phân loại trong tiếng Việt?",
                "diff": "EASY",
                "topic": "Từ ghép phân loại",
                "obj": "Nhận biết từ ghép phân loại.",
                "expl": "'Xe đạp' là từ ghép phân loại, dùng để phân biệt loại xe di chuyển bằng bàn đạp với các loại xe khác.",
                "opts": [
                    {"text": "Xe đạp", "is_correct": True},
                    {"text": "Xe cộ", "is_correct": False},
                    {"text": "Quần áo", "is_correct": False},
                    {"text": "Nhà cửa", "is_correct": False},
                ],
            },
            {
                "content": "Dòng nào dưới đây gồm toàn các từ láy gợi tả âm thanh hoặc hình ảnh?",
                "diff": "MEDIUM",
                "topic": "Từ láy",
                "obj": "Nhận biết tập hợp các từ láy gợi tả.",
                "expl": "Các từ 'lung linh, rực rỡ, róc rách, thướt tha' đều là các từ láy có tác dụng gợi hình, gợi cảm cao.",
                "opts": [
                    {"text": "Lung linh, rực rỡ, róc rách, thướt tha", "is_correct": True},
                    {"text": "Cây cối, đất đai, hoa quả, đường sá", "is_correct": False},
                    {"text": "Học sinh, bàn ghế, bút mực, thước kẻ", "is_correct": False},
                    {"text": "Mùa xuân, ruộng đồng, làng xóm, núi non", "is_correct": False},
                ],
            },
            {
                "content": "Trong câu 'Bác sĩ đang tận tình chăm sóc bệnh nhân.', từ 'Bác sĩ' thuộc từ loại nào?",
                "diff": "EASY",
                "topic": "Từ loại (Danh từ)",
                "obj": "Nhận biết danh từ chỉ người.",
                "expl": "'Bác sĩ' là danh từ chỉ người làm nghề y tế chữa bệnh.",
                "opts": [
                    {"text": "Danh từ chỉ người", "is_correct": True},
                    {"text": "Động từ chỉ hoạt động", "is_correct": False},
                    {"text": "Tính từ chỉ đặc điểm", "is_correct": False},
                    {"text": "Đại từ xưng hô", "is_correct": False},
                ],
            },
            {
                "content": "Trong câu 'Chú bộ đội dũng cảm vượt qua mưa bom bão đạn.', từ 'dũng cảm' thuộc từ loại nào?",
                "diff": "EASY",
                "topic": "Từ loại (Tính từ)",
                "obj": "Nhận biết tính từ chỉ phẩm chất.",
                "expl": "'Dũng cảm' là tính từ chỉ phẩm chất gan dạ, không sợ gian nguy, hiểm trở.",
                "opts": [
                    {"text": "Tính từ chỉ phẩm chất", "is_correct": True},
                    {"text": "Danh từ chỉ sự vật", "is_correct": False},
                    {"text": "Động từ chỉ hành động", "is_correct": False},
                    {"text": "Quan hệ từ liên kết", "is_correct": False},
                ],
            },
            {
                "content": "Trong câu 'Đàn chim én ríu rít bay về phương nam tránh rét.', từ 'bay' thuộc từ loại nào?",
                "diff": "EASY",
                "topic": "Từ loại (Động từ)",
                "obj": "Nhận biết động từ chỉ hoạt động.",
                "expl": "'Bay' là động từ chỉ hoạt động di chuyển trên không trung của chim muông.",
                "opts": [
                    {"text": "Động từ chỉ hoạt động", "is_correct": True},
                    {"text": "Danh từ chỉ sự vật", "is_correct": False},
                    {"text": "Tính từ chỉ trạng thái", "is_correct": False},
                    {"text": "Trạng từ chỉ thời gian", "is_correct": False},
                ],
            },
            {
                "content": "Câu nào dưới đây sử dụng biện pháp tu từ so sánh sinh động?",
                "diff": "MEDIUM",
                "topic": "Biện pháp tu từ so sánh",
                "obj": "Nhận diện câu văn có biện pháp so sánh.",
                "expl": "Câu 'Mặt trăng tròn vành vạnh như một chiếc đĩa bạc khổng lồ' sử dụng từ so sánh 'như' nối hai sự vật.",
                "opts": [
                    {"text": "Mặt trăng tròn vành vạnh như một chiếc đĩa bạc khổng lồ lơ lửng giữa trời", "is_correct": True},
                    {"text": "Gió mùa thu thổi từng cơn nhè nhẹ trên mặt hồ", "is_correct": False},
                    {"text": "Mặt trời tỏa ánh nắng chói chang xuống trần gian", "is_correct": False},
                    {"text": "Các bạn học sinh đang chăm chỉ làm bài tập", "is_correct": False},
                ],
            },
            {
                "content": "Câu nào dưới đây sử dụng biện pháp tu từ nhân hóa?",
                "diff": "MEDIUM",
                "topic": "Biện pháp tu từ nhân hóa",
                "obj": "Nhận diện câu văn có biện pháp nhân hóa.",
                "expl": "Câu 'Chị gió nhẹ nhàng lướt qua thì thầm đánh thức những chồi non thức dậy' gán hành động và xưng hô của người cho gió và chồi non.",
                "opts": [
                    {"text": "Chị gió nhẹ nhàng lướt qua thì thầm đánh thức những chồi non thức dậy", "is_correct": True},
                    {"text": "Dòng sông mùa lũ nước đục ngầu cuồn cuộn chảy", "is_correct": False},
                    {"text": "Mùa đông về mang theo những đợt gió lạnh buốt", "is_correct": False},
                    {"text": "Cây bàng mùa đông rụng hết lá chỉ còn cành khẳng khiu", "is_correct": False},
                ],
            },
            {
                "content": "Trong câu 'Sáng sớm hôm nay, trên khắp các nẻo đường, học sinh nô nức đến trường.', bộ phận 'Sáng sớm hôm nay' là thành phần gì?",
                "diff": "EASY",
                "topic": "Trạng ngữ chỉ thời gian",
                "obj": "Xác định trạng ngữ chỉ thời gian trong câu.",
                "expl": "'Sáng sớm hôm nay' trả lời cho câu hỏi 'Khi nào?', là trạng ngữ chỉ thời gian.",
                "opts": [
                    {"text": "Trạng ngữ chỉ thời gian", "is_correct": True},
                    {"text": "Trạng ngữ chỉ nơi chốn", "is_correct": False},
                    {"text": "Chủ ngữ của câu", "is_correct": False},
                    {"text": "Vị ngữ của câu", "is_correct": False},
                ],
            },
            {
                "content": "Dấu gạch ngang (-) trong đoạn văn đối thoại thường dùng để làm gì?",
                "diff": "EASY",
                "topic": "Dấu câu (Dấu gạch ngang)",
                "obj": "Nêu tác dụng của dấu gạch ngang trong hội thoại.",
                "expl": "Dấu gạch ngang đặt ở đầu câu dùng để đánh dấu chỗ bắt đầu lời nói trực tiếp của nhân vật trong đối thoại.",
                "opts": [
                    {"text": "Đánh dấu chỗ bắt đầu lời nói trực tiếp của nhân vật", "is_correct": True},
                    {"text": "Kết thúc một câu kể hoàn chỉnh", "is_correct": False},
                    {"text": "Dẫn lời trích dẫn nguyên văn đặt trong ngoặc", "is_correct": False},
                    {"text": "Nối các vế câu trong một câu ghép dài", "is_correct": False},
                ],
            },
            {
                "content": "Thành ngữ, tục ngữ nào sau đây khuyên con người ta phải biết ghi nhớ công ơn của những người đã giúp đỡ mình?",
                "diff": "EASY",
                "topic": "Mở rộng vốn từ: Biết ơn",
                "obj": "Hiểu ý nghĩa thành ngữ Ăn quả nhớ kẻ trồng cây.",
                "expl": "'Ăn quả nhớ kẻ trồng cây' thể hiện truyền thống đạo lý tốt đẹp uống nước nhớ nguồn, biết ơn người có công.",
                "opts": [
                    {"text": "Ăn quả nhớ kẻ trồng cây", "is_correct": True},
                    {"text": "Học thầy không tày học bạn", "is_correct": False},
                    {"text": "Đi một ngày đàng học một sàng khôn", "is_correct": False},
                    {"text": "Lá lành đùm lá rách", "is_correct": False},
                ],
            },
            {
                "content": "Từ nào sau đây trái nghĩa với từ 'trung thực'?",
                "diff": "EASY",
                "topic": "Mở rộng vốn từ: Trung thực",
                "obj": "Tìm từ trái nghĩa với từ trung thực.",
                "expl": "'Gian dối' là từ trái nghĩa trực tiếp với 'trung thực'.",
                "opts": [
                    {"text": "Gian dối", "is_correct": True},
                    {"text": "Thật thà", "is_correct": False},
                    {"text": "Chân thành", "is_correct": False},
                    {"text": "Thẳng thắn", "is_correct": False},
                ],
            },
        ]

        khoa_hoc_templates = [
            {
                "content": "Trong tự nhiên, nước có thể tồn tại ở những thể nào sau đây?",
                "diff": "EASY",
                "topic": "Nước và các thể của nước",
                "obj": "Nêu được 3 thể của nước trong tự nhiên.",
                "expl": "Nước tồn tại ở 3 thể: thể rắn (băng, đá), thể lỏng (nước thường) và thể khí (hơi nước).",
                "opts": [
                    {"text": "Thể rắn, thể lỏng và thể khí", "is_correct": True},
                    {"text": "Chỉ tồn tại ở thể lỏng", "is_correct": False},
                    {"text": "Chỉ tồn tại ở thể lỏng và thể rắn", "is_correct": False},
                    {"text": "Chỉ tồn tại ở thể khí và thể lỏng", "is_correct": False},
                ],
            },
            {
                "content": "Hiện tượng nước từ thể lỏng chuyển thành hơi nước ở nhiệt độ môi trường được gọi là gì?",
                "diff": "EASY",
                "topic": "Vòng tuần hoàn của nước",
                "obj": "Nhận biết hiện tượng bay hơi của nước.",
                "expl": "Sự chuyển từ thể lỏng sang thể khí ở bề mặt chất lỏng gọi là sự bay hơi.",
                "opts": [
                    {"text": "Sự bay hơi", "is_correct": True},
                    {"text": "Sự ngưng tụ", "is_correct": False},
                    {"text": "Sự đông đặc", "is_correct": False},
                    {"text": "Sự nóng chảy", "is_correct": False},
                ],
            },
            {
                "content": "Chất khí nào chiếm tỉ lệ thể tích lớn nhất (khoảng 78%) trong không khí xung quanh chúng ta?",
                "diff": "MEDIUM",
                "topic": "Thành phần của không khí",
                "obj": "Biết khí nitơ chiếm tỉ lệ lớn nhất trong không khí.",
                "expl": "Khí nitơ chiếm khoảng 78% thể tích không khí, khí ôxi chiếm khoảng 21%, còn lại là các khí khác.",
                "opts": [
                    {"text": "Khí nitơ", "is_correct": True},
                    {"text": "Khí ôxi", "is_correct": False},
                    {"text": "Khí cacbonic", "is_correct": False},
                    {"text": "Khí hiđrô", "is_correct": False},
                ],
            },
            {
                "content": "Trong quá trình quang hợp dưới ánh sáng mặt trời, cây xanh hấp thụ khí nào và giải phóng ra khí nào?",
                "diff": "EASY",
                "topic": "Sự quang hợp ở thực vật",
                "obj": "Nêu được vai trò hấp thụ và giải phóng khí trong quang hợp.",
                "expl": "Khi quang hợp dưới ánh sáng, lá cây hấp thụ khí cacbonic (CO2) và giải phóng khí ôxi (O2) ra môi trường.",
                "opts": [
                    {"text": "Hấp thụ khí cacbonic và giải phóng khí ôxi", "is_correct": True},
                    {"text": "Hấp thụ khí ôxi và giải phóng khí cacbonic", "is_correct": False},
                    {"text": "Hấp thụ khí nitơ và giải phóng khí cacbonic", "is_correct": False},
                    {"text": "Hấp thụ hơi nước và giải phóng khí nitơ", "is_correct": False},
                ],
            },
            {
                "content": "Vật liệu nào sau đây có khả năng dẫn nhiệt tốt nhất thường dùng làm đáy xoong nồi?",
                "diff": "EASY",
                "topic": "Vật dẫn nhiệt và cách nhiệt",
                "obj": "Nhận biết các kim loại dẫn nhiệt tốt.",
                "expl": "Các kim loại như nhôm, đồng, inox dẫn nhiệt rất tốt nên được dùng để nấu nướng thức ăn nhanh chín.",
                "opts": [
                    {"text": "Kim loại (nhôm, đồng, inox)", "is_correct": True},
                    {"text": "Gỗ tự nhiên", "is_correct": False},
                    {"text": "Nhựa cứng", "is_correct": False},
                    {"text": "Vải bông sợi", "is_correct": False},
                ],
            },
            {
                "content": "Âm thanh KHÔNG thể truyền qua môi trường nào sau đây?",
                "diff": "HARD",
                "topic": "Sự lan truyền âm thanh",
                "obj": "Biết âm thanh không truyền được trong chân không.",
                "expl": "Âm thanh cần môi trường vật chất (chất rắn, chất lỏng, chất khí) để dao động truyền đi, do đó không thể truyền qua chân không.",
                "opts": [
                    {"text": "Môi trường chân không", "is_correct": True},
                    {"text": "Chất rắn", "is_correct": False},
                    {"text": "Chất lỏng", "is_correct": False},
                    {"text": "Chất khí", "is_correct": False},
                ],
            },
        ]

        tieng_anh_templates = [
            {
                "content": "Choose the correct verb form: My sister _______ books in the library every afternoon.",
                "diff": "EASY",
                "topic": "Present Simple Tense",
                "obj": "Use Present Simple with third-person singular subjects.",
                "expl": "With singular subject 'My sister' (she), the verb 'read' takes an 's' -> 'reads'.",
                "opts": [
                    {"text": "reads", "is_correct": True},
                    {"text": "read", "is_correct": False},
                    {"text": "reading", "is_correct": False},
                    {"text": "is read", "is_correct": False},
                ],
            },
            {
                "content": "Choose the correct preposition: We have an important English test _______ Monday morning.",
                "diff": "EASY",
                "topic": "Prepositions of Time",
                "obj": "Use 'on' with days of the week.",
                "expl": "We use the preposition 'on' before days of the week (on Monday, on Tuesday...).",
                "opts": [
                    {"text": "on", "is_correct": True},
                    {"text": "in", "is_correct": False},
                    {"text": "at", "is_correct": False},
                    {"text": "from", "is_correct": False},
                ],
            },
            {
                "content": "Look! The students _______ trees in the school garden.",
                "diff": "MEDIUM",
                "topic": "Present Continuous Tense",
                "obj": "Recognize signal 'Look!' for Present Continuous.",
                "expl": "'Look!' indicates an action happening at the moment of speaking -> Present Continuous: 'are planting'.",
                "opts": [
                    {"text": "are planting", "is_correct": True},
                    {"text": "plants", "is_correct": False},
                    {"text": "planted", "is_correct": False},
                    {"text": "plant", "is_correct": False},
                ],
            },
            {
                "content": "What is the irregular plural form of the noun 'child'?",
                "diff": "EASY",
                "topic": "Irregular Plural Nouns",
                "obj": "Identify irregular plural form 'children'.",
                "expl": "The plural form of 'child' is 'children'.",
                "opts": [
                    {"text": "children", "is_correct": True},
                    {"text": "childs", "is_correct": False},
                    {"text": "childrens", "is_correct": False},
                    {"text": "childes", "is_correct": False},
                ],
            },
        ]

        tin_hoc_templates = [
            {
                "content": "Thiết bị nào sau đây thuộc nhóm thiết bị đưa thông tin vào máy tính (thiết bị vào)?",
                "diff": "EASY",
                "topic": "Phần cứng máy tính",
                "obj": "Nhận biết các thiết bị vào cơ bản.",
                "expl": "Bàn phím và chuột máy tính giúp người dùng nhập dữ liệu và chỉ thị vào máy tính.",
                "opts": [
                    {"text": "Bàn phím và chuột máy tính", "is_correct": True},
                    {"text": "Màn hình máy tính", "is_correct": False},
                    {"text": "Máy in màu", "is_correct": False},
                    {"text": "Loa máy tính", "is_correct": False},
                ],
            },
            {
                "content": "Thiết bị nào sau đây thuộc nhóm thiết bị đưa thông tin ra ngoài (thiết bị ra)?",
                "diff": "EASY",
                "topic": "Phần cứng máy tính",
                "obj": "Nhận biết các thiết bị ra cơ bản.",
                "expl": "Màn hình hiển thị hình ảnh và loa phát âm thanh là các thiết bị ra.",
                "opts": [
                    {"text": "Màn hình và máy in", "is_correct": True},
                    {"text": "Bàn phím gõ chữ", "is_correct": False},
                    {"text": "Chuột máy tính", "is_correct": False},
                    {"text": "Microphone thu âm", "is_correct": False},
                ],
            },
            {
                "content": "Tổ hợp phím tắt thông dụng nào dùng để sao chép (Copy) đối tượng đang chọn trong hệ điều hành Windows?",
                "diff": "EASY",
                "topic": "Thao tác trên máy tính",
                "obj": "Sử dụng phím tắt Ctrl + C để sao chép.",
                "expl": "Tổ hợp phím Ctrl + C dùng để sao chép (Copy) tệp, thư mục hoặc đoạn văn bản được chọn.",
                "opts": [
                    {"text": "Ctrl + C", "is_correct": True},
                    {"text": "Ctrl + V", "is_correct": False},
                    {"text": "Ctrl + X", "is_correct": False},
                    {"text": "Ctrl + Z", "is_correct": False},
                ],
            },
            {
                "content": "Tổ hợp phím tắt thông dụng nào dùng để dán (Paste) đối tượng vừa sao chép vào vị trí mới?",
                "diff": "EASY",
                "topic": "Thao tác trên máy tính",
                "obj": "Sử dụng phím tắt Ctrl + V để dán đối tượng.",
                "expl": "Tổ hợp phím Ctrl + V dùng để dán (Paste) nội dung vừa được sao chép vào vị trí con trỏ.",
                "opts": [
                    {"text": "Ctrl + V", "is_correct": True},
                    {"text": "Ctrl + C", "is_correct": False},
                    {"text": "Ctrl + P", "is_correct": False},
                    {"text": "Ctrl + S", "is_correct": False},
                ],
            },
            {
                "content": "Tổ hợp phím tắt thông dụng nào dùng để lưu (Save) tệp văn bản đang làm việc?",
                "diff": "EASY",
                "topic": "Thao tác trên máy tính",
                "obj": "Sử dụng phím tắt Ctrl + S để lưu tệp.",
                "expl": "Tổ hợp phím Ctrl + S dùng để lưu nhanh tệp tin đang mở vào ổ đĩa.",
                "opts": [
                    {"text": "Ctrl + S", "is_correct": True},
                    {"text": "Ctrl + O", "is_correct": False},
                    {"text": "Ctrl + N", "is_correct": False},
                    {"text": "Ctrl + W", "is_correct": False},
                ],
            },
            {
                "content": "Hành vi nào sau đây giúp em bảo vệ an toàn thông tin cá nhân khi tham gia mạng Internet?",
                "diff": "MEDIUM",
                "topic": "An toàn trên Internet",
                "obj": "Biết bảo vệ mật khẩu và thông tin riêng tư.",
                "expl": "Không tiết lộ mật khẩu, địa chỉ nhà, số điện thoại hay thông tin cá nhân cho người lạ trên mạng.",
                "opts": [
                    {"text": "Không chia sẻ mật khẩu và thông tin riêng tư với người lạ", "is_correct": True},
                    {"text": "Đăng công khai số điện thoại và địa chỉ nhà lên mạng xã hội", "is_correct": False},
                    {"text": "Gửi mật khẩu tài khoản cho bất kỳ ai yêu cầu", "is_correct": False},
                    {"text": "Bấm vào mọi đường link lạ được gửi từ người chưa quen", "is_correct": False},
                ],
            },
            {
                "content": "Thư mục (Folder) trong hệ điều hành máy tính có vai trò chính là gì?",
                "diff": "EASY",
                "topic": "Tổ chức lưu trữ tệp và thư mục",
                "obj": "Hiểu vai trò của thư mục trong máy tính.",
                "expl": "Thư mục dùng để gom nhóm, sắp xếp và quản lý các tệp tin cùng thư mục con một cách có hệ thống.",
                "opts": [
                    {"text": "Chứa và tổ chức sắp xếp các tệp tin cùng thư mục con", "is_correct": True},
                    {"text": "Tăng tốc độ truy cập mạng Internet", "is_correct": False},
                    {"text": "Chống virus xâm nhập vào hệ thống", "is_correct": False},
                    {"text": "Hiển thị màu sắc và âm thanh trên màn hình", "is_correct": False},
                ],
            },
            {
                "content": "Bộ phận nào sau đây được coi là 'bộ não' xử lý mọi thông tin và chỉ thị của máy tính?",
                "diff": "MEDIUM",
                "topic": "Phần cứng máy tính",
                "obj": "Nhận biết vai trò của bộ vi xử lý CPU.",
                "expl": "Bộ vi xử lý trung tâm (CPU - Central Processing Unit) đóng vai trò như bộ não xử lý mọi phép toán và điều khiển hoạt động của máy tính.",
                "opts": [
                    {"text": "Bộ vi xử lý trung tâm (CPU)", "is_correct": True},
                    {"text": "Bộ nhớ ngoài đĩa cứng (Hard drive)", "is_correct": False},
                    {"text": "Bàn phím và chuột máy tính", "is_correct": False},
                    {"text": "Màn hình hiển thị", "is_correct": False},
                ],
            },
        ]

        dao_duc_templates = [
            {
                "content": "Hành vi nào sau đây thể hiện thái độ tôn sư trọng đạo và kính trọng thầy cô giáo?",
                "diff": "EASY",
                "topic": "Kính trọng thầy cô",
                "obj": "Biết cách thể hiện thái độ tôn trọng thầy cô giáo.",
                "expl": "Lễ phép chào hỏi khi gặp thầy cô giáo và chăm chú lắng nghe bài giảng là hành vi chuẩn mực của học sinh.",
                "opts": [
                    {"text": "Lễ phép chào hỏi khi gặp thầy cô và chăm chú lắng nghe bài giảng", "is_correct": True},
                    {"text": "Làm việc riêng trong giờ học của thầy cô", "is_correct": False},
                    {"text": "Tránh mặt khi nhìn thấy thầy cô từ xa", "is_correct": False},
                    {"text": "Nói leo và ngắt lời khi thầy cô đang giảng bài", "is_correct": False},
                ],
            },
            {
                "content": "Khi vô tình làm hỏng hoặc làm mất đồ dùng học tập của bạn, em nên ứng xử thế nào?",
                "diff": "EASY",
                "topic": "Trung thực và trách nhiệm",
                "obj": "Biết nhận lỗi và sửa sai khi làm hỏng đồ dùng của bạn.",
                "expl": "Cần dũng cảm nhận lỗi, chân thành xin lỗi bạn và tìm cách đền bù đồ dùng tương xứng cho bạn.",
                "opts": [
                    {"text": "Dũng cảm nhận lỗi, xin lỗi bạn và chủ động đền bù đồ dùng tương đương", "is_correct": True},
                    {"text": "Giấu kín không nói cho bạn biết", "is_correct": False},
                    {"text": "Đổ lỗi cho một bạn khác trong lớp", "is_correct": False},
                    {"text": "Cho rằng đồ dùng không đáng giá nên bỏ qua", "is_correct": False},
                ],
            },
            {
                "content": "Câu tục ngữ nào dưới đây khuyên con người phải biết coi trọng và giữ gìn chữ tín, lời hứa?",
                "diff": "EASY",
                "topic": "Giữ lời hứa",
                "obj": "Hiểu giá trị của việc giữ chữ tín.",
                "expl": "'Nói lời phải giữ lấy lời, đừng như con bướm đậu rồi lại bay' khuyên ta phải kiên định và giữ tròn lời hứa.",
                "opts": [
                    {"text": "Nói lời phải giữ lấy lời, đừng như con bướm đậu rồi lại bay", "is_correct": True},
                    {"text": "Học thầy không tày học bạn", "is_correct": False},
                    {"text": "Gần mực thì đen, gần đèn thì rạng", "is_correct": False},
                    {"text": "Ăn vóc học hay", "is_correct": False},
                ],
            },
            {
                "content": "Hành động nào sau đây thể hiện tinh thần tiết kiệm tiền của và thời gian?",
                "diff": "EASY",
                "topic": "Tiết kiệm",
                "obj": "Biết tiết kiệm điện, nước và thời gian biểu.",
                "expl": "Tắt các thiết bị điện khi ra khỏi phòng và lập kế hoạch thời gian biểu giúp rèn luyện lối sống văn minh, tiết kiệm.",
                "opts": [
                    {"text": "Tắt các thiết bị điện khi ra khỏi phòng và lập thời gian biểu học tập hợp lý", "is_correct": True},
                    {"text": "Bật đèn quạt suốt ngày đêm kể cả khi đi vắng", "is_correct": False},
                    {"text": "Xả nước lãng phí trong nhà tắm", "is_correct": False},
                    {"text": "Dành toàn bộ thời gian chơi điện tử bỏ bê việc học", "is_correct": False},
                ],
            },
            {
                "content": "Khi thấy một bạn trong lớp có hoàn cảnh khó khăn hoặc bị ốm đau, hành vi đúng đắn là gì?",
                "diff": "EASY",
                "topic": "Yêu thương con người",
                "obj": "Biết quan tâm, giúp đỡ bạn bè.",
                "expl": "Chủ động thăm hỏi, động viên và cùng các bạn quyên góp giúp đỡ là biểu hiện của tình yêu thương, sẻ chia.",
                "opts": [
                    {"text": "Động viên, thăm hỏi và cùng các bạn quyên góp giúp đỡ bạn", "is_correct": True},
                    {"text": "Thờ ơ xem như không phải việc của mình", "is_correct": False},
                    {"text": "Chế giễu hoàn cảnh khó khăn của bạn", "is_correct": False},
                    {"text": "Xa lánh không chơi cùng bạn", "is_correct": False},
                ],
            },
            {
                "content": "Tại sao chúng ta cần phải giữ gìn và bảo vệ của công ở trường học và nơi công cộng?",
                "diff": "MEDIUM",
                "topic": "Bảo vệ của công",
                "obj": "Hiểu trách nhiệm bảo vệ tài sản công cộng.",
                "expl": "Của công là tài sản chung phục vụ cho tất cả học sinh và nhân dân, giữ gìn của công là trách nhiệm của mỗi công dân.",
                "opts": [
                    {"text": "Vì của công là tài sản chung phục vụ cho toàn xã hội", "is_correct": True},
                    {"text": "Vì đó là tài sản riêng của thầy hiệu trưởng", "is_correct": False},
                    {"text": "Để không bị người khác chê cười", "is_correct": False},
                    {"text": "Vì không ai được phép sử dụng của công", "is_correct": False},
                ],
            },
        ]

        cong_nghe_templates = [
            {
                "content": "Khi sử dụng quạt điện hoặc các đồ dùng điện trong gia đình, điều nào sau đây đảm bảo an toàn tuyệt đối?",
                "diff": "EASY",
                "topic": "An toàn sử dụng điện",
                "obj": "Thực hiện đúng quy tắc an toàn khi sử dụng đồ điện.",
                "expl": "Tuyệt đối không chạm vào công tắc hay cắm rút phích điện khi tay còn ướt để tránh bị điện giật nguy hiểm.",
                "opts": [
                    {"text": "Chỉ cắm hoặc rút phích điện khi tay hoàn toàn khô ráo", "is_correct": True},
                    {"text": "Cắm phích điện khi tay còn dính nước", "is_correct": False},
                    {"text": "Để dây dẫn điện bị hở tiếp xúc với sàn nhà ẩm", "is_correct": False},
                    {"text": "Tự ý chọc vật kim loại vào ổ cắm điện", "is_correct": False},
                ],
            },
            {
                "content": "Tại sao đáy chậu trồng hoa và cây cảnh luôn cần có các lỗ thoát nước nhỏ?",
                "diff": "EASY",
                "topic": "Chăm sóc cây cảnh",
                "obj": "Hiểu tác dụng của lỗ thoát nước ở chậu cây.",
                "expl": "Lỗ thoát nước giúp nước tưới dư thừa thoát ra ngoài, tránh làm rễ cây bị ngập úng gây thối rễ chết cây.",
                "opts": [
                    {"text": "Để thoát lượng nước dư thừa, tránh làm cây bị ngập úng thối rễ", "is_correct": True},
                    {"text": "Để không khí bên ngoài không lọt vào trong chậu", "is_correct": False},
                    {"text": "Để trang trí cho chậu cây thêm đẹp mắt", "is_correct": False},
                    {"text": "Để giữ toàn bộ lượng nước lại trong chậu cây", "is_correct": False},
                ],
            },
            {
                "content": "Trong quy trình chăm sóc cây cảnh trồng trong chậu, việc xới đất tơi xốp xung quanh gốc có tác dụng gì?",
                "diff": "MEDIUM",
                "topic": "Chăm sóc cây cảnh",
                "obj": "Biết tác dụng của việc xới đất cho cây.",
                "expl": "Xới đất giúp đất thông thoáng, cung cấp khí ôxi cho rễ hô hấp và giúp rễ hút nước, chất khoáng dễ dàng hơn.",
                "opts": [
                    {"text": "Giúp rễ cây hô hấp tốt và dễ dàng hấp thụ nước, chất dinh dưỡng", "is_correct": True},
                    {"text": "Làm đứt các rễ cây để cây ngừng phát triển", "is_correct": False},
                    {"text": "Làm đất nén chặt lại để giữ nước không bốc hơi", "is_correct": False},
                    {"text": "Ngăn không cho ánh sáng mặt trời chiếu vào chậu", "is_correct": False},
                ],
            },
            {
                "content": "Đồ chơi dân gian nào sau đây thường được làm từ các thanh tre vót mỏng dán giấy màu hình ngôi sao năm cánh?",
                "diff": "EASY",
                "topic": "Lắp ghép đồ chơi dân gian",
                "obj": "Nhận biết đèn ông sao trung thu.",
                "expl": "Đèn ông sao là đồ chơi trung thu truyền thống làm từ khung tre và giấy bóng kính màu gắn nến bên trong.",
                "opts": [
                    {"text": "Đèn ông sao năm cánh", "is_correct": True},
                    {"text": "Tò he bột gạo", "is_correct": False},
                    {"text": "Con quay gỗ", "is_correct": False},
                    {"text": "Trống cơm gốm sứ", "is_correct": False},
                ],
            },
            {
                "content": "Khi cắm quạt điện, nếu phát hiện dây dẫn điện bị sờn rách hở lõi đồng, em cần xử lý thế nào để đảm bảo an toàn?",
                "diff": "EASY",
                "topic": "An toàn sử dụng điện",
                "obj": "Biết cách xử lý tình huống dây điện bị hở.",
                "expl": "Tuyệt đối không chạm vào phần hở và cần báo ngay cho cha mẹ hoặc người lớn sửa chữa, quấn băng dính cách điện an toàn.",
                "opts": [
                    {"text": "Không chạm vào dây và báo ngay cho người lớn để sửa chữa thay thế", "is_correct": True},
                    {"text": "Dùng tay không túm lấy chỗ hở để kéo phích cắm", "is_correct": False},
                    {"text": "Lấy nước dội vào chỗ dây hở", "is_correct": False},
                    {"text": "Tiếp tục cắm điện sử dụng bình thường", "is_correct": False},
                ],
            },
            {
                "content": "Loại bóng đèn chiếu sáng nào sau đây tiết kiệm điện năng nhất hiện nay được khuyên dùng trong gia đình?",
                "diff": "MEDIUM",
                "topic": "Thiết bị điện gia đình",
                "obj": "Nhận biết đèn LED tiết kiệm điện năng.",
                "expl": "Đèn LED (Light Emitting Diode) tiêu thụ ít điện năng hơn nhiều so với đèn sợi đốt và đèn huỳnh quang, đồng thời có tuổi thọ cao.",
                "opts": [
                    {"text": "Đèn LED tiết kiệm điện", "is_correct": True},
                    {"text": "Đèn sợi đốt dây tóc vonfram", "is_correct": False},
                    {"text": "Đèn dầu hỏa truyền thống", "is_correct": False},
                    {"text": "Đèn cầy thắp sáng", "is_correct": False},
                ],
            },
        ]

        # Select pool matching subject
        if sub_cat == "LICH_SU_DIA_LI":
            pool = lich_su_dia_li_templates
        elif sub_cat == "TIENG_VIET":
            pool = tieng_viet_templates
        elif sub_cat == "KHOA_HOC":
            pool = khoa_hoc_templates
        elif sub_cat == "TIENG_ANH":
            pool = tieng_anh_templates
        elif sub_cat == "TIN_HOC":
            pool = tin_hoc_templates
        elif sub_cat == "DAO_DUC":
            pool = dao_duc_templates
        elif sub_cat == "CONG_NGHE":
            pool = cong_nghe_templates
        else:
            pool = lich_su_dia_li_templates + tieng_viet_templates + khoa_hoc_templates

        shuffled_pool = pool.copy()
        random.shuffle(shuffled_pool)

        for i in range(count):
            idx = i % len(shuffled_pool)
            tpl = shuffled_pool[idx]
            diff = diff_pool[i]

            raw_opts = [dict(opt) for opt in tpl["opts"]]
            random.shuffle(raw_opts)
            opts = []
            for opt_idx, opt in enumerate(raw_opts):
                opts.append({
                    "key": chr(65 + opt_idx),
                    "text": opt["text"],
                    "is_correct": opt["is_correct"],
                })

            correct_key = next((o["key"] for o in opts if o["is_correct"]), "A")
            correct_text = next((o["text"] for o in opts if o["is_correct"]), "")

            expl = tpl["expl"]
            if not expl.startswith("Chọn ") and not expl.startswith("Đáp án đúng là "):
                expl = f"Chọn {correct_key} ({correct_text}). {expl}"

            q_text = tpl["content"]
            if i >= len(shuffled_pool):
                cycle_idx = i // len(shuffled_pool)
                prefixes = [
                    f"Theo chương trình Lớp {req.grade}, em hãy xác định: ",
                    "Em hãy chọn phương án chính xác nhất cho câu hỏi sau: ",
                    "Trong các phương án dưới đây, đâu là đáp án đúng: ",
                    "Dựa vào kiến thức đã học, em hãy trả lời: ",
                    "Hãy phân tích và chọn nhận định đúng nhất: ",
                ]
                prefix = prefixes[(cycle_idx - 1) % len(prefixes)]
                q_text = f"{prefix}{tpl['content']}"

            items.append({
                "question_text": q_text,
                "difficulty": diff,
                "topic": req.topic or req.chapter or tpl["topic"],
                "learning_objective": tpl["obj"],
                "explanation": expl,
                "options": opts,
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
