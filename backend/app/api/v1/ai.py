from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_teacher_or_admin, get_current_student, get_current_user, get_db
from app.models.user import User
from app.schemas.ai import (
    AiQuestionGenerateRequest,
    AiQuestionGenerateResponse,
    AdaptivePracticeRequest,
    AdaptivePracticeResponse,
)
from app.schemas.chat import ChatMessageInput, ChatMessageResponse
from app.schemas.roadmap import LearningRoadmapResponse
from app.schemas.teacher_intelligence import (
    AssignRemedialRequest,
    AssignRemedialResponse,
    StudentAiEvaluationResponse,
    TeacherClassOverviewResponse,
)
from app.services.ai_question_service import GeminiQuestionGenerator
from app.services.adaptive_practice_service import AdaptivePracticeService
from app.services.ai_chat_companion_service import AiChatCompanionService
from app.services.learning_roadmap_service import LearningRoadmapService
from app.services.teacher_intelligence_service import TeacherIntelligenceService
from app.services.trial_guard_service import TrialGuardService

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/questions/generate", response_model=AiQuestionGenerateResponse)
def generate_ai_questions(
    request_in: AiQuestionGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """
    Generate multiple-choice questions automatically using Google Gemini AI (Teacher / Admin only).
    
    Grounding Rules:
    - Primary Curriculum Grounding: Textbook / Knowledge Map (SGK làm chuẩn kiến thức & mục tiêu)
    - Real-world Context: Web / Real-life scenarios (khi use_web_context=True)
    - Validation: Strict backend verification for 4 options, 1 correct answer, non-empty explanation
    """
    TrialGuardService.check_and_increment_trial_usage(db, current_user, "sinh_cau_hoi_ai")

    if request_in.grade < 4 or request_in.grade > 9:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hệ thống chỉ hỗ trợ sinh câu hỏi cho khối lớp từ 4 đến 9",
        )

    try:
        response = GeminiQuestionGenerator.generate_questions(
            db=db,
            req=request_in,
            user_id=current_user.id,
        )
        return response
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi sinh câu hỏi bằng AI: {str(exc)}",
        )


@router.post("/adaptive-practice", response_model=AdaptivePracticeResponse)
def create_adaptive_practice_exam(
    request_in: AdaptivePracticeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student),
) -> Any:
    """
    Generate a personalized AI practice exam tailored to the student's weak areas.
    """
    TrialGuardService.check_and_increment_trial_usage(db, current_user, "de_tu_luyen_ai")
    try:
        response = AdaptivePracticeService.create_adaptive_practice(
            db=db,
            student=current_user,
            req=request_in,
        )
        return response
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi tạo đề tự luyện AI cá nhân hóa: {str(exc)}",
        )


@router.post("/chat", response_model=ChatMessageResponse)
def chat_with_ai_companion(
    chat_in: ChatMessageInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    1-on-1 Interactive AI Study Companion / Q&A Bot.
    Enforces SGK Grounding Rule (strictly limits knowledge & tone to student's grade level 4-9)
    and provides explicit SGK citations (Chapter, Lesson, Page Number).
    """
    TrialGuardService.check_and_increment_trial_usage(db, current_user, "tro_ly_ai_chat")
    try:
        return AiChatCompanionService.generate_chat_reply(
            db=db,
            student=current_user,
            chat_in=chat_in,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi tương tác với Trợ Lý AI: {str(exc)}",
        )



@router.get("/roadmap", response_model=LearningRoadmapResponse)
def get_learning_roadmap(
    subject: Optional[str] = Query(None, description="Môn học (Toán, Tiếng Việt, Tiếng Anh...)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    AI Personalized Learning Roadmap & Weakness Map.
    Analyzes historical exam performance and computes Mastery Level (0-100%) per chapter/lesson.
    """
    try:
        return LearningRoadmapService.get_student_roadmap(
            db=db,
            student=current_user,
            subject=subject,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi phân tích lộ trình học tập AI: {str(exc)}",
        )


@router.get("/teacher/class-analytics", response_model=TeacherClassOverviewResponse)
def get_teacher_class_analytics(
    subject: Optional[str] = Query("Toán", description="Môn học"),
    grade: Optional[int] = Query(5, ge=4, le=9, description="Khối lớp"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """
    AI Teacher Class Intelligence & Student Assessment Analytics Dashboard.
    Analyzes class-wide performance, student risk breakdown (🟢 🟡 🔴), and knowledge gaps.
    """
    try:
        return TeacherIntelligenceService.get_class_overview_analytics(
            db=db,
            teacher=current_user,
            subject=subject,
            grade=grade,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi tải dữ liệu phân tích lớp học: {str(exc)}",
        )


@router.get("/teacher/student-evaluation/{student_id}", response_model=StudentAiEvaluationResponse)
def get_student_ai_evaluation(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """
    1-Click AI Student Evaluation & Progress Report Card for Teacher/Parent.
    """
    try:
        return TeacherIntelligenceService.generate_student_evaluation_report(
            db=db,
            student_id=student_id,
            teacher=current_user,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi sinh nhận xét học sinh: {str(exc)}",
        )


@router.post("/teacher/assign-remedial", response_model=AssignRemedialResponse)
def assign_remedial_practice(
    req: AssignRemedialRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher_or_admin),
) -> Any:
    """
    Assign a targeted remedial AI practice exam to specific weak students.
    """
    TrialGuardService.check_and_increment_trial_usage(db, current_user, "giao_bai_khac_phuc")
    try:
        return TeacherIntelligenceService.assign_remedial_practice_exam(
            db=db,
            teacher=current_user,
            req=req,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi giao bài thi tự luyện khắc phục điểm yếu: {str(exc)}",
        )





