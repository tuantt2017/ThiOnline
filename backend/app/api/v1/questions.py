import math
from typing import Any, Optional
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_teacher_or_admin,
    get_current_user,
    get_db,
)
from app.models.question import (
    QuestionDifficulty,
    QuestionSource,
    QuestionStatus,
)
from app.models.user import User
from app.schemas.question import (
    BatchStatusUpdate,
    QuestionCreate,
    QuestionListResponse,
    QuestionResponse,
    QuestionStatsResponse,
    QuestionStatusUpdate,
    QuestionUpdate,
    WordImportResult,
)
from app.services import question_service
from app.services.word_importer import import_word_questions

router = APIRouter(prefix="/questions", tags=["questions"])


@router.get("/", response_model=QuestionListResponse)
def list_questions(
    subject: Optional[str] = None,
    grade: Optional[int] = None,
    difficulty: Optional[QuestionDifficulty] = None,
    status_filter: Optional[QuestionStatus] = Query(None, alias="status"),
    source: Optional[QuestionSource] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1, description="Số trang hiện tại"),
    page_size: int = Query(20, ge=1, le=100, description="Số mục mỗi trang"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """List questions with filters, keyword search, and pagination (Teacher/Admin only)."""
    skip = (page - 1) * page_size
    items, total = question_service.get_questions(
        db=db,
        subject=subject,
        grade=grade,
        difficulty=difficulty,
        status_filter=status_filter,
        source=source,
        search=search,
        skip=skip,
        limit=page_size,
    )
    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return QuestionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/stats", response_model=QuestionStatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """Get aggregate question statistics by status, difficulty, grade, and subject."""
    stats = question_service.get_question_stats(db)
    return stats


@router.post("/", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
def create_question(
    question_in: QuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """Create a new question with options (Teacher/Admin only)."""
    return question_service.create_question(
        db=db,
        question_in=question_in,
        user_id=current_user.id,
    )


@router.get("/{id}", response_model=QuestionResponse)
def get_question(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """Get single question details by ID (Teacher/Admin only)."""
    question = question_service.get_question(db=db, question_id=id)
    return question


@router.put("/{id}", response_model=QuestionResponse)
def update_question(
    id: int,
    question_in: QuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """Update question content, metadata, or options (Teacher/Admin only)."""
    return question_service.update_question(
        db=db,
        question_id=id,
        question_in=question_in,
        user=current_user,
    )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> None:
    """Delete a question from the question bank (Teacher/Admin only)."""
    question_service.delete_question(
        db=db,
        question_id=id,
        user=current_user,
    )


@router.post("/{id}/status", response_model=QuestionResponse)
def update_status(
    id: int,
    status_in: QuestionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """Update question status (Approve, Reject, Draft, Review)."""
    return question_service.change_question_status(
        db=db,
        question_id=id,
        new_status=status_in.status,
        user=current_user,
    )


@router.post("/batch-status", response_model=dict)
def batch_update_status(
    batch_in: BatchStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """Batch update status for multiple questions at once."""
    updated_count = question_service.batch_change_status(
        db=db,
        question_ids=batch_in.question_ids,
        new_status=batch_in.status,
        user=current_user,
    )
    return {
        "message": f"Đã cập nhật trạng thái {batch_in.status.value} cho {updated_count} câu hỏi",
        "updated_count": updated_count,
    }


@router.post("/import-word", response_model=WordImportResult)
async def import_from_word(
    file: UploadFile = File(..., description="Tệp tài liệu đề thi Microsoft Word (.docx)"),
    subject: str = Form(..., description="Môn học"),
    grade: int = Form(..., description="Khối lớp (4 đến 9)"),
    chapter: Optional[str] = Form(None, description="Chương"),
    lesson: Optional[str] = Form(None, description="Bài học"),
    difficulty: QuestionDifficulty = Form(QuestionDifficulty.MEDIUM, description="Độ khó mặc định"),
    commit: bool = Form(True, description="Lưu vào CSDL ngay (True) hoặc chỉ xem trước (False)"),
    initial_status: QuestionStatus = Form(QuestionStatus.REVIEW, description="Trạng thái ban đầu"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """Upload and parse questions from a Word (.docx) file."""
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hệ thống chỉ hỗ trợ định dạng tệp Microsoft Word (.docx)",
        )

    if grade < 4 or grade > 9:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hệ thống chỉ hỗ trợ khối lớp từ 4 đến 9",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tệp tải lên rỗng",
        )

    try:
        result = import_word_questions(
            db=db,
            docx_bytes=content,
            user_id=current_user.id,
            subject=subject.strip(),
            grade=grade,
            chapter=chapter.strip() if chapter else None,
            lesson=lesson.strip() if lesson else None,
            difficulty=difficulty,
            initial_status=initial_status,
            commit=commit,
        )
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Lỗi khi đọc file Word: {str(exc)}",
        )
