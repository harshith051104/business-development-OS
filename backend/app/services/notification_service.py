"""In-app notifications. Created at existing state-change hook points
(reply received, milestone checked, task due, lead assigned) and read
by the Navbar bell via polling — no websocket infra needed at this scale.
"""
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.notification import Notification


def notify(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
) -> Notification:
    n = Notification(user_id=user_id, type=type, title=title, body=body, link=link)
    db.add(n)
    db.commit()
    db.refresh(n)

    from app.services.webhook_service import dispatch_outbound
    dispatch_outbound(db, event_type=type, payload={
        "notification_id": n.id,
        "user_id": user_id,
        "type": type,
        "title": title,
        "body": body,
        "link": link,
    })

    return n


def list_for_user(db: Session, user_id: int, unread_only: bool = False, limit: int = 50) -> List[Notification]:
    query = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        query = query.filter(Notification.is_read == False)  # noqa: E712
    return query.order_by(Notification.created_at.desc()).limit(limit).all()


def unread_count(db: Session, user_id: int) -> int:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        .count()
    )


def mark_read(db: Session, user_id: int, notification_id: int) -> Optional[Notification]:
    n = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user_id).first()
    if not n:
        return None
    n.is_read = True
    db.commit()
    db.refresh(n)
    return n


def mark_all_read(db: Session, user_id: int) -> int:
    count = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        .update({"is_read": True})
    )
    db.commit()
    return count
