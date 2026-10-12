from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User
from app.services import signal_service

router = APIRouter(
    prefix="/api/business-development/signals",
    tags=["Signals"],
    dependencies=[Depends(require_business_development)],
)


def _out(s):
    return {
        "id": s.id,
        "organization_id": s.organization_id,
        "contact_id": s.contact_id,
        "campaign_contact_id": s.campaign_contact_id,
        "signal_type": s.signal_type,
        "description": s.description,
        "score": s.score,
        "metadata": s.signal_metadata,
        "dismissed": s.dismissed,
        "created_at": s.created_at,
    }


@router.get("")
def list_signals(
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return [_out(s) for s in signal_service.list_active(db, limit=limit)]


@router.post("/{signal_id}/dismiss")
def dismiss_signal(
    signal_id: int,
    db: Session = Depends(get_db),
):
    sig = signal_service.dismiss(db, signal_id)
    if not sig:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found.")
    return _out(sig)
