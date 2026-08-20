from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr

from app.models.models import UserRole


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    type: str


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.employee


class UserCreate(UserBase):
    password: str
    organization_id: Optional[int]
    preferences: Optional[dict] = None


class UserRead(UserBase):
    id: int
    is_active: bool
    organization_id: Optional[int]
    preferences: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str
