"""
Knowledge Base service (RAG-lite, no vector DB).

Documents are chunked on upload and each chunk is embedded via Gemini's
embedContent endpoint (same GEMINI_API_KEY already configured for the
Copilot LLM router -- no second provider/key introduced). If no Gemini key
is configured, or the embedding call fails, chunks are stored without an
embedding and retrieval falls back to pure-Python keyword overlap scoring.
Embeddings are stored as plain JSON float lists and compared via in-Python
cosine similarity -- fine at this data scale (a handful of users, dozens of
documents).
"""
from __future__ import annotations

import logging
import math
import re
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.knowledge_base import KBDocument, KBChunk

logger = logging.getLogger(__name__)

EMBED_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "text-embedding-004:embedContent"
)
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    text = (text or "").strip()
    if not text:
        return []
    chunks: List[str] = []
    start = 0
    length = len(text)
    while start < length:
        end = min(start + chunk_size, length)
        chunks.append(text[start:end].strip())
        if end >= length:
            break
        start = end - overlap
    return [c for c in chunks if c]


def embed_text(text: str) -> Optional[List[float]]:
    api_key = getattr(settings, "GEMINI_API_KEY", "") or ""
    if not api_key:
        return None
    try:
        resp = httpx.post(
            EMBED_URL,
            params={"key": api_key},
            json={"content": {"parts": [{"text": text}]}},
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        values = data.get("embedding", {}).get("values")
        if isinstance(values, list) and values:
            return values
        return None
    except Exception as exc:
        logger.warning("KB embedding call failed, falling back to keyword search: %s", exc)
        return None


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


_WORD_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> set:
    return set(_WORD_RE.findall((text or "").lower()))


def _keyword_score(query_tokens: set, chunk_text_value: str) -> float:
    if not query_tokens:
        return 0.0
    chunk_tokens = _tokenize(chunk_text_value)
    if not chunk_tokens:
        return 0.0
    overlap = len(query_tokens & chunk_tokens)
    if overlap == 0:
        return 0.0
    return overlap / len(query_tokens | chunk_tokens)


def create_document(
    db: Session,
    title: str,
    text: str,
    source: Optional[str] = None,
    created_by: Optional[int] = None,
) -> KBDocument:
    doc = KBDocument(title=title, source=source, created_by=created_by)
    db.add(doc)
    db.flush()

    for idx, piece in enumerate(chunk_text(text)):
        embedding = embed_text(piece)
        db.add(KBChunk(document_id=doc.id, text=piece, embedding=embedding, chunk_index=idx))

    db.commit()
    db.refresh(doc)
    return doc


def list_documents(db: Session) -> List[KBDocument]:
    return db.query(KBDocument).order_by(KBDocument.created_at.desc()).all()


def get_document(db: Session, document_id: int) -> Optional[KBDocument]:
    return db.query(KBDocument).filter(KBDocument.id == document_id).first()


def delete_document(db: Session, document_id: int) -> bool:
    doc = get_document(db, document_id)
    if not doc:
        return False
    db.delete(doc)
    db.commit()
    return True


def search(db: Session, query: str, limit: int = 5) -> List[Dict[str, Any]]:
    query = (query or "").strip()
    if not query:
        return []

    chunks = (
        db.query(KBChunk)
        .join(KBDocument, KBChunk.document_id == KBDocument.id)
        .all()
    )
    if not chunks:
        return []

    query_embedding = embed_text(query)
    query_tokens = _tokenize(query)

    scored = []
    for chunk in chunks:
        if query_embedding is not None and chunk.embedding:
            score = _cosine_similarity(query_embedding, chunk.embedding)
        else:
            score = _keyword_score(query_tokens, chunk.text)
        if score > 0:
            scored.append((score, chunk))

    scored.sort(key=lambda pair: pair[0], reverse=True)

    results = []
    for score, chunk in scored[:limit]:
        results.append({
            "document_id": chunk.document_id,
            "document_title": chunk.document.title if chunk.document else None,
            "chunk_text": chunk.text,
            "score": round(score, 4),
        })
    return results
