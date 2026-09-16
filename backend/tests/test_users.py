from fastapi import status
from app.models.user import UserRole


def test_admin_can_list_users(client, admin_headers, admin_user, student_user):
    """Test ADMIN role can retrieve user list."""
    response = client.get("/api/v1/users/", headers=admin_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2


def test_student_cannot_list_users(client, student_headers):
    """Test STUDENT role gets 403 Forbidden when accessing admin user list."""
    response = client.get("/api/v1/users/", headers=student_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "requires admin privileges" in response.json()["detail"].lower()


def test_unauthenticated_cannot_list_users(client):
    """Test request without token gets 401 Unauthorized."""
    response = client.get("/api/v1/users/")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_admin_can_create_user(client, admin_headers):
    """Test ADMIN can create a user with TEACHER role."""
    payload = {
        "email": "teacher_new@example.com",
        "full_name": "Teacher Tester",
        "password": "TeacherPass123!",
        "role": "TEACHER",
    }
    response = client.post("/api/v1/users/", json=payload, headers=admin_headers)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["email"] == "teacher_new@example.com"
    assert data["role"] == "TEACHER"


def test_student_cannot_create_user(client, student_headers):
    """Test STUDENT cannot create users through admin endpoint."""
    payload = {
        "email": "should_fail@example.com",
        "full_name": "Should Fail",
        "password": "Password123!",
        "role": "STUDENT",
    }
    response = client.post("/api/v1/users/", json=payload, headers=student_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN
