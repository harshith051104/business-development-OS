from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON, Index
from app.core.database import Base


class Signal(Base):
    __tablename__ = "signals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=True, index=True)
    campaign_contact_id = Column(Integer, ForeignKey("campaign_contacts.id", ondelete="CASCADE"), nullable=True, index=True)
    signal_type = Column(String(100), nullable=False, index=True)
    description = Column(String(500), nullable=False)
    score = Column(Integer, default=0, nullable=False)
    signal_metadata = Column(JSON, nullable=True)
    dismissed = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    __table_args__ = (
        Index("ix_signals_active", "dismissed", "created_at"),
    )

    def __repr__(self):
        return f"<Signal id={self.id} type='{self.signal_type}' score={self.score}>"
