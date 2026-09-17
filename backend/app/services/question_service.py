from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.question import (
    Question,
    QuestionDifficulty,
    QuestionOption,
    QuestionSource,
    QuestionStatus,
    QuestionType,
)
from app.models.user import User, UserRole
from app.schemas.question import QuestionCreate, QuestionUpdate


def create_question(
    db: Session,
    question_in: QuestionCreate,
    user_id: int,
) -> Question:
    """Create a new question and its options in the database."""
    if question_in.grade < 4 or question_in.grade > 9:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hệ thống chỉ hỗ trợ khối lớp từ 4 đến 9",
        )

    db_question = Question(
        content=question_in.content,
        question_type=question_in.question_type,
        difficulty=question_in.difficulty,
        status=question_in.status,
        source=question_in.source,
        subject=question_in.subject,
        grade=question_in.grade,
        chapter=question_in.chapter,
        lesson=question_in.lesson,
        topic=question_in.topic,
        learning_objective=question_in.learning_objective,
        explanation=question_in.explanation,
        knowledge_node_id=question_in.knowledge_node_id,
        document_id=question_in.document_id,
        created_by_id=user_id,
    )
    db.add(db_question)
    db.flush()

    for idx, opt in enumerate(question_in.options):
        db_opt = QuestionOption(
            question_id=db_question.id,
            option_key=opt.option_key.strip().upper(),
            content=opt.content.strip(),
            is_correct=opt.is_correct,
            explanation=opt.explanation,
            order_index=idx,
        )
        db.add(db_opt)

    db.commit()
    db.refresh(db_question)
    return db_question


def get_question(db: Session, question_id: int) -> Question:
    """Retrieve a single question by its ID."""
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy câu hỏi với ID {question_id}",
        )
    return question


def get_questions(
    db: Session,
    subject: Optional[str] = None,
    grade: Optional[int] = None,
    difficulty: Optional[QuestionDifficulty] = None,
    status_filter: Optional[QuestionStatus] = None,
    source: Optional[QuestionSource] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[List[Question], int]:
    """Query questions with flexible filters, search, and pagination."""
    query = db.query(Question)

    if subject:
        query = query.filter(Question.subject.ilike(f"%{subject.strip()}%"))
    if grade is not None:
        query = query.filter(Question.grade == grade)
    if difficulty is not None:
        query = query.filter(Question.difficulty == difficulty)
    if status_filter is not None:
        query = query.filter(Question.status == status_filter)
    if source is not None:
        query = query.filter(Question.source == source)
    if search:
        query = query.filter(
            (Question.content.ilike(f"%{search.strip()}%"))
            | (Question.chapter.ilike(f"%{search.strip()}%"))
            | (Question.lesson.ilike(f"%{search.strip()}%"))
        )

    total = query.count()
    items = (
        query.order_by(Question.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return items, total


def get_question_stats(db: Session) -> Dict[str, Any]:
    """Compute aggregate counts and statistics for the question bank."""
    total = db.query(func.count(Question.id)).scalar() or 0

    # Status counts
    status_rows = (
        db.query(Question.status, func.count(Question.id))
        .group_by(Question.status)
        .all()
    )
    by_status = {s.value if hasattr(s, "value") else str(s): cnt for s, cnt in status_rows}

    # Difficulty counts
    diff_rows = (
        db.query(Question.difficulty, func.count(Question.id))
        .group_by(Question.difficulty)
        .all()
    )
    by_difficulty = {d.value if hasattr(d, "value") else str(d): cnt for d, cnt in diff_rows}

    # Grade counts
    grade_rows = (
        db.query(Question.grade, func.count(Question.id))
        .group_by(Question.grade)
        .all()
    )
    by_grade = {str(g): cnt for g, cnt in grade_rows}

    # Subject counts
    subj_rows = (
        db.query(Question.subject, func.count(Question.id))
        .group_by(Question.subject)
        .all()
    )
    by_subject = {str(s): cnt for s, cnt in subj_rows}

    return {
        "total": total,
        "by_status": by_status,
        "by_difficulty": by_difficulty,
        "by_grade": by_grade,
        "by_subject": by_subject,
    }


def update_question(
    db: Session,
    question_id: int,
    question_in: QuestionUpdate,
    user: User,
) -> Question:
    """Update a question and optionally its options."""
    question = get_question(db, question_id)

    # Permissions: Only admin or the creator teacher can edit
    if user.role != UserRole.ADMIN and question.created_by_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền chỉnh sửa câu hỏi này",
        )

    update_data = question_in.model_dump(exclude_unset=True)
    options_data = update_data.pop("options", None)

    for field, val in update_data.items():
        setattr(question, field, val)

    if options_data is not None:
        # Delete existing options and insert updated ones
        db.query(QuestionOption).filter(QuestionOption.question_id == question.id).delete()
        for idx, opt_dict in enumerate(options_data):
            db_opt = QuestionOption(
                question_id=question.id,
                option_key=opt_dict["option_key"].strip().upper(),
                content=opt_dict["content"].strip(),
                is_correct=opt_dict["is_correct"],
                explanation=opt_dict.get("explanation"),
                order_index=idx,
            )
            db.add(db_opt)

    db.commit()
    db.refresh(question)
    return question


def delete_question(db: Session, question_id: int, user: User) -> None:
    """Delete a question."""
    question = get_question(db, question_id)

    if user.role != UserRole.ADMIN and question.created_by_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xóa câu hỏi này",
        )

    db.delete(question)
    db.commit()


def change_question_status(
    db: Session,
    question_id: int,
    new_status: QuestionStatus,
    user: User,
) -> Question:
    """Change the lifecycle status of a question (e.g. APPROVE or REJECT)."""
    question = get_question(db, question_id)
    question.status = new_status
    db.commit()
    db.refresh(question)
    return question


def batch_change_status(
    db: Session,
    question_ids: List[int],
    new_status: QuestionStatus,
    user: User,
) -> int:
    """Update status for multiple questions at once."""
    updated = (
        db.query(Question)
        .filter(Question.id.in_(question_ids))
        .update({Question.status: new_status}, synchronize_session=False)
    )
    db.commit()
    return updated
