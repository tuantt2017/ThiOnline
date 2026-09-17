import json
import logging
import re
import base64
from typing import Optional, Dict, Any, List
import httpx
import pymupdf

from app.core.config import settings
from app.models.document import KnowledgeNodeType
from app.services.parser import ParsedDocument
from app.services.extractor import (
    ExtractedChunk,
    ExtractedNode,
    ExtractionResult,
    StructureExtractor,
)

logger = logging.getLogger(__name__)


class GeminiKnowledgeService:
    """Service utilizing Google Gemini API (Text + Vision) to extract real curriculum knowledge maps."""

    @classmethod
    def is_gemini_configured(cls) -> bool:
        import os
        # Per Spec Section 27: Do not call live AI during automated pytest unless RUN_LIVE_AI_TESTS=True
        if os.environ.get("PYTEST_CURRENT_TEST") and not settings.RUN_LIVE_AI_TESTS:
            return False

        key = settings.GEMINI_API_KEY
        if not key:
            return False
        cleaned = key.strip()
        return bool(cleaned and cleaned != "your_gemini_api_key_here" and len(cleaned) > 10)


    @classmethod
    def is_scanned_or_watermarked_pdf(cls, file_path: str) -> bool:
        """Detect whether a PDF is an image-only scan or has watermark-only text."""
        try:
            doc = pymupdf.open(file_path)
            total_pages = len(doc)
            if total_pages == 0:
                return False

            watermark_count = 0
            meaningful_text_count = 0

            # Sample first 10 pages
            sample_count = min(10, total_pages)
            for i in range(sample_count):
                text = doc[i].get_text("text").strip()
                if not text:
                    continue
                lines = [l.strip() for l in text.splitlines() if l.strip()]
                for line in lines:
                    if any(w in line.lower() for w in ["blogtailieu", "tailieu", "http://", "https://", "giao-an"]):
                        watermark_count += 1
                    elif len(line) > 10 and not line.startswith("http"):
                        meaningful_text_count += 1

            doc.close()
            # If watermark lines heavily outweigh meaningful text or meaningful text is virtually zero
            if meaningful_text_count < 5 and watermark_count > 0:
                return True
            return False
        except Exception:
            return False

    @classmethod
    def extract_from_scanned_pdf(
        cls,
        file_path: str,
        subject: str,
        grade: int,
        book_series: Optional[str],
        doc_title: str,
    ) -> Optional[ExtractionResult]:
        """
        Uses Gemini Multimodal Vision to read scanned textbook images (TOC pages)
        and construct the real curriculum knowledge map.
        """
        if not cls.is_gemini_configured():
            logger.info("GEMINI_API_KEY chưa cấu hình, không thể xử lý PDF scan bằng Gemini Vision.")
            return None

        api_key = settings.GEMINI_API_KEY.strip()
        book_name = (book_series or "Sách Giáo Khoa chuẩn GDPT 2018").strip()

        try:
            doc = pymupdf.open(file_path)
            total_pages = len(doc)
            logger.info(f"Đang phân tích PDF scan ({total_pages} trang) bằng Gemini Vision...")

            # In Vietnamese textbooks (Grades 4-9), Table of Contents (Mục lục) is almost always in pages 3-8 or last 3 pages
            toc_indices = []
            # Check pages 2 to 7 (1-indexed pages 3 to 8)
            for idx in range(min(total_pages, 8)):
                if idx >= 2:  # skip cover and intro
                    toc_indices.append(idx)

            # Also check last 2 pages if book has > 20 pages
            if total_pages > 20:
                toc_indices.append(total_pages - 2)
                toc_indices.append(total_pages - 1)

            # Render candidate pages to JPEG base64 images
            parts = []
            for p_idx in toc_indices:
                page = doc[p_idx]
                pix = page.get_pixmap(dpi=150)
                img_b64 = base64.b64encode(pix.tobytes("jpeg")).decode("utf-8")
                parts.append({
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": img_b64,
                    }
                })

            prompt_text = f"""Bạn là chuyên gia sư phạm và kiến trúc sư chương trình Giáo dục Phổ thông Việt Nam (GDPT 2018), chuyên trách khối Cấp 1 (Lớp 4, Lớp 5) và Cấp 2 (Lớp 6, Lớp 7, Lớp 8, Lớp 9) của các bộ sách Kết nối tri thức, Chân trời sáng tạo, Cánh Diều.

Dưới đây là các trang ảnh chụp từ sách giáo khoa:
- Môn học: {subject}
- Khối lớp: Lớp {grade}
- Bộ sách: {book_name}
- Tiêu đề tài liệu: {doc_title}
- Tổng số trang: {total_pages}

NHIỆM VỤ:
1. Xác định các trang MỤC LỤC trong các ảnh trên.
2. Đọc TOÀN BỘ nội dung chữ trên các trang Mục lục thực tế đó.
3. Trích xuất đầy đủ, chính xác toàn bộ danh sách các Chủ đề / Chương và Bài học thực tế của cuốn sách (kèm số trang tương ứng).
4. Đối với mỗi bài học, hãy bổ sung các Chủ đề con / Tiểu mục, các Khái niệm cốt lõi chuẩn chương trình Lớp {grade}, và các Mục tiêu cần đạt / Yêu cầu cần đạt chuẩn theo GDPT 2018.

QUY TẮC BẮT BUỘC:
- TUYỆT ĐỐI KHÔNG ghi các tên chung chung như "Nội dung trang 1", "Nội dung trang 2"...
- Phải dùng đúng tên Chủ đề và Bài học thực tế có trong ảnh Mục lục (Ví dụ: "Chủ đề 1: Ôn tập và bổ sung", "Bài 1: Ôn tập các số đến 100 000", "Chủ đề 2: Góc và đơn vị đo góc"...).

ĐỊNH DẠNG TRẢ VỀ:
CHỈ trả về DUY NHẤT một chuỗi JSON hợp lệ (không kèm văn bản giải thích bên ngoài):
{{
  "chapters": [
    {{
      "title": "Tên Chủ đề hoặc Chương thực tế (VD: Chủ đề 1: Ôn tập và bổ sung)",
      "order_index": 1,
      "lessons": [
        {{
          "title": "Tên Bài học thực tế (VD: Bài 1. Ôn tập các số đến 100 000)",
          "order_index": 1,
          "page_number": 6,
          "topics": [
            {{
              "title": "Tên tiểu mục / nội dung trọng tâm của bài",
              "order_index": 1,
              "summary": "Tóm tắt kiến thức cốt lõi của bài học theo chuẩn GDPT",
              "concepts": ["Khái niệm / Định nghĩa 1", "Công thức / Quy tắc 2"],
              "learning_objectives": ["Mục tiêu cần đạt 1", "Mục tiêu cần đạt 2"]
            }}
          ]
        }}
      ]
    }}
  ]
}}
"""
            parts.append({"text": prompt_text})

            # Use latest Gemini models, NEVER 2.5
            vision_models = [settings.GEMINI_MODEL, "gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-flash-latest"]
            vision_models = list(dict.fromkeys([m for m in vision_models if m and "2.5" not in m]))

            logger.info("Đang gửi ảnh Mục lục tới mô hình Gemini Vision mới nhất...")
            with httpx.Client(timeout=60.0) as client:
                for model_name in vision_models:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                    payload = {
                        "contents": [{"parts": parts}],
                        "generationConfig": {
                            "temperature": 0.2,
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
                                ai_json = json.loads(cleaned)
                                logger.info(f"Gemini Vision ({model_name}) đọc Mục lục và tạo Knowledge Map thành công!")
                                return cls._build_extraction_result_from_vision(
                                    ai_data=ai_json,
                                    total_pages=total_pages,
                                    subject=subject,
                                    grade=grade,
                                    book_series=book_name,
                                    doc_title=doc_title,
                                )
                        else:
                            logger.warning(f"Gemini Vision ({model_name}) trả về mã lỗi {resp.status_code}: {resp.text[:200]}")
                    except Exception as model_err:
                        logger.warning(f"Lỗi khi thử mô hình Vision {model_name}: {model_err}")
            return None
        except Exception as e:
            logger.warning(f"Lỗi khi gọi Gemini Vision cho PDF scan: {str(e)}")
            return None

    @classmethod
    def get_curriculum_text(cls, parsed_doc: ParsedDocument) -> str:
        """
        Trích xuất phần văn bản Mục lục / Phân phối chương trình trọng tâm từ tài liệu SGK.
        Ở sách giáo khoa Việt Nam (Lớp 4 - Lớp 9), Mục lục luôn nằm ở 15 trang đầu hoặc 3 trang cuối.
        Việc tập trung vào Mục lục giúp AI trích xuất 100% chuẩn xác tên Chủ điểm/Bài/Trang
        chỉ trong 2-4 giây, không bị nghẽn mạng do gửi 120k ký tự thô.
        """
        pages = parsed_doc.pages
        if not pages:
            return parsed_doc.raw_text[:10000]

        total_pages = len(pages)
        toc_candidates = []

        # Check candidate pages in first 15 pages and last 3 pages
        search_indices = list(range(min(15, total_pages)))
        if total_pages > 20:
            search_indices.extend(range(max(15, total_pages - 3), total_pages))

        first_toc_idx = None
        for idx in search_indices:
            p_text = pages[idx].text
            lower_text = p_text.lower()
            # Detect TOC headers or table patterns
            has_toc_header = (
                any(kw in lower_text for kw in ["mục lục", "table of contents", "0ө&"]) or
                ("tuần" in lower_text and "bài" in lower_text and "trang" in lower_text) or
                ("nội dung" in lower_text and "trang" in lower_text and "bài" in lower_text) or
                ("chủ đề" in lower_text and "trang" in lower_text and "bài" in lower_text)
            )
            if has_toc_header and first_toc_idx is None:
                first_toc_idx = idx

        if first_toc_idx is not None:
            # Sách giáo khoa: Mục lục thường kéo dài 2-4 trang liền kề
            selected_indices = [first_toc_idx]
            for next_idx in range(first_toc_idx + 1, min(first_toc_idx + 4, total_pages)):
                nt = pages[next_idx].text.lower()
                if "bài" in nt or "trang" in nt or "tuần" in nt or "chủ đề" in nt or "nội dung" in nt:
                    selected_indices.append(next_idx)

            toc_text = "\n\n".join(pages[i].text for i in selected_indices)
            if len(toc_text.strip()) > 100:
                logger.info(f"Đã phát hiện {len(selected_indices)} trang Mục lục tại các trang: {[i+1 for i in selected_indices]}")
                return toc_text[:25000]

        # Fallback: take first 10 pages
        first_pages_text = "\n\n".join(pages[i].text for i in range(min(10, total_pages)))
        return first_pages_text[:15000]

    @classmethod
    def extract_with_gemini(
        cls,
        parsed_doc: ParsedDocument,
        subject: str,
        grade: int,
        book_series: Optional[str],
        doc_title: str,
    ) -> Optional[ExtractionResult]:
        """
        Calls Google Gemini (using the latest models, NEVER 2.5) to analyze textbook curriculum
        and produce a real curriculum knowledge map.
        Returns None if Gemini is not configured, or if the API call fails (allowing graceful fallback).
        """
        if not cls.is_gemini_configured():
            logger.info("GEMINI_API_KEY chưa được cấu hình. Sử dụng bộ trích xuất quy tắc thông minh (Smart Heuristic Extractor).")
            return None

        api_key = settings.GEMINI_API_KEY.strip()
        book_name = (book_series or "Sách Giáo Khoa chuẩn GDPT 2018").strip()

        curriculum_text = cls.get_curriculum_text(parsed_doc)

        prompt = f"""Bạn là chuyên gia sư phạm và kiến trúc sư chương trình Giáo dục Phổ thông Việt Nam (GDPT 2018), chuyên trách khối Cấp 1 (Lớp 4, Lớp 5) và Cấp 2 (Lớp 6, Lớp 7, Lớp 8, Lớp 9) của các bộ sách Kết nối tri thức, Chân trời sáng tạo, Cánh Diều.

Hãy đọc thật kỹ toàn bộ nội dung Mục lục / Phân phối chương trình thực tế sau:
- Môn học: {subject}
- Khối lớp: Lớp {grade}
- Bộ sách: {book_name}
- Tiêu đề tài liệu: {doc_title}
- Tổng số trang tài liệu: {parsed_doc.total_pages}

--- NỘI DUNG MỤC LỤC THỰC TẾ ---
{curriculum_text}
--- HẾT NỘI DUNG ---

NHIỆM VỤ QUAN TRỌNG:
1. Trích xuất ĐẦY ĐỦ TẤT CẢ các Chủ điểm / Chương (chapters) xuất hiện trong Mục lục trên.
2. Trích xuất ĐẦY ĐỦ TẤT CẢ các Bài học (lessons) của từng Chủ điểm/Chương kèm đúng số trang (page_number). TUYỆT ĐỐI KHÔNG ĐƯỢC BỎ SÓT bài học nào!
3. Trong mỗi bài học, trích xuất các phân môn / hoạt động (topics: Đọc, Luyện từ và câu, Viết, Nói và nghe...) kèm tóm tắt kiến thức cốt lõi (summary), các khái niệm chính (concepts), và mục tiêu cần đạt (learning_objectives) theo chuẩn GDPT 2018 Lớp {grade}.
4. TUYỆT ĐỐI KHÔNG dùng tên chung chung như "Nội dung trang X". Dùng đúng tên Chủ điểm và Bài học có trong Mục lục!

ĐỊNH DẠNG TRẢ VỀ:
CHỈ trả về DUY NHẤT một chuỗi JSON hợp lệ (không kèm văn bản giải thích bên ngoài):
{{
  "chapters": [
    {{
      "title": "Tên Chủ điểm / Chương thực tế",
      "order_index": 1,
      "lessons": [
        {{
          "title": "Tên Bài học thực tế",
          "order_index": 1,
          "page_number": 8,
          "topics": [
            {{
              "title": "Tên phân môn / nội dung trọng tâm",
              "order_index": 1,
              "summary": "Tóm tắt ngắn gọn",
              "concepts": ["Khái niệm 1"],
              "learning_objectives": ["Mục tiêu cần đạt 1"]
            }}
          ]
        }}
      ]
    }}
  ]
}}
"""

        # Ensure latest models are prioritized and NO 2.5 models are used
        models_to_try = [
            settings.GEMINI_MODEL,
            "gemini-flash-lite-latest",
            "gemini-3.5-flash-lite",
            "gemini-3.1-flash-lite",
            "gemini-flash-latest"
        ]
        # Deduplicate while preserving order and filter out any 2.5
        models_to_try = list(dict.fromkeys([m for m in models_to_try if m and "2.5" not in m]))
        ai_response_json = None

        logger.info(f"Đang phân tích cấu trúc tài liệu bằng mô hình Gemini thế hệ mới nhất ({models_to_try[0]})...")
        with httpx.Client(timeout=45.0) as client:
            for model_name in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.2,
                        "responseMimeType": "application/json",
                    },
                }

                try:
                    logger.info(f"Đang gửi dữ liệu Mục lục tới Gemini ({model_name})...")
                    resp = client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            text_content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                            cleaned = re.sub(r"^```(?:json)?\s*", "", text_content.strip())
                            cleaned = re.sub(r"\s*```$", "", cleaned.strip())
                            raw_parsed = json.loads(cleaned)

                            # Handle both list and dict formats
                            if isinstance(raw_parsed, list):
                                ai_response_json = {"chapters": raw_parsed}
                            elif isinstance(raw_parsed, dict):
                                ai_response_json = raw_parsed

                            logger.info(f"Gemini ({model_name}) trích xuất tri thức thành công!")
                            break
                    else:
                        logger.warning(f"Gemini ({model_name}) trả về mã lỗi {resp.status_code}: {resp.text[:200]}")
                except Exception as e:
                    logger.warning(f"Lỗi khi gọi Gemini ({model_name}): {str(e)}")

        if not ai_response_json or not ai_response_json.get("chapters"):
            logger.warning("Không nhận được cấu trúc JSON hợp lệ từ Gemini. Chuyển sang Smart Heuristic Extractor.")
            return None

        return cls._build_extraction_result(
            ai_data=ai_response_json,
            parsed_doc=parsed_doc,
            subject=subject,
            grade=grade,
            book_series=book_name,
            doc_title=doc_title,
        )

    @classmethod
    def _build_extraction_result(
        cls,
        ai_data: Dict[str, Any],
        parsed_doc: ParsedDocument,
        subject: str,
        grade: int,
        book_series: str,
        doc_title: str,
    ) -> ExtractionResult:
        return cls._build_extraction_result_from_vision(
            ai_data=ai_data,
            total_pages=parsed_doc.total_pages,
            subject=subject,
            grade=grade,
            book_series=book_series,
            doc_title=doc_title,
            total_chars=parsed_doc.total_chars,
        )

    @classmethod
    def _build_extraction_result_from_vision(
        cls,
        ai_data: Dict[str, Any],
        total_pages: int,
        subject: str,
        grade: int,
        book_series: str,
        doc_title: str,
        total_chars: int = 0,
    ) -> ExtractionResult:
        """Constructs 8-level tree and chunk objects from Gemini output."""
        book_node = ExtractedNode(
            node_type=KnowledgeNodeType.BOOK,
            title=book_series,
            description=f"Bộ sách {book_series}",
            order_index=1,
            properties={"doc_title": doc_title},
        )

        grade_node = ExtractedNode(
            node_type=KnowledgeNodeType.GRADE,
            title=f"Lớp {grade}",
            description=f"Khối lớp {grade}",
            order_index=grade,
            children=[book_node],
        )

        subject_node = ExtractedNode(
            node_type=KnowledgeNodeType.SUBJECT,
            title=subject,
            description=f"Môn học {subject}",
            order_index=1,
            children=[grade_node],
        )

        chapters = ai_data if isinstance(ai_data, list) else (ai_data.get("chapters", []) if isinstance(ai_data, dict) else [])
        total_concepts = 0
        total_objectives = 0
        total_topics = 0
        total_lessons = 0

        chunks: List[ExtractedChunk] = []
        chunk_idx = 0

        for chap_idx, ch in enumerate(chapters, start=1):
            chap_title = ch.get("title", f"Chương {chap_idx}")
            chap_node = ExtractedNode(
                node_type=KnowledgeNodeType.CHAPTER,
                title=chap_title,
                order_index=chap_idx,
            )
            book_node.children.append(chap_node)

            lessons = ch.get("lessons", [])
            for les_idx, les in enumerate(lessons, start=1):
                total_lessons += 1
                les_title = les.get("title", f"Bài {les_idx}")
                les_page = les.get("page_number", None)

                les_node = ExtractedNode(
                    node_type=KnowledgeNodeType.LESSON,
                    title=les_title,
                    order_index=les_idx,
                    properties={"page": les_page} if les_page else {},
                )
                chap_node.children.append(les_node)

                topics = les.get("topics", [])
                for top_idx, top in enumerate(topics, start=1):
                    total_topics += 1
                    top_title = top.get("title", f"Chủ đề {top_idx}")
                    summary = top.get("summary", "")

                    top_node = ExtractedNode(
                        node_type=KnowledgeNodeType.TOPIC,
                        title=top_title,
                        description=summary,
                        order_index=top_idx,
                        properties={"page": les_page} if les_page else {},
                    )
                    les_node.children.append(top_node)

                    chunk_content = f"{chap_title}\n{les_title}\n{top_title}\n\n{summary}"
                    if len(chunk_content.strip()) < 50:
                        chunk_content = f"{les_title} - {top_title}: {summary}"

                    concepts = top.get("concepts", [])
                    objectives = top.get("learning_objectives", [])

                    for con_idx, con_title in enumerate(concepts, start=1):
                        total_concepts += 1
                        con_node = ExtractedNode(
                            node_type=KnowledgeNodeType.CONCEPT,
                            title=con_title,
                            order_index=con_idx,
                        )
                        top_node.children.append(con_node)

                        for obj_idx, obj_title in enumerate(objectives, start=1):
                            total_objectives += 1
                            obj_node = ExtractedNode(
                                node_type=KnowledgeNodeType.LEARNING_OBJECTIVE,
                                title=obj_title,
                                order_index=obj_idx,
                            )
                            con_node.children.append(obj_node)

                    first_concept = concepts[0] if concepts else None
                    first_obj = objectives[0] if objectives else None

                    chunks.append(
                        ExtractedChunk(
                            chunk_index=chunk_idx,
                            content=chunk_content.strip(),
                            char_count=len(chunk_content.strip()),
                            page_number=les_page or min(chunk_idx + 1, total_pages or 1),
                            chapter=chap_title,
                            lesson=les_title,
                            topic=top_title,
                            concept=first_concept,
                            learning_objective=first_obj,
                            chunk_metadata={"source": "Gemini AI Knowledge Extractor", "page": les_page},
                        )
                    )
                    chunk_idx += 1

        summary_metadata = {
            "ai_extracted": True,
            "total_pages": total_pages,
            "total_chars": total_chars or sum(c.char_count for c in chunks),
            "total_chunks": len(chunks),
            "total_chapters": len(chapters),
            "total_lessons": total_lessons,
            "total_topics": total_topics,
            "total_concepts": total_concepts,
            "total_learning_objectives": total_objectives,
        }

        return ExtractionResult(
            chunks=chunks,
            root_nodes=[subject_node],
            summary_metadata=summary_metadata,
        )
