import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.core.security import create_access_token


def test_create_adaptive_practice_success(client: TestClient, db: Session, student_user: User, student_headers: dict):
    payload = {
        "subject": "Toán",
        "count": 5
    }

    response = client.post("/api/v1/ai/adaptive-practice", json=payload, headers=student_headers)
    assert response.status_code == 200, response.text
    data = response.json()

    assert "exam_id" in data
    assert "attempt_id" in data
    assert data["subject"] == "Toán"
    assert data["total_questions"] == 5
    assert "message" in data

    # Verify student can fetch the attempt taking screen
    attempt_resp = client.get(f"/api/v1/exams/attempts/{data['attempt_id']}", headers=student_headers)
    assert attempt_resp.status_code == 200
    attempt_data = attempt_resp.json()
    assert len(attempt_data["questions"]) == 5
