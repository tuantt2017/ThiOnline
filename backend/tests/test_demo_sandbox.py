import pytest
from fastapi.testclient import TestClient

from app.models.user import User, UserRole
from app.services.trial_guard_service import TrialGuardService


def test_demo_login_endpoint(client: TestClient, db):
    """Test demo login returns token and user with is_demo=True."""
    res = client.post("/api/v1/auth/demo-login", json={"role": "STUDENT"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["is_demo"] is True
    assert data["user"]["role"] == "STUDENT"

    res_teacher = client.post("/api/v1/auth/demo-login", json={"role": "TEACHER"})
    assert res_teacher.status_code == 200
    assert res_teacher.json()["user"]["is_demo"] is True
    assert res_teacher.json()["user"]["role"] == "TEACHER"


def test_trial_limit_admin_configuration(client: TestClient, db, admin_headers):
    """Real admin can configure trial limits, demo admin cannot."""
    # Get initial limit
    res_get = client.get("/api/v1/system-settings/trial-limit", headers=admin_headers)
    assert res_get.status_code == 200
    assert "trial_max_uses" in res_get.json()

    # Update limit to 3
    res_put = client.put("/api/v1/system-settings/trial-limit", json={"max_uses": 3}, headers=admin_headers)
    assert res_put.status_code == 200
    assert res_put.json()["trial_max_uses"] == 3

    # Demo admin login
    demo_res = client.post("/api/v1/auth/demo-login", json={"role": "ADMIN"})
    demo_token = demo_res.json()["access_token"]
    demo_headers = {"Authorization": f"Bearer {demo_token}"}

    # Demo admin attempt to update trial limit fails with 403
    res_demo_put = client.put("/api/v1/system-settings/trial-limit", json={"max_uses": 10}, headers=demo_headers)
    assert res_demo_put.status_code == 403


def test_demo_user_usage_limit_enforcement(client: TestClient, db):
    """Demo user gets blocked with 403 when trial limit is exceeded."""
    # Set limit to 1
    TrialGuardService.set_trial_max_uses(db, 1)

    demo_res = client.post("/api/v1/auth/demo-login", json={"role": "STUDENT"})
    demo_token = demo_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {demo_token}"}

    # First call succeeds (usage 1/1)
    chat_res1 = client.post(
        "/api/v1/ai/chat",
        json={"message": "Chào bạn!", "subject": "Toán"},
        headers=headers,
    )
    assert chat_res1.status_code == 200

    # Second call fails with 403 (usage 2/1 exceeded)
    chat_res2 = client.post(
        "/api/v1/ai/chat",
        json={"message": "Hỏi thêm câu nữa", "subject": "Toán"},
        headers=headers,
    )
    assert chat_res2.status_code == 403
    assert "Bạn đã sử dụng hết hạn mức dùng thử" in chat_res2.json()["detail"]
