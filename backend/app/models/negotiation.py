import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class NegotiationStatus(str, enum.Enum):
    ACTIVE = "Active"
    BLOCKED = "Blocked"
    AGREED = "Agreed"
    LOST = "Lost"


class Negotiation(Base):
    __tablename__ = "negotiations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True, index=True)
    proposal_id = Column(Integer, ForeignKey("proposals.id", ondelete="SET NULL"), nullable=True, index=True)
    primary_contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    title = Column(String(255), nullable=False, index=True)
    commercial_value = Column(Float, nullable=True, default=0.0)
    currency = Column(String(10), default="USD", nullable=False)
    status = Column(String(50), nullable=False, default=NegotiationStatus.ACTIVE.value, index=True)

    expected_close_date = Column(DateTime, nullable=True)
    key_requirements = Column(Text, nullable=True)
    open_issues = Column(Text, nullable=True)
    risks = Column(Text, nullable=True)
    next_action = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    created_by = Column(String(150), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    organization = relationship("Organization", foreign_keys=[organization_id])
    opportunity = relationship("Opportunity", foreign_keys=[opportunity_id])
    proposal = relationship("Proposal", foreign_keys=[proposal_id])
    primary_contact = relationship("Contact", foreign_keys=[primary_contact_id])
    owner = relationship("User", foreign_keys=[owner_id])

    def __repr__(self):
        return f"<Negotiation id={self.id} title='{self.title}' org_id={self.organization_id} status='{self.status}'>"
