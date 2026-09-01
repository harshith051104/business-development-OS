import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class FollowUpPriority(str, enum.Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class FollowUpStatus(str, enum.Enum):
    PENDING = "Pending"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"


class FollowUp(Base):
    __tablename__ = "followups"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id", ondelete="SET NULL"), nullable=True, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True, index=True)

    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    due_at = Column(DateTime, nullable=False, index=True)
    priority = Column(String(20), nullable=False, default=FollowUpPriority.MEDIUM.value, index=True)
    status = Column(String(50), nullable=False, default=FollowUpStatus.PENDING.value, index=True)
    assigned_to = Column(String(100), nullable=True)
    completed_at = Column(DateTime, nullable=True)
    cancellation_reason = Column(String(500), nullable=True)

    is_deleted = Column(Boolean, default=False, nullable=False)
    created_by = Column(Integer, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    organization = relationship("Organization", foreign_keys=[organization_id])
    contact = relationship("Contact", foreign_keys=[contact_id])
    owner = relationship("User", foreign_keys=[owner_id])
    meeting = relationship("Meeting", back_populates="followups")

    def __repr__(self):
        return f"<FollowUp id={self.id} title='{self.title}' org_id={self.organization_id} status='{self.status}'>"
