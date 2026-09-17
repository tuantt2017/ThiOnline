import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.core.security import verify_password, get_password_hash


def test_change_password_success(client: TestClient, db: Session, student_user: User, student_headers: dict):
    payload = {
        "old_password": "StudentPass123!",
        "new_password": "NewSecretPassword123!"
    }
    res = client.post("/api/v1/auth/change-password", json=payload, headers=student_headers)
    assert res.status_code == 200, res.text
    assert res.json()["message"] == "Đổi mật khẩu thành công!"

    # Verify db user password updated
    db.refresh(student_user)
    assert verify_password("NewSecretPassword123!", student_user.hashed_password)


def test_change_password_wrong_old_fails(client: TestClient, student_headers: dict):
    payload = {
        "old_password": "WrongPassword123!",
        "new_password": "NewSecretPassword123!"
    }
    res = client.post("/api/v1/auth/change-password", json=payload, headers=student_headers)
    assert res.status_code == 400
    assert "Mật khẩu hiện tại không chính xác" in res.json()["detail"]


def test_update_student_grade(client: TestClient, student_headers: dict, admin_headers: dict):
    # Current month check test
    current_month = datetime.now().month
    res = client.put("/api/v1/auth/me/grade", json={"grade": 6}, headers=student_headers)

    if current_month < 8:
        # In Jan-July, student self-update is blocked for new school year
        assert res.status_code == 400
        assert "chỉ mở từ Tháng 8 trở đi" in res.json()["detail"]
    else:
        # In August-December, student self-update succeeds
        assert res.status_code == 200
        assert res.json()["grade"] == 6

    # Admin can update grade anytime
    admin_res = client.put("/api/v1/auth/me/grade", json={"grade": 7}, headers=admin_headers)
    assert admin_res.status_code == 200
    assert admin_res.json()["grade"] == 7
