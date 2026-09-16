import os
import sys
from pathlib import Path
from typing import Generator
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.deps import get_db
from app.core.database import Base
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.models.user import User, UserRole

# In-memory SQLite for super-fast, isolated testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db() -> Generator:
    """Creates a fresh test database for each test function."""
    Base.metadata.create_all(bind=test_engine)
    db_session = TestingSessionLocal()
    try:
        yield db_session
    finally:
        db_session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db) -> Generator:
    """Test client with overridden get_db dependency."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def admin_user(db) -> User:
    """Fixture creating an admin user."""
    user = User(
        email="admin_test@example.com",
        hashed_password=get_password_hash("AdminPass123!"),
        full_name="Admin Tester",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def student_user(db) -> User:
    """Fixture creating a student user."""
    user = User(
        email="student_test@example.com",
        hashed_password=get_password_hash("StudentPass123!"),
        full_name="Student Tester",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def admin_headers(admin_user) -> dict:
    """Bearer auth header for admin user."""
    token = create_access_token(subject=admin_user.id, role=admin_user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def student_headers(student_user) -> dict:
    """Bearer auth header for student user."""
    token = create_access_token(subject=student_user.id, role=student_user.role.value)
    return {"Authorization": f"Bearer {token}"}
