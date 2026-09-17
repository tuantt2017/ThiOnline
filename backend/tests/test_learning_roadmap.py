import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.exam import Exam, ExamAttempt, AttemptStatus, AttemptAnswer
from app.models.question import Question, QuestionDifficulty, QuestionOption, QuestionStatus, QuestionType
from app.models.user import User


def test_get_learning_roadmap_success(client: TestClient, db: Session, student_user: User, student_headers: dict, teacher_user: User):
    # 1. Create 2 questions in different chapters
    q1 = Question(
        content="Câu hỏi Chương 1?",
        question_type=QuestionType.MULTIPLE_CHOICE_SINGLE,
        difficulty=QuestionDifficulty.MEDIUM,
        status=QuestionStatus.APPROVED,
        subject="Toán",
        grade=5,
        chapter="Chương 1: Phân Số",
        lesson="Bài 1. Khái niệm phân số",
        created_by_id=teacher_user.id,
    )
    q2 = Question(
        content="Câu hỏi Chương 2?",
        question_type=QuestionType.MULTIPLE_CHOICE_SINGLE,
        difficulty=QuestionDifficulty.MEDIUM,
        status=QuestionStatus.APPROVED,
        subject="Toán",
        grade=5,
        chapter="Chương 2: Số Thập Phân",
        lesson="Bài 5. Khái niệm số thập phân",
        created_by_id=teacher_user.id,
    )
    db.add_all([q1, q2])
    db.flush()

    # 2. Create exam and completed attempt for student
    exam = Exam(
        title="Đề Thi Kiểm Tra Lộ Trình",
        subject="Toán",
        grade=5,
        duration_minutes=15,
        created_by_id=teacher_user.id,
    )
    db.add(exam)
    db.flush()

    from datetime import datetime, timedelta, timezone
    attempt = ExamAttempt(
        exam_id=exam.id,
        student_id=student_user.id,
        status=AttemptStatus.SUBMITTED,
        started_at=datetime.now(timezone.utc),
        deadline_at=datetime.now(timezone.utc) + timedelta(minutes=15),
        submitted_at=datetime.now(timezone.utc),
        score=10.0,
        percentage=100.0,
    )
    db.add(attempt)
    db.flush()

    # Student answered Q1 correctly, Q2 incorrectly
    ans1 = AttemptAnswer(attempt_id=attempt.id, question_id=q1.id, selected_option_key="A", is_correct=True, points_earned=5.0)
    ans2 = AttemptAnswer(attempt_id=attempt.id, question_id=q2.id, selected_option_key="B", is_correct=False, points_earned=0.0)
    db.add_all([ans1, ans2])
    db.commit()

    # 3. Call GET /api/v1/ai/roadmap
    response = client.get("/api/v1/ai/roadmap?subject=Toán", headers=student_headers)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["subject"] == "Toán"
    assert data["grade"] == 5
    assert data["total_attempts"] == 1
    assert "overall_mastery_percentage" in data
    assert "ai_daily_action" in data
    assert len(data["chapter_breakdown"]) > 0

    # Verify status level categorization (MASTERED vs WEAK)
    q1_mastery = next((item for item in data["chapter_breakdown"] if "Phân Số" in item["chapter"]), None)
    q2_mastery = next((item for item in data["chapter_breakdown"] if "Số Thập Phân" in item["chapter"]), None)

    assert q1_mastery is not None
    assert q1_mastery["status_level"] == "MASTERED"
    assert q1_mastery["mastery_percentage"] == 100.0

    assert q2_mastery is not None
    assert q2_mastery["status_level"] == "WEAK"
    assert q2_mastery["mastery_percentage"] == 0.0


def test_get_learning_roadmap_unauthenticated_fails(client: TestClient):
    response = client.get("/api/v1/ai/roadmap")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
