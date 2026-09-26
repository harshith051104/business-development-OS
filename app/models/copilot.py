from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class CopilotConversation(Base):
    __tablename__ = "copilot_conversations"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False, default="New BD Conversation")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", foreign_keys=[user_id])
    messages = relationship("CopilotMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="CopilotMessage.created_at")

    def __repr__(self):
        return f"<CopilotConversation id={self.id} user_id={self.user_id} title='{self.title}'>"


class CopilotMessage(Base):
    __tablename__ = "copilot_messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    conversation_id = Column(String(64), ForeignKey("copilot_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    
    # Metadata for rich frontend rendering
    intent = Column(String(100), nullable=True)
    tools_executed = Column(JSON, nullable=True)
    data_references = Column(JSON, nullable=True)  # Links to orgs, contacts, meetings, opportunities
    pending_confirmation = Column(JSON, nullable=True)  # Action requiring confirmation
    confirmation_status = Column(String(20), nullable=True)  # 'pending', 'confirmed', 'cancelled'
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    conversation = relationship("CopilotConversation", back_populates="messages")

    def __repr__(self):
        return f"<CopilotMessage id={self.id} conversation_id={self.conversation_id} sender='{self.sender}'>"


class CopilotConfirmationAction(Base):
    """
    Persistent storage for copilot write-action confirmations.
    Survives server restarts. 10-minute TTL enforced at application level.
    """
    __tablename__ = "copilot_confirmation_actions"

    id = Column(String(64), primary_key=True, index=True)
    action_type = Column(String(50), nullable=False)
    payload = Column(JSON, nullable=False)
    summary = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    status = Column(String(20), nullable=False, default="PENDING")  # PENDING/APPROVED/EXECUTED/CANCELLED/EXPIRED
    executed_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<CopilotConfirmationAction id={self.id} type={self.action_type} status={self.status}>"
