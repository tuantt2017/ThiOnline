from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.models.user import User, UserRole
from app.schemas.user import (
    LoginResponse,
    UserCreate,
    UserLogin,
    UserRegister,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    user_in: UserRegister,
    db: Session = Depends(get_db),
) -> Any:
    """Register a new student account."""
    existing_user = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )
    
    user = User(
        email=user_in.email.lower(),
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=LoginResponse)
def login(
    user_in: UserLogin,
    db: Session = Depends(get_db),
) -> Any:
    """Authenticate user with email and password, returning JWT access token."""
    user = db.query(User).filter(User.email == user_in.email.lower()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    if not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account",
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        expires_delta=access_token_expires,
    )
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
) -> Any:
    """Retrieve profile of current authenticated user."""
    return current_user


@router.post("/seed", response_model=dict)
def seed_default_users(
    db: Session = Depends(get_db),
) -> Any:
    """Seed initial default Admin and Student accounts for development/testing."""
    created = []
    
    # 1. Default Admin
    admin = db.query(User).filter(User.email == "admin@example.com").first()
    if not admin:
        admin = User(
            email="admin@example.com",
            hashed_password=get_password_hash("Admin@123"),
            full_name="System Administrator",
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)
        created.append("admin@example.com")
        
    # 2. Default Student
    student = db.query(User).filter(User.email == "student@example.com").first()
    if not student:
        student = User(
            email="student@example.com",
            hashed_password=get_password_hash("Student@123"),
            full_name="Nguyen Van Hoc Sinh",
            role=UserRole.STUDENT,
            is_active=True,
        )
        db.add(student)
        created.append("student@example.com")

    # 3. Default Teacher
    teacher = db.query(User).filter(User.email == "teacher@example.com").first()
    if not teacher:
        teacher = User(
            email="teacher@example.com",
            hashed_password=get_password_hash("Teacher@123"),
            full_name="Tran Thi Giao Vien",
            role=UserRole.TEACHER,
            is_active=True,
        )
        db.add(teacher)
        created.append("teacher@example.com")
        
    db.commit()
    return {"message": "Seed completed", "created_users": created}
