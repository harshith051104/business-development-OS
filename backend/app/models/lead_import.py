from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class LeadImportBatch(Base):
    __tablename__ = "lead_import_batches"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    filename = Column(String(255), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    column_mapping = Column(JSON, nullable=True)
    total_rows = Column(Integer, default=0, nullable=False)
    organizations_created = Column(Integer, default=0, nullable=False)
    organizations_matched = Column(Integer, default=0, nullable=False)
    contacts_created = Column(Integer, default=0, nullable=False)
    contacts_matched = Column(Integer, default=0, nullable=False)
    skipped_count = Column(Integer, default=0, nullable=False)
    errors = Column(JSON, nullable=True)
    status = Column(String(30), default="completed", nullable=False)  # completed | failed
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    uploader = relationship("User", foreign_keys=[uploaded_by])

    def __repr__(self):
        return f"<LeadImportBatch id={self.id} filename='{self.filename}' rows={self.total_rows}>"
