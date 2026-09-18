from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.english_learning import (
    EnglishRoadmapResponse,
    EnglishUnitDetailResponse,
    PronunciationEvalRequest,
    PronunciationEvalResponse,
    GenerateCustomEnglishUnitRequest,
    CompleteUnitRequest,
)
from app.services.english_ai_service import EnglishAIService

router = APIRouter()


@router.get("/roadmap", response_model=EnglishRoadmapResponse, summary="Lộ trình học Tiếng Anh Đa Phương Thức AI")
def get_english_roadmap(
    subject: Optional[str] = "Tiếng Anh",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get personalized multimodal English learning roadmap with 4-skill stats (Vocab, Listening, Speaking, Grammar).
    """
    return EnglishAIService.get_roadmap(db=db, student=current_user, subject=subject)


@router.get("/units/{unit_id}", response_model=EnglishUnitDetailResponse, summary="Chi tiết bài học Tiếng Anh 4 bước")
def get_english_unit_detail(
    unit_id: int,
    current_user: User = Depends(get_current_user),
):
    """
    Get full 4-step content for an English unit (Flashcards + Audio TTS, Multimodal Exercises, Speaking Lab prompts).
    """
    return EnglishAIService.get_unit_detail(unit_id=unit_id)


@router.post("/units/{unit_id}/complete", summary="Đánh dấu hoàn thành bài học Tiếng Anh AI")
def complete_english_unit(
    unit_id: int,
    req: Optional[CompleteUnitRequest] = None,
    current_user: User = Depends(get_current_user),
):
    """
    Marks an English unit as COMPLETED with student's score.
    """
    score = req.score if req else 100.0
    return EnglishAIService.complete_unit(unit_id=unit_id, score=score)


@router.post("/evaluate-pronunciation", response_model=PronunciationEvalResponse, summary="AI Chấm điểm phát âm & nói")
def evaluate_pronunciation(
    req: PronunciationEvalRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Evaluates student's recorded/spoken speech against target text and returns accuracy score, word analysis, and feedback.
    """
    return EnglishAIService.evaluate_pronunciation(req=req)


@router.post("/generate-custom-unit", response_model=EnglishUnitDetailResponse, summary="Tạo bài học Tiếng Anh AI theo chủ đề yêu cầu")
def generate_custom_english_unit(
    req: GenerateCustomEnglishUnitRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Generates an on-demand customized multimodal 4-step English unit tailored to student's requested topic.
    """
    return EnglishAIService.generate_custom_unit(req=req)


