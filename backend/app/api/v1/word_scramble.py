from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.word_scramble import (
    WordScrambleQuestionResponse,
    WordScrambleVerifyRequest,
    WordScrambleVerifyResponse,
)
from app.services.word_scramble_service import WordScrambleService

router = APIRouter(prefix="/games/word-scramble", tags=["word-scramble-game"])


@router.get("/next", response_model=WordScrambleQuestionResponse)
def get_next_word_scramble_question(
    subject: Optional[str] = Query("Tiếng Việt", description="Môn học (Tiếng Việt hoặc Tiếng Anh)"),
    grade: Optional[int] = Query(None, ge=4, le=9, description="Khối lớp (4-9)"),
    stage: Optional[int] = Query(1, ge=1, le=15, description="Chặng hiện tại (1-15)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get next scrambled word/sentence question from SGK curriculum (Grade 4-9) for stage 1-15.
    """
    return WordScrambleService.get_next_question(
        db=db,
        student=current_user,
        subject=subject,
        grade=grade,
        stage=stage or 1,
    )


@router.post("/verify", response_model=WordScrambleVerifyResponse)
def verify_word_scramble_answer(
    req: WordScrambleVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Verify student's assembled word answer and update win streak / award diamonds.
    """
    return WordScrambleService.verify_answer(
        db=db,
        student=current_user,
        game_id=req.game_id,
        user_answer=req.user_answer,
        streak_count=req.streak_count,
    )
