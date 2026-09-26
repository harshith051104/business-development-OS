from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class UserLogin(BaseModel):
    email: str = Field(..., description="User corporate or local development email")
    password: str = Field(..., min_length=1, description="Account password")


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class AccessResponse(BaseModel):
    status: str = "authorized"
    message: str = "Access granted to Business Development Portal."
    phase: str = "Phase 1 — Business Development Portal Authentication & Access Control"
    user: UserOut


class LogoutResponse(BaseModel):
    status: str = "success"
    message: str = "Successfully logged out."
