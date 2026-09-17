import math
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_teacher_or_admin,
    get_current_user,
    get_current_user_optional,
    get_db,
)
from app.models.exam import ExamStatus
from app.models.user import User
from app.schemas.exam import (
    AnswerSubmitInput,
    AttemptAnswerResponse,
    ExamAttemptResultResponse,
    ExamCreateInput,
    ExamListResponse,
    ExamReportResponse,
    ExamResponse,
    ExamUpdateInput,
    StudentExamTakeResponse,
    TeacherExamsSummaryItem,
)
from app.services import exam_service

router = APIRouter(prefix="/exams", tags=["exams"])


@router.get("/", response_model=ExamListResponse)
def list_exams(
    subject: Optional[str] = None,
    grade: Optional[int] = None,
    status_filter: Optional[ExamStatus] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> Any:
    """List exams with filters and pagination."""
    # For students or unauthenticated users, only PUBLISHED exams are visible
    if not current_user or current_user.role.value == "STUDENT":
        status_filter = ExamStatus.PUBLISHED
        if current_user and current_user.role.value == "STUDENT" and current_user.grade and grade is None:
            grade = current_user.grade


    skip = (page - 1) * page_size
    items, total = exam_service.get_exams(
        db=db,
        subject=subject,
        grade=grade,
        status_filter=status_filter,
        skip=skip,
        limit=page_size,
        current_user=current_user,
    )
    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return ExamListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
def create_exam(
    exam_in: ExamCreateInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """Create a new exam (Teacher/Admin only)."""
    return exam_service.create_exam(
        db=db,
        exam_in=exam_in,
        user_id=current_user.id,
    )


@router.get("/my-attempts", response_model=List[ExamAttemptResultResponse])
def get_my_attempts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get all attempts for the current student."""
    return exam_service.get_student_attempts(db=db, student=current_user)


@router.get("/reports/summary", response_model=List[TeacherExamsSummaryItem])
def get_teacher_exams_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """Get summary performance statistics for all created exams (Teacher/Admin only)."""
    return exam_service.get_teacher_exams_summary(db=db, user=current_user)


@router.get("/{id}/report", response_model=ExamReportResponse)
def get_exam_report(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """Get comprehensive student performance report for a specific exam (Teacher/Admin only)."""
    return exam_service.get_exam_report(db=db, exam_id=id, user=current_user)


@router.get("/{id}", response_model=ExamResponse)

def get_exam_detail(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """Get detailed exam metadata including questions (Teacher/Admin only)."""
    return exam_service.get_exam(db=db, exam_id=id)


@router.put("/{id}", response_model=ExamResponse)
def update_exam(
    id: int,
    exam_in: ExamUpdateInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """Update exam configuration and question set (Teacher/Admin only)."""
    return exam_service.update_exam(
        db=db,
        exam_id=id,
        exam_in=exam_in,
        user=current_user,
    )


@router.post("/{id}/publish", response_model=ExamResponse)
def publish_exam(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """Publish exam for students (Teacher/Admin only)."""
    return exam_service.publish_exam(db=db, exam_id=id, user=current_user)


# --- STUDENT EXAM ENGINE & SECURITY ENDPOINTS ---

@router.post("/{id}/start", response_model=StudentExamTakeResponse)
def start_exam(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Start an exam attempt for the current student with Server-Authoritative Timer."""
    attempt = exam_service.start_exam_attempt(
        db=db,
        exam_id=id,
        student=current_user,
    )
    return exam_service.get_student_attempt_room(
        db=db,
        attempt_id=attempt.id,
        student=current_user,
    )


@router.get("/attempts/{attempt_id}", response_model=StudentExamTakeResponse)
def get_attempt_room(
    attempt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Get active exam room payload.
    SECURITY EXAM: All correct answers and explanations are COMPLETELY MASKED from this payload!
    """
    return exam_service.get_student_attempt_room(
        db=db,
        attempt_id=attempt_id,
        student=current_user,
    )


@router.post("/attempts/{attempt_id}/answers", response_model=AttemptAnswerResponse)
def save_answer(
    attempt_id: int,
    answer_in: AnswerSubmitInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Autosave answer for a question in real-time. Immediately persisted to DB."""
    return exam_service.autosave_answer(
        db=db,
        attempt_id=attempt_id,
        answer_in=answer_in,
        student=current_user,
    )


@router.post("/attempts/{attempt_id}/submit", response_model=ExamAttemptResultResponse)
def submit_attempt(
    attempt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Submit exam attempt and calculate grades automatically on the backend."""
    return exam_service.submit_exam_attempt(
        db=db,
        attempt_id=attempt_id,
        student=current_user,
    )


from app.schemas.ai import AiTutorResponse
from app.services.ai_tutor_service import AiTutorService


@router.get("/attempts/{attempt_id}/result", response_model=ExamAttemptResultResponse)
def get_attempt_result(
    attempt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get exam attempt result with detailed breakdown and explanations after submission."""
    return exam_service.get_attempt_result(
        db=db,
        attempt_id=attempt_id,
        user=current_user,
    )


@router.post("/attempts/{attempt_id}/ai-tutor", response_model=AiTutorResponse)
def get_ai_tutor_feedback(
    attempt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Generate AI Tutor analysis & feedback for incorrect answers using Gemini AI & SGK Grounding Rule.
    Available after exam submission (SUBMITTED / TIMED_OUT).
    """
    return AiTutorService.generate_tutor_feedback(
        db=db,
        attempt_id=attempt_id,
        user=current_user,
    )

