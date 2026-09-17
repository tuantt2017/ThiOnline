import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.question import Question, QuestionSource, QuestionStatus
from app.schemas.ai import AiQuestionGenerateRequest, DifficultyDistribution
from app.services.ai_question_service import BackendQuestionValidator, GeminiQuestionGenerator


def test_validator_valid_question():
    q_data = {
        "question_text": "Tìm x biết: x + 10 = 25",
        "difficulty": "EASY",
        "explanation": "x = 25 - 10 = 15. Chọn A.",
        "options": [
            {"key": "A", "text": "x = 15", "is_correct": True},
            {"key": "B", "text": "x = 20", "is_correct": False},
            {"key": "C", "text": "x = 35", "is_correct": False},
            {"key": "D", "text": "x = 5", "is_correct": False},
        ],
    }
    is_valid, errors = BackendQuestionValidator.validate_question(q_data)
    assert is_valid is True
    assert len(errors) == 0


def test_validator_invalid_options_count():
    q_data = {
        "question_text": "Câu hỏi lỗi số phương án",
        "difficulty": "MEDIUM",
        "explanation": "Giải thích",
        "options": [
            {"key": "A", "text": "Phương án 1", "is_correct": True},
            {"key": "B", "text": "Phương án 2", "is_correct": False},
        ],
    }
    is_valid, errors = BackendQuestionValidator.validate_question(q_data)
    assert is_valid is False
    assert any("chính xác 4 phương án" in e for e in errors)


def test_validator_multiple_correct_answers():
    q_data = {
        "question_text": "Câu hỏi lỗi 2 đáp án đúng",
        "difficulty": "MEDIUM",
        "explanation": "Giải thích",
        "options": [
            {"key": "A", "text": "Phương án A", "is_correct": True},
            {"key": "B", "text": "Phương án B", "is_correct": True},
            {"key": "C", "text": "Phương án C", "is_correct": False},
            {"key": "D", "text": "Phương án D", "is_correct": False},
        ],
    }
    is_valid, errors = BackendQuestionValidator.validate_question(q_data)
    assert is_valid is False
    assert any("duy nhất 1 đáp án đúng" in e for e in errors)


def test_validator_duplicate_options():
    q_data = {
        "question_text": "Câu hỏi trùng lặp nội dung",
        "difficulty": "EASY",
        "explanation": "Giải thích",
        "options": [
            {"key": "A", "text": "Giống nhau", "is_correct": True},
            {"key": "B", "text": "Giống nhau", "is_correct": False},
            {"key": "C", "text": "Khác 1", "is_correct": False},
            {"key": "D", "text": "Khác 2", "is_correct": False},
        ],
    }
    is_valid, errors = BackendQuestionValidator.validate_question(q_data)
    assert is_valid is False
    assert any("Trùng lặp nội dung" in e for e in errors)


def test_generator_fallback(db: Session, teacher_user):
    req = AiQuestionGenerateRequest(
        subject="Toán",
        grade=5,
        count=3,
        difficulty_distribution=DifficultyDistribution(easy=33, medium=34, hard=33),
        use_web_context=True,
        save_as_draft=True,
    )
    res = GeminiQuestionGenerator.generate_questions(
        db=db,
        req=req,
        user_id=teacher_user.id,
    )

    assert res.total_generated == 3
    assert res.valid_count == 3
    assert res.saved_count == 3
    assert len(res.questions) == 3

    # Verify questions saved to DB
    saved_qs = (
        db.query(Question)
        .filter(Question.source == QuestionSource.AI_GENERATED)
        .all()
    )
    assert len(saved_qs) >= 3
    for q in saved_qs:
        assert q.status == QuestionStatus.REVIEW
        assert len(q.options) == 4


def test_api_generate_questions_teacher(client: TestClient, teacher_headers: dict):
    response = client.post(
        "/api/v1/ai/questions/generate",
        headers=teacher_headers,
        json={
            "subject": "Tiếng Việt",
            "grade": 4,
            "count": 2,
            "use_web_context": True,
            "save_as_draft": True,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_generated"] == 2
    assert data["valid_count"] == 2
    assert data["saved_count"] == 2
    assert len(data["questions"]) == 2


def test_api_generate_questions_student_forbidden(client: TestClient, student_headers: dict):
    response = client.post(
        "/api/v1/ai/questions/generate",
        headers=student_headers,
        json={
            "subject": "Toán",
            "grade": 6,
            "count": 2,
        },
    )
    assert response.status_code == 403
