import math
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_teacher_or_admin
from app.models.user import User
from app.models.document import Document, DocumentChunk, DocumentStatus, DocumentType
from app.schemas.document import (
    DocumentResponse,
    DocumentChunkResponse,
    PaginatedChunksResponse,
    KnowledgeMapTreeResponse,
    KnowledgeOverviewItem,
)
from app.services.document_service import DocumentService, DocumentServiceError

router = APIRouter(prefix="/documents", tags=["Documents & Knowledge Map"])


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    subject: str = Form(...),
    grade: int = Form(...),
    book_series: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
):
    """
    Tải lên tài liệu SGK / học liệu (PDF, DOCX, TXT).
    Tự động phân tích cú pháp, chia chunk và trích xuất Knowledge Map 8 cấp trong tác vụ nền (Background Task).
    Yêu cầu quyền: TEACHER hoặc ADMIN.
    """
    try:
        saved_path, original_filename, file_size, file_type = DocumentService.save_uploaded_file(file)
    except DocumentServiceError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi lưu tệp tải lên: {str(e)}",
        )

    # Create document record
    doc = DocumentService.create_document(
        db=db,
        title=title.strip(),
        filename=original_filename,
        file_path=saved_path,
        file_type=file_type,
        file_size=file_size,
        subject=subject.strip(),
        grade=grade,
        book_series=book_series.strip() if book_series else None,
        uploaded_by_id=current_user.id,
    )

    # Enqueue background processing so upload returns immediately (<100ms)
    background_tasks.add_task(DocumentService.process_document_in_background, doc.id)
    return doc


@router.get("/", response_model=List[DocumentResponse])
def list_documents(
    subject: Optional[str] = Query(None, description="Lọc theo môn học"),
    grade: Optional[int] = Query(None, description="Lọc theo khối lớp"),
    status: Optional[DocumentStatus] = Query(None, description="Lọc theo trạng thái"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách tất cả các tài liệu."""
    query = db.query(Document)
    if current_user and current_user.role.value == "STUDENT" and current_user.grade and grade is None:
        grade = current_user.grade

    if subject:
        query = query.filter(Document.subject.ilike(f"%{subject.strip()}%"))
    if grade:
        query = query.filter(Document.grade == grade)
    if status:
        query = query.filter(Document.status == status)


    return query.order_by(Document.created_at.desc()).all()


@router.get("/knowledge-map/overview", response_model=List[KnowledgeOverviewItem])
def get_knowledge_map_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy Bản đồ Tri thức tổng hợp của tất cả các tài liệu đã xử lý thành công."""
    return DocumentService.get_overview_knowledge_map(db)


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document_by_id(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy thông tin chi tiết một tài liệu theo ID."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tài liệu ID {document_id}",
        )
    return doc


@router.get("/{document_id}/chunks", response_model=PaginatedChunksResponse)
def get_document_chunks(
    document_id: int,
    page: int = Query(1, ge=1, description="Trang hiện tại (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Số lượng chunk trên mỗi trang"),
    search: Optional[str] = Query(None, description="Tìm kiếm trong nội dung chunk"),
    chapter: Optional[str] = Query(None, description="Lọc theo chương"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách các chunk đã phân đoạn của tài liệu kèm phân trang."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tài liệu ID {document_id}",
        )

    query = db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id)

    if search:
        query = query.filter(
            or_(
                DocumentChunk.content.ilike(f"%{search.strip()}%"),
                DocumentChunk.topic.ilike(f"%{search.strip()}%"),
                DocumentChunk.concept.ilike(f"%{search.strip()}%"),
                DocumentChunk.learning_objective.ilike(f"%{search.strip()}%"),
            )
        )

    if chapter:
        query = query.filter(DocumentChunk.chapter.ilike(f"%{chapter.strip()}%"))

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size

    chunks = query.order_by(DocumentChunk.chunk_index).offset(offset).limit(page_size).all()

    return PaginatedChunksResponse(
        items=chunks,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{document_id}/knowledge-map", response_model=KnowledgeMapTreeResponse)
def get_document_knowledge_map(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy cây phân cấp Knowledge Map 8 cấp của một tài liệu."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tài liệu ID {document_id}",
        )

    tree = DocumentService.get_document_knowledge_map(db, document_id)
    return KnowledgeMapTreeResponse(
        document_id=doc.id,
        title=doc.title,
        subject=doc.subject,
        grade=doc.grade,
        book_series=doc.book_series,
        tree=tree,
    )


@router.post("/{document_id}/retry", response_model=DocumentResponse)
def retry_document_processing(
    document_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
):
    """
    Thử lại quy trình xử lý tài liệu khi gặp trạng thái FAILED hoặc bị treo.
    Chạy trong tác vụ nền (Background Task).
    Yêu cầu quyền: TEACHER hoặc ADMIN.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tài liệu ID {document_id}",
        )

    # Reset status to PENDING
    doc.status = DocumentStatus.PENDING
    doc.error_message = None
    db.commit()
    db.refresh(doc)

    background_tasks.add_task(DocumentService.process_document_in_background, doc.id)
    return doc


@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
):
    """
    Xóa tài liệu cùng toàn bộ chunk, cây tri thức và tệp đính kèm trên ổ đĩa.
    Yêu cầu quyền: TEACHER hoặc ADMIN.
    """
    deleted = DocumentService.delete_document(db, document_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tài liệu ID {document_id}",
        )
    return {"message": "Đã xóa tài liệu và dữ liệu liên quan thành công"}
