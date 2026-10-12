"""
Outbound webhook dispatch. A subscription is matched on event_type (or a
"*" wildcard) and the payload is POSTed with an HMAC-SHA256 signature of the
raw body, computed with the subscription's own secret, in the
X-Webhook-Signature header (hex digest) -- same scheme inbound webhooks are
verified with in routers/integrations.py.

Dispatch runs synchronously with a short timeout and never raises: it is
called from inside existing request-handling code paths (via
notification_service.notify, the single choke point for Phases 1-4 events)
and a slow/broken external endpoint must not break BD portal flows.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

from app.models.webhook import WebhookSubscription

logger = logging.getLogger(__name__)

DISPATCH_TIMEOUT_SECONDS = 5.0


def _sign(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def list_subscriptions(db: Session) -> List[WebhookSubscription]:
    return db.query(WebhookSubscription).order_by(WebhookSubscription.created_at.desc()).all()


def create_subscription(db: Session, url: str, event_types: List[str], secret: str) -> WebhookSubscription:
    sub = WebhookSubscription(url=url, event_types=event_types or ["*"], secret=secret)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def delete_subscription(db: Session, subscription_id: int) -> bool:
    sub = db.query(WebhookSubscription).filter(WebhookSubscription.id == subscription_id).first()
    if not sub:
        return False
    db.delete(sub)
    db.commit()
    return True


def dispatch_outbound(db: Session, event_type: str, payload: Dict[str, Any]) -> None:
    try:
        subs = (
            db.query(WebhookSubscription)
            .filter(WebhookSubscription.is_active == True)  # noqa: E712
            .all()
        )
    except Exception as exc:
        logger.warning("Webhook subscription lookup failed: %s", exc)
        return

    matching = [s for s in subs if "*" in (s.event_types or []) or event_type in (s.event_types or [])]
    if not matching:
        return

    body = json.dumps({"event_type": event_type, "data": payload}).encode("utf-8")
    for sub in matching:
        try:
            signature = _sign(sub.secret, body)
            httpx.post(
                sub.url,
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Webhook-Signature": signature,
                },
                timeout=DISPATCH_TIMEOUT_SECONDS,
            )
        except Exception as exc:
            logger.warning("Webhook dispatch to %s failed (event=%s): %s", sub.url, event_type, exc)
