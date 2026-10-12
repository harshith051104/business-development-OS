from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


class KBDocument(Base):
    __tablename__ = "kb_documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    source = Column(String(255), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    creator = relationship("User", foreign_keys=[created_by])
    chunks = relationship("KBChunk", back_populates="document", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<KBDocument id={self.id} title='{self.title}'>"


class KBChunk(Base):
    __tablename__ = "kb_chunks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("kb_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    embedding = Column(JSON, nullable=True)
    chunk_index = Column(Integer, nullable=False, default=0)

    document = relationship("KBDocument", back_populates="chunks")

    __table_args__ = (
        Index("ix_kb_chunks_document", "document_id", "chunk_index"),
    )

    def __repr__(self):
        return f"<KBChunk id={self.id} document_id={self.document_id} idx={self.chunk_index}>"
