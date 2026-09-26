import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SQLEnum
from app.core.database import Base


class UserRole(str, enum.Enum):
    BUSINESS_DEVELOPMENT = "BUSINESS_DEVELOPMENT"
    HEALTHCARE = "HEALTHCARE"
    ADMIN = "ADMIN"
    USER = "USER"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default=UserRole.BUSINESS_DEVELOPMENT.value)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<User id={self.id} email='{self.email}' role='{self.role}'>"
