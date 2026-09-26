import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class ContactRelationshipStatus(str, enum.Enum):
    NOT_CONTACTED = "Not Contacted"
    CONTACTED = "Contacted"
    CONNECTED = "Connected"
    INTERESTED = "Interested"
    INACTIVE = "Inactive"


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=True)
    designation = Column(String(150), nullable=True)
    department = Column(String(150), nullable=True)
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(100), nullable=True, index=True)
    linkedin_url = Column(String(255), nullable=True)
    location = Column(String(150), nullable=True)
    is_decision_maker = Column(Boolean, default=False, nullable=False)
    is_primary_contact = Column(Boolean, default=False, nullable=False)
    connection_status = Column(
        String(50),
        default=ContactRelationshipStatus.NOT_CONTACTED.value,
        nullable=False,
    )
    preferred_channel = Column(String(50), nullable=True, default="Email")  # Email | Phone | WhatsApp | LinkedIn
    do_not_contact = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
    first_contacted_at = Column(DateTime, nullable=True)
    last_contacted_at = Column(DateTime, nullable=True)
    next_followup_at = Column(DateTime, nullable=True)
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

    organization = relationship("Organization", back_populates="contacts")
    owner = relationship("User", foreign_keys=[owner_id])
    activities = relationship(
        "ContactActivity",
        back_populates="contact",
        cascade="all, delete-orphan",
        order_by="desc(ContactActivity.created_at)",
    )

    @property
    def full_name(self) -> str:
        if self.last_name:
            return f"{self.first_name} {self.last_name}".strip()
        return self.first_name.strip()

    def __repr__(self):
        return f"<Contact id={self.id} name='{self.full_name}' org_id={self.organization_id} status='{self.connection_status}'>"
