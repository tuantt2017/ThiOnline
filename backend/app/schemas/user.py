from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict
from app.models.user import UserRole
from app.schemas.token import Token


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: Optional[UserRole] = UserRole.STUDENT
    grade: Optional[int] = None


class UserCreate(UserBase):
    password: str


class UserRegister(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    grade: Optional[int] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    grade: Optional[int] = None
    diamond_balance: int = 0
    is_active: bool
    created_at: datetime
    updated_at: datetime


    model_config = ConfigDict(from_attributes=True)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ChangePasswordInput(BaseModel):
    old_password: str
    new_password: str


class UpdateGradeInput(BaseModel):
    grade: int

