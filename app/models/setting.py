from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from app.core.database import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    category = Column(String(50), default="general", nullable=False)
    description = Column(String(255), nullable=True)
    value_json = Column(JSON, nullable=False)
    updated_by = Column(String(150), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<SystemSetting key='{self.key}' category='{self.category}'>"
