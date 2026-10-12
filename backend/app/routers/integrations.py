import hashlib
import hmac
import logging
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.auth.deps import get_current_user, require_business_development
from app.models.user import User
from app.models.organization import Organization
from app.services import lead_ingest_service, webhook_service, notification_service
from app.schemas.integrations import (
    ExternalLeadIngestRequest,
    ExternalLeadIngestResponse,
    IntegrationStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/business-development/integrations", tags=["Integrations"])


@router.get("/status", response_model=List[IntegrationStatus])
def get_integrations_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the clean interface integration status for external commercial systems."""
    return [
        IntegrationStatus(
            system_name="Marketing System Connector",
            available=True,
            mode="clean_interface",
            total_ingested_leads=db.query(Organization).filter(Organization.notes.ilike("%Source: Marketing%")).count(),
            supported_channels=["Web Inbound", "Campaign Tracking", "Webinars"],
        ),
        IntegrationStatus(
            system_name="Events & Conferences Connector",
            available=True,
            mode="clean_interface",
            total_ingested_leads=db.query(Organization).filter(Organization.notes.ilike("%Source: Event%")).count(),
            supported_channels=["Industry Conferences", "Tech Summits", "Partner Days"],
        ),
        IntegrationStatus(
            system_name="Growth & Inbound Signals Connector",
            available=True,
            mode="clean_interface",
            total_ingested_leads=db.query(Organization).filter(Organization.notes.ilike("%Source: Growth%")).count(),
            supported_channels=["Platform Demo Requests", "Whitepaper Downloads", "API Docs Signup"],
        ),
        IntegrationStatus(
            system_name="Investor & Ecosystem Referral Connector",
            available=True,
            mode="clean_interface",
            total_ingested_leads=db.query(Organization).filter(Organization.notes.ilike("%Source: Investor%")).count(),
            supported_channels=["Portfolio Intros", "Board Referrals", "Strategic Partner Referrals"],
        ),
    ]


@router.post("/ingest", response_model=ExternalLeadIngestResponse, status_code=status.HTTP_201_CREATED)
def ingest_external_lead(
    payload: ExternalLeadIngestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Normalizes an external lead from Marketing, Growth, Events, or Investors into ELLY CRM."""
    org, contact_id, is_new_org = lead_ingest_service.ingest_external_lead(db, payload, user=current_user)

    return ExternalLeadIngestResponse(
        success=True,
        message=f"Successfully ingested lead from {payload.source_system} into ELLY CRM.",
        organization_id=org.id,
        contact_id=contact_id,
        is_new_organization=is_new_org,
        source_system=payload.source_system,
    )


# ── Inbound webhooks (generic external event receiver, HMAC-verified) ──

def _verify_webhook_signature(raw_body: bytes, signature: Optional[str]) -> None:
    if not settings.WEBHOOK_INBOUND_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Inbound webhooks are not configured (WEBHOOK_INBOUND_SECRET unset).",
        )
    if not signature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-Signature header.")
    expected = hmac.new(settings.WEBHOOK_INBOUND_SECRET.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature.")


@router.post("/webhooks/{source}", status_code=status.HTTP_202_ACCEPTED)
async def receive_webhook(
    source: str,
    request: Request,
    db: Session = Depends(get_db),
    x_signature: Optional[str] = Header(default=None, alias="X-Signature"),
):
    """Generic inbound webhook receiver for external systems. Verifies an
    HMAC-SHA256 signature of the raw body against WEBHOOK_INBOUND_SECRET.
    A payload with an 'organization_name' field is routed through the same
    lead-ingestion path as /ingest; anything else becomes a notification
    broadcast to the BD team so no inbound event is silently dropped."""
    raw_body = await request.body()
    _verify_webhook_signature(raw_body, x_signature)

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON body.")

    if isinstance(payload, dict) and payload.get("organization_name"):
        payload.setdefault("source_system", source)
        try:
            lead_payload = ExternalLeadIngestRequest(**payload)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid lead payload: {exc}")
        org, contact_id, is_new_org = lead_ingest_service.ingest_external_lead(db, lead_payload, user=None)
        return {
            "status": "ingested",
            "organization_id": org.id,
            "contact_id": contact_id,
            "is_new_organization": is_new_org,
        }

    # Generic event -- notify every BD/admin user rather than dropping it.
    bd_users = db.query(User).filter(User.role.in_(["BUSINESS_DEVELOPMENT", "ADMIN"]), User.is_active == True).all()  # noqa: E712
    for u in bd_users:
        notification_service.notify(
            db,
            user_id=u.id,
            type=f"webhook.{source}",
            title=f"Webhook event from {source}",
            body=str(payload)[:500],
        )
    return {"status": "received", "notified_users": len(bd_users)}


# ── Outbound webhook subscriptions ──

class WebhookSubscriptionCreate(BaseModel):
    url: str
    event_types: List[str] = ["*"]
    secret: str


class WebhookSubscriptionOut(BaseModel):
    id: int
    url: str
    event_types: List[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/webhook-subscriptions", response_model=List[WebhookSubscriptionOut], dependencies=[Depends(require_business_development)])
def list_webhook_subscriptions(db: Session = Depends(get_db)):
    return webhook_service.list_subscriptions(db)


@router.post("/webhook-subscriptions", response_model=WebhookSubscriptionOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_business_development)])
def create_webhook_subscription(payload: WebhookSubscriptionCreate, db: Session = Depends(get_db)):
    return webhook_service.create_subscription(db, url=payload.url, event_types=payload.event_types, secret=payload.secret)


@router.delete("/webhook-subscriptions/{subscription_id}", dependencies=[Depends(require_business_development)])
def delete_webhook_subscription(subscription_id: int, db: Session = Depends(get_db)):
    ok = webhook_service.delete_subscription(db, subscription_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found.")
    return {"message": "Subscription deleted."}
