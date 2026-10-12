from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.auth.deps import require_business_development, get_current_user
from app.core.database import get_db
from app.models.user import User
from app.services import kb_service

router = APIRouter(
    prefix="/api/business-development/knowledge-base",
    tags=["Knowledge Base"],
    dependencies=[Depends(require_business_development)],
)

MAX_UPLOAD_BYTES = 2 * 1024 * 1024  # 2MB -- plain text/markdown only for v1


def _doc_out(doc, chunk_count: int = None):
    out = {
        "id": doc.id,
        "title": doc.title,
        "source": doc.source,
        "created_by": doc.created_by,
        "created_at": doc.created_at,
    }
    if chunk_count is not None:
        out["chunk_count"] = chunk_count
    return out


@router.get("")
def list_kb_documents(db: Session = Depends(get_db)):
    docs = kb_service.list_documents(db)
    return [_doc_out(d, len(d.chunks)) for d in docs]


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_kb_document(
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large (max 2MB plain text/markdown).")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only plain text/markdown files are supported in this version.")

    if not text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is empty.")

    doc = kb_service.create_document(db, title=title, text=text, source=file.filename, created_by=user.id)
    return _doc_out(doc, len(doc.chunks))


@router.delete("/{document_id}")
def delete_kb_document(document_id: int, db: Session = Depends(get_db)):
    ok = kb_service.delete_document(db, document_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return {"message": "Document deleted."}


@router.get("/search")
def search_kb(
    q: str = Query(..., min_length=1),
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    return kb_service.search(db, query=q, limit=limit)
