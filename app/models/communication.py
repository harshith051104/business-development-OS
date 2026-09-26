import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class CommunicationChannel(str, enum.Enum):
    EMAIL = "Email"
    PHONE = "Phone"
    LINKEDIN = "LinkedIn"
    WHATSAPP = "WhatsApp"
    MEETING = "Meeting"
    VIDEO_CALL = "Video Call"
    IN_PERSON = "In Person"
    OTHER = "Other"


class CommunicationDirection(str, enum.Enum):
    OUTGOING = "Outgoing"
    INCOMING = "Incoming"


class CommunicationStatus(str, enum.Enum):
    COMPLETED = "Completed"
    PENDING = "Pending"
    CANCELLED = "Cancelled"


class Communication(Base):
    __tablename__ = "communications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id"), nullable=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=True, index=True)
    followup_id = Column(Integer, ForeignKey("followups.id"), nullable=True, index=True)

    channel = Column(String(50), nullable=False, default=CommunicationChannel.EMAIL.value, index=True)
    direction = Column(String(20), nullable=False, default=CommunicationDirection.OUTGOING.value, index=True)
    subject = Column(String(255), nullable=False, index=True)
    content = Column(Text, nullable=True)
    summary = Column(String(500), nullable=True)
    communication_date = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    status = Column(String(50), nullable=False, default=CommunicationStatus.COMPLETED.value, index=True)
    source = Column(String(50), nullable=True, default="manual")  # manual | campaign | meeting | system

    # Phone-specific fields
    duration_minutes = Column(Integer, nullable=True)
    call_outcome = Column(String(50), nullable=True)  # connected | voicemail | no_answer | busy

    # WhatsApp/LinkedIn-specific
    external_message_id = Column(String(255), nullable=True)  # platform message ID

    is_deleted = Column(Boolean, default=False, nullable=False)
    created_by = Column(String(150), nullable=True)
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
    opportunity = relationship("Opportunity", foreign_keys=[opportunity_id])
    meeting = relationship("Meeting", foreign_keys=[meeting_id])
    followup = relationship("FollowUp", foreign_keys=[followup_id])
    owner = relationship("User", foreign_keys=[owner_id])

    def __repr__(self):
        return f"<Communication id={self.id} org_id={self.organization_id} channel='{self.channel}' subject='{self.subject}'>"
