from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=True, index=True)
    user_email = Column(String(150), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False, index=True)
    resource_id = Column(Integer, nullable=True, index=True)
    ip_address = Column(String(100), nullable=True)
    metadata_json = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    def __repr__(self):
        return f"<AuditLog id={self.id} action='{self.action}' resource='{self.resource_type}:{self.resource_id}'>"


class GmailRateLimit(Base):
    """
    Persistent Gmail send rate limiting per IP.
    Survives server restarts. 20 emails/hour/IP policy.
    """
    __tablename__ = "gmail_rate_limits"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ip_address = Column(String(45), nullable=False, index=True)
    sent_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    def __repr__(self):
        return f"<GmailRateLimit id={self.id} ip={self.ip_address}>"
