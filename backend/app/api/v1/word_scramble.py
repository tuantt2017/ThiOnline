from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.word_scramble import (
    WordScrambleQuestionResponse,
    WordScrambleVerifyRequest,
    WordScrambleVerifyResponse,
    WordScrambleProgressResponse,
    WordScrambleProgressSaveRequest,
    WordCollectionResponse,
    WordScramblePrepareStageRequest,
    WordScramblePrepareStageResponse,
)
from app.services.word_scramble_service import WordScrambleService

router = APIRouter(prefix="/games/word-scramble", tags=["word-scramble-game"])


@router.post("/prepare-stage", response_model=WordScramblePrepareStageResponse)
def prepare_word_scramble_stage(
    req: WordScramblePrepareStageRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Pre-generates 10 questions for a stage with Gemini AI in a single call or retrieves from stage cache.
    """
    grade = req.grade or current_user.grade or 5
    words, is_cached, is_ai = WordScrambleService.prepare_stage_words(
        user_id=current_user.id,
        subject=req.subject,
        grade=grade,
        stage=req.stage,
        force_refresh=bool(req.force_refresh),
    )
    theme_title = WordScrambleService.get_theme_title(req.stage, req.subject)
    rank_title = WordScrambleService.get_rank_title(req.stage)
    return WordScramblePrepareStageResponse(
        status="ready",
        subject=req.subject,
        grade=grade,
        stage=req.stage,
        total_words=len(words),
        theme_title=theme_title,
        rank_title=rank_title,
        is_cached=is_cached,
        is_ai_generated=is_ai,
        message="Bộ từ vựng của chặng đã sẵn sàng!" if is_cached else "Gemini AI đã biên soạn thành công 10 từ vựng cho chặng!",
    )


@router.get("/next", response_model=WordScrambleQuestionResponse)
def get_next_word_scramble_question(
    subject: Optional[str] = Query("Tiếng Việt", description="Môn học (Tiếng Việt hoặc Tiếng Anh)"),
    grade: Optional[int] = Query(None, ge=4, le=9, description="Khối lớp (4-9)"),
    stage: Optional[int] = Query(1, ge=1, le=999, description="Chặng hiện tại (1-15 hoặc >15 cho Đấu Trường Vô Cực)"),
    question_index: Optional[int] = Query(1, ge=1, le=10, description="Thứ tự câu hỏi trong chặng (1-10)"),
    force_refresh: Optional[bool] = Query(False, description="Tạo mới bộ 10 từ vựng AI cho chặng này"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get next scrambled word/sentence question from SGK curriculum (Grade 4-9) for stage 1-15 and infinite stages.
    """
    return WordScrambleService.get_next_question(
        db=db,
        student=current_user,
        subject=subject,
        grade=grade,
        stage=stage or 1,
        question_index=question_index or 1,
        force_refresh=bool(force_refresh),
    )


@router.post("/verify", response_model=WordScrambleVerifyResponse)
def verify_word_scramble_answer(
    req: WordScrambleVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Verify student's assembled word answer and update win streak / award diamonds / unlock to collection.
    """
    return WordScrambleService.verify_answer(
        db=db,
        student=current_user,
        game_id=req.game_id,
        user_answer=req.user_answer,
        streak_count=req.streak_count,
    )


@router.get("/progress", response_model=WordScrambleProgressResponse)
def get_word_scramble_progress(
    subject: Optional[str] = Query("Tiếng Việt", description="Môn học (Tiếng Việt / Tiếng Anh)"),
    grade: Optional[int] = Query(5, ge=4, le=9, description="Khối lớp (4-9)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves student's persistent game stage & question progress by subject & grade.
    """
    res = WordScrambleService.get_user_progress(
        db=db,
        student=current_user,
        subject=subject or "Tiếng Việt",
        grade=grade or 5,
    )
    return WordScrambleProgressResponse(**res)


@router.post("/progress", response_model=WordScrambleProgressResponse)
def save_word_scramble_progress(
    req: WordScrambleProgressSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Saves student's persistent game stage & question progress.
    """
    res = WordScrambleService.save_user_progress(
        db=db,
        student=current_user,
        subject=req.subject,
        grade=req.grade,
        stage=req.stage,
        question_index=req.question_index,
        streak=req.streak or 0,
    )
    return WordScrambleProgressResponse(**res)


@router.get("/collection", response_model=WordCollectionResponse)
def get_word_scramble_collection(
    subject: Optional[str] = Query(None, description="Lọc theo môn (Tiếng Việt / Tiếng Anh)"),
    grade: Optional[int] = Query(None, ge=4, le=9, description="Lọc theo khối lớp (4-9)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves student's unlocked vocabulary collection (Vocabulary Album).
    """
    return WordScrambleService.get_user_collection(
        db=db,
        student=current_user,
        subject=subject,
        grade=grade,
    )
