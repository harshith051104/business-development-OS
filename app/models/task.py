import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class TaskPriority(str, enum.Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class TaskStatus(str, enum.Enum):
    TODO = "Todo"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"


class BDTask(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    priority = Column(String(20), nullable=False, default=TaskPriority.MEDIUM.value, index=True)
    status = Column(String(50), nullable=False, default=TaskStatus.TODO.value, index=True)

    due_date = Column(DateTime, nullable=True, index=True)
    completed_at = Column(DateTime, nullable=True)

    entity_type = Column(String(50), nullable=True, index=True)  # organization, contact, opportunity, meeting, demo, proposal, negotiation, partnership, customer
    entity_id = Column(Integer, nullable=True, index=True)

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
    owner = relationship("User", foreign_keys=[owner_id])

    def __repr__(self):
        return f"<BDTask id={self.id} title='{self.title}' status='{self.status}' priority='{self.priority}'>"
