import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.exam import Exam, ExamAttempt, AttemptStatus, AttemptAnswer
from app.models.question import Question, QuestionDifficulty, QuestionStatus, QuestionType
from app.models.user import User, UserRole


def test_get_teacher_class_analytics_success(
    client: TestClient, db: Session, teacher_user: User, teacher_headers: dict, student_user: User
):
    # Ensure student is Grade 5
    student_user.grade = 5
    db.commit()

    # Call endpoint
    response = client.get(
        "/api/v1/ai/teacher/class-analytics?subject=Toán&grade=5",
        headers=teacher_headers,
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["subject"] == "Toán"
    assert data["grade"] == 5
    assert data["total_students"] >= 1
    assert "risk_students" in data
    assert "class_knowledge_gaps" in data
    assert "ai_teaching_advice" in data


def test_get_student_ai_evaluation_success(
    client: TestClient, db: Session, teacher_user: User, teacher_headers: dict, student_user: User
):
    response = client.get(
        f"/api/v1/ai/teacher/student-evaluation/{student_user.id}",
        headers=teacher_headers,
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["student_id"] == student_user.id
    assert data["student_name"] == student_user.full_name
    assert "overall_comment" in data
    assert isinstance(data["strengths"], list)
    assert isinstance(data["weaknesses"], list)
    assert "parent_note" in data
    assert "action_plan" in data


def test_assign_remedial_practice_success(
    client: TestClient, db: Session, teacher_user: User, teacher_headers: dict, student_user: User
):
    payload = {
        "student_ids": [student_user.id],
        "subject": "Toán",
        "grade": 5,
        "topic": "Phân số thập phân",
        "question_count": 5,
    }

    response = client.post(
        "/api/v1/ai/teacher/assign-remedial",
        json=payload,
        headers=teacher_headers,
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["exam_id"] > 0
    assert "Khắc Phục Điểm Yếu" in data["title"]
    assert data["assigned_count"] == 1


def test_teacher_analytics_unauthorized_for_students(
    client: TestClient, student_headers: dict, student_user: User
):
    response = client.get(
        "/api/v1/ai/teacher/class-analytics",
        headers=student_headers,
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_unapproved_students_excluded_from_analytics(
    client: TestClient, db: Session, teacher_headers: dict
):
    # Create an unapproved student (is_active=False)
    unapproved_student = User(
        email="unapproved_student@example.com",
        hashed_password="hash",
        full_name="Học Sinh Chưa Duyệt",
        role=UserRole.STUDENT,
        grade=5,
        is_active=False,
    )
    db.add(unapproved_student)
    db.commit()

    response = client.get(
        "/api/v1/ai/teacher/class-analytics?subject=Toán&grade=5",
        headers=teacher_headers,
    )
    assert response.status_code == 200
    data = response.json()

    # Verify unapproved student is NOT in risk_students monitoring list
    risk_ids = [s["student_id"] for s in data["risk_students"]]
    assert unapproved_student.id not in risk_ids

