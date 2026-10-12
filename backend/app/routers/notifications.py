from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.services import notification_service as svc

router = APIRouter(
    prefix="/api/business-development/notifications",
    tags=["Notifications"],
    dependencies=[Depends(get_current_user)],
)


def _out(n):
    return {
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "body": n.body,
        "link": n.link,
        "is_read": n.is_read,
        "created_at": n.created_at,
    }


@router.get("")
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = svc.list_for_user(db, current_user.id, unread_only=unread_only, limit=limit)
    return [_out(n) for n in items]


@router.get("/unread-count")
def get_unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {"unread_count": svc.unread_count(db, current_user.id)}


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    n = svc.mark_read(db, current_user.id, notification_id)
    if not n:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    return _out(n)


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    count = svc.mark_all_read(db, current_user.id)
    return {"marked_read": count}
