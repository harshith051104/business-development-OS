from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class ContactActivity(Base):
    __tablename__ = "contact_activities"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    activity_type = Column(String(100), nullable=False)  # contact_created, status_updated, note_added, meeting_scheduled, etc.
    description = Column(Text, nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=True, index=True)
    performed_by = Column(String(150), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    contact = relationship("Contact", back_populates="activities")
    organization = relationship("Organization", foreign_keys=[organization_id])
    opportunity = relationship("Opportunity", back_populates="activities")

    def __repr__(self):
        return f"<ContactActivity id={self.id} type='{self.activity_type}' contact_id={self.contact_id}>"
