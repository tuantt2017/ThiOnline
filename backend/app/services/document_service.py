import os
import uuid
import shutil
import logging
from typing import Optional, List, Dict, Any, Tuple
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.document import (
    Document,
    DocumentChunk,
    KnowledgeNode,
    DocumentStatus,
    DocumentType,
    KnowledgeNodeType,
)
from app.services.parser import parse_document_file, DocumentParsingError
from app.services.extractor import StructureExtractor, ExtractedNode

logger = logging.getLogger(__name__)


class DocumentServiceError(Exception):
    pass


class DocumentService:
    @staticmethod
    def get_file_type_from_filename(filename: str) -> DocumentType:
        ext = os.path.splitext(filename)[1].lower()
        if ext == ".pdf":
            return DocumentType.PDF
        elif ext in (".docx", ".doc"):
            return DocumentType.DOCX
        elif ext == ".txt":
            return DocumentType.TXT
        else:
            raise DocumentServiceError(
                f"Định dạng tệp không được hỗ trợ ({ext}). Chỉ chấp nhận PDF, DOCX, TXT."
            )

    @classmethod
    def save_uploaded_file(
        cls,
        file: UploadFile,
        upload_dir: Optional[str] = None,
    ) -> Tuple[str, str, int, DocumentType]:
        """Save uploaded file to disk and return (saved_path, original_filename, file_size, file_type)."""
        upload_dir = upload_dir or settings.UPLOAD_DIR
        os.makedirs(upload_dir, exist_ok=True)

        original_filename = file.filename or "uploaded_file"
        file_type = cls.get_file_type_from_filename(original_filename)

        unique_id = uuid.uuid4().hex[:10]
        sanitized_filename = f"{unique_id}_{original_filename.replace(' ', '_')}"
        destination_path = os.path.join(upload_dir, sanitized_filename)

        # Read in chunks to enforce MAX_UPLOAD_SIZE_MB
        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        total_bytes = 0

        with open(destination_path, "wb") as buffer:
            while True:
                chunk = file.file.read(1024 * 1024)  # 1MB
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    buffer.close()
                    if os.path.exists(destination_path):
                        os.remove(destination_path)
                    raise DocumentServiceError(
                        f"Kích thước tệp vượt quá giới hạn cho phép ({settings.MAX_UPLOAD_SIZE_MB}MB)."
                    )
                buffer.write(chunk)

        if total_bytes == 0:
            if os.path.exists(destination_path):
                os.remove(destination_path)
            raise DocumentServiceError("Tệp tải lên rỗng (0 bytes).")

        return destination_path, original_filename, total_bytes, file_type

    @classmethod
    def create_document(
        cls,
        db: Session,
        title: str,
        filename: str,
        file_path: str,
        file_type: DocumentType,
        file_size: int,
        subject: str,
        grade: int,
        book_series: Optional[str],
        uploaded_by_id: int,
    ) -> Document:
        doc = Document(
            title=title,
            filename=filename,
            file_path=file_path,
            file_type=file_type,
            file_size=file_size,
            subject=subject,
            grade=grade,
            book_series=book_series,
            status=DocumentStatus.PENDING,
            uploaded_by_id=uploaded_by_id,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc

    @classmethod
    def process_document(cls, db: Session, document_id: int) -> Document:
        """Parse file, extract chunks, build Knowledge Map, and update Document status."""
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise DocumentServiceError(f"Không tìm thấy tài liệu ID {document_id}")

        # Set status to PROCESSING
        doc.status = DocumentStatus.PROCESSING
        doc.error_message = None
        db.commit()

        try:
            from app.services.gemini_service import GeminiKnowledgeService

            result = None
            parsed_doc = None

            # 1. Check if PDF is scanned or watermark-dominated, use Gemini Vision
            if doc.file_type == DocumentType.PDF and GeminiKnowledgeService.is_scanned_or_watermarked_pdf(doc.file_path):
                logger.info(f"Phát hiện tài liệu ID {doc.id} là PDF scan ảnh. Kích hoạt Gemini Vision trích xuất Mục lục & Tri thức...")
                if GeminiKnowledgeService.is_gemini_configured():
                    try:
                        result = GeminiKnowledgeService.extract_from_scanned_pdf(
                            file_path=doc.file_path,
                            subject=doc.subject,
                            grade=doc.grade,
                            book_series=doc.book_series,
                            doc_title=doc.title,
                        )
                    except Exception as vision_err:
                        logger.warning(f"Lỗi khi xử lý PDF scan qua Gemini Vision: {vision_err}")

            # 2. If not a scanned PDF or vision wasn't available: parse text
            if result is None:
                parsed_doc = parse_document_file(doc.file_path, doc.file_type)

                # Try standard text-based Gemini AI
                if GeminiKnowledgeService.is_gemini_configured():
                    try:
                        result = GeminiKnowledgeService.extract_with_gemini(
                            parsed_doc=parsed_doc,
                            subject=doc.subject,
                            grade=doc.grade,
                            book_series=doc.book_series,
                            doc_title=doc.title,
                        )
                    except Exception as ai_err:
                        logger.warning(f"Lỗi khi xử lý bằng Gemini AI: {ai_err}. Sử dụng bộ trích xuất dự phòng.")

                # Fallback to smart heuristic extractor
                if result is None:
                    extractor = StructureExtractor(
                        subject=doc.subject,
                        grade=doc.grade,
                        book_series=doc.book_series,
                        title=doc.title,
                    )
                    result = extractor.extract(parsed_doc)



            # 3. Clear old chunks & knowledge nodes if retrying
            db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete()
            db.query(KnowledgeNode).filter(KnowledgeNode.document_id == doc.id).delete()
            db.flush()

            # 4. Save chunks
            db_chunks = []
            for c in result.chunks:
                db_chunk = DocumentChunk(
                    document_id=doc.id,
                    chunk_index=c.chunk_index,
                    content=c.content,
                    char_count=c.char_count,
                    page_number=c.page_number,
                    chapter=c.chapter,
                    lesson=c.lesson,
                    topic=c.topic,
                    concept=c.concept,
                    learning_objective=c.learning_objective,
                    chunk_metadata=c.chunk_metadata,
                )
                db_chunks.append(db_chunk)

            db.add_all(db_chunks)

            # 5. Save Knowledge Nodes recursively
            def save_node(node: ExtractedNode, parent_id: Optional[int] = None) -> KnowledgeNode:
                db_node = KnowledgeNode(
                    document_id=doc.id,
                    parent_id=parent_id,
                    node_type=node.node_type,
                    title=node.title,
                    description=node.description,
                    order_index=node.order_index,
                    properties=node.properties,
                )
                db.add(db_node)
                db.flush()  # to get db_node.id

                for child in node.children:
                    save_node(child, parent_id=db_node.id)

                return db_node

            for root_node in result.root_nodes:
                save_node(root_node, parent_id=None)

            # 6. Update Document status to COMPLETED
            doc.status = DocumentStatus.COMPLETED
            doc.total_pages = parsed_doc.total_pages if parsed_doc else result.summary_metadata.get("total_pages", 1)
            doc.chunk_count = len(result.chunks)
            doc.extracted_metadata = result.summary_metadata
            doc.error_message = None

            db.commit()
            db.refresh(doc)
            return doc

        except Exception as e:
            db.rollback()
            logger.exception(f"Lỗi khi xử lý tài liệu ID {document_id}: {str(e)}")
            # Mark document as FAILED
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.status = DocumentStatus.FAILED
                doc.error_message = str(e)
                db.commit()
                db.refresh(doc)
            return doc

    @classmethod
    def process_document_in_background(cls, document_id: int) -> None:
        """Background task wrapper: uses dedicated DB session to process document."""
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            logger.info(f"Bắt đầu tác vụ nền xử lý tài liệu ID {document_id}...")
            cls.process_document(db=db, document_id=document_id)
            logger.info(f"Hoàn thành xử lý tài liệu ID {document_id} trong tác vụ nền.")
        except Exception as e:
            logger.exception(f"Lỗi không mong muốn trong tác vụ nền xử lý tài liệu ID {document_id}: {e}")
            try:
                doc = db.query(Document).filter(Document.id == document_id).first()
                if doc:
                    doc.status = DocumentStatus.FAILED
                    doc.error_message = str(e)
                    db.commit()
            except Exception:
                db.rollback()
        finally:
            db.close()

    @classmethod
    def retry_processing(cls, db: Session, document_id: int) -> Document:
        """Retry processing a failed or pending document."""
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise DocumentServiceError(f"Không tìm thấy tài liệu ID {document_id}")
        return cls.process_document(db, document_id)

    @classmethod
    def get_document_knowledge_map(cls, db: Session, document_id: int) -> List[Dict[str, Any]]:
        """Fetch full Knowledge Map tree for a given document."""
        # Query root nodes (parent_id is None) belonging to document
        nodes = (
            db.query(KnowledgeNode)
            .filter(KnowledgeNode.document_id == document_id)
            .order_by(KnowledgeNode.order_index)
            .all()
        )

        node_dict: Dict[int, Dict[str, Any]] = {}
        roots: List[Dict[str, Any]] = []

        for node in nodes:
            node_dict[node.id] = {
                "id": node.id,
                "node_type": node.node_type.value,
                "title": node.title,
                "description": node.description,
                "order_index": node.order_index,
                "properties": node.properties or {},
                "children": [],
            }

        for node in nodes:
            entry = node_dict[node.id]
            if node.parent_id and node.parent_id in node_dict:
                node_dict[node.parent_id]["children"].append(entry)
            elif not node.parent_id:
                roots.append(entry)

        return roots

    @classmethod
    def get_overview_knowledge_map(cls, db: Session) -> List[Dict[str, Any]]:
        """Fetch combined Knowledge Map across all completed documents."""
        docs = (
            db.query(Document)
            .filter(Document.status == DocumentStatus.COMPLETED)
            .order_by(Document.subject, Document.grade)
            .all()
        )
        overview = []
        for doc in docs:
            tree = cls.get_document_knowledge_map(db, doc.id)
            overview.append({
                "document_id": doc.id,
                "title": doc.title,
                "subject": doc.subject,
                "grade": doc.grade,
                "book_series": doc.book_series,
                "tree": tree,
            })
        return overview

    @classmethod
    def delete_document(cls, db: Session, document_id: int) -> bool:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return False

        file_path = doc.file_path
        db.delete(doc)
        db.commit()

        # Delete physical file from disk
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

        return True
