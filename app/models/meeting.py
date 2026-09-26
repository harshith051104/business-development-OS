import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class MeetingType(str, enum.Enum):
    INTRODUCTION = "Introduction"
    PROJECT_SHOWCASE = "Project Showcase"
    BUSINESS_DISCUSSION = "Business Discussion"
    PARTNERSHIP_DISCUSSION = "Partnership Discussion"
    TECHNICAL_DISCUSSION = "Technical Discussion"
    FOLLOW_UP = "Follow-up"
    OTHER = "Other"


class MeetingStatus(str, enum.Enum):
    SCHEDULED = "Scheduled"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"
    RESCHEDULED = "Rescheduled"


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    primary_contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True, index=True)
    contact_ids = Column(JSON, nullable=True, default=list)  # list of contact IDs

    title = Column(String(255), nullable=False, index=True)
    meeting_type = Column(String(100), nullable=False, default=MeetingType.BUSINESS_DISCUSSION.value, index=True)
    description = Column(Text, nullable=True)
    scheduled_at = Column(DateTime, nullable=False, index=True)
    duration_minutes = Column(Integer, default=45, nullable=False)
    location = Column(String(255), nullable=True)
    meeting_url = Column(String(500), nullable=True)
    status = Column(String(50), nullable=False, default=MeetingStatus.SCHEDULED.value, index=True)

    agenda = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)  # Discussion notes
    decisions = Column(Text, nullable=True)  # Decisions made
    next_actions = Column(Text, nullable=True)  # Next actions agreed
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
    primary_contact = relationship("Contact", foreign_keys=[primary_contact_id])
    opportunity = relationship("Opportunity", foreign_keys=[opportunity_id])
    followups = relationship("FollowUp", back_populates="meeting", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Meeting id={self.id} title='{self.title}' org_id={self.organization_id} status='{self.status}'>"
