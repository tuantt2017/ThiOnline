from fastapi import status


def test_health_check(client):
    """Test root and health check endpoints."""
    res_root = client.get("/")
    assert res_root.status_code == status.HTTP_200_OK
    assert res_root.json()["status"] == "online"

    res_health = client.get("/api/health")
    assert res_health.status_code == status.HTTP_200_OK
    assert res_health.json()["status"] == "healthy"
    assert res_health.json()["database"] == "connected"


def test_register_student_success(client):
    """Test successful student registration."""
    payload = {
        "email": "newstudent@example.com",
        "full_name": "New Student",
        "password": "SecurePassword123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["email"] == "newstudent@example.com"
    assert data["full_name"] == "New Student"
    assert data["role"] == "STUDENT"
    assert data["is_active"] is True
    assert "id" in data


def test_register_duplicate_email_fails(client, student_user):
    """Test registration with existing email returns 400."""
    payload = {
        "email": student_user.email,
        "full_name": "Duplicate Student",
        "password": "AnotherPassword123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "already exists" in response.json()["detail"].lower()


def test_login_admin_success(client, admin_user):
    """Test admin login with correct credentials."""
    payload = {
        "email": "admin_test@example.com",
        "password": "AdminPass123!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "admin_test@example.com"
    assert data["user"]["role"] == "ADMIN"


def test_login_student_success(client, student_user):
    """Test student login with correct credentials."""
    payload = {
        "email": "student_test@example.com",
        "password": "StudentPass123!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "student_test@example.com"
    assert data["user"]["role"] == "STUDENT"


def test_login_wrong_password_fails(client, student_user):
    """Test login with wrong password returns 401."""
    payload = {
        "email": "student_test@example.com",
        "password": "WrongPassword!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "incorrect" in response.json()["detail"].lower()


def test_login_nonexistent_email_fails(client):
    """Test login with non-existent email returns 401."""
    payload = {
        "email": "ghost@example.com",
        "password": "AnyPassword123!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_get_current_user_me_authenticated(client, student_headers, student_user):
    """Test /auth/me returns current user profile when authenticated."""
    response = client.get("/api/v1/auth/me", headers=student_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["email"] == student_user.email
    assert data["id"] == student_user.id
    assert data["role"] == "STUDENT"


def test_get_current_user_me_unauthorized(client):
    """Test /auth/me without token returns 401."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_get_current_user_me_invalid_token(client):
    """Test /auth/me with malformed token returns 401."""
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.token.value"})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_seed_default_users(client):
    """Test seeding default admin and student."""
    response = client.post("/api/v1/auth/seed")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "admin@example.com" in data["created_users"]
    assert "student@example.com" in data["created_users"]

    # Test login with seeded admin
    login_res = client.post("/api/v1/auth/login", json={
        "email": "admin@example.com",
        "password": "Admin@123",
    })
    assert login_res.status_code == status.HTTP_200_OK
    assert login_res.json()["user"]["role"] == "ADMIN"
