"""
WhatsApp send-queue for the browser-extension automation tool.

The extension (loaded unpacked into Chrome by each rep, pointed at this backend)
pulls a small batch of leads assigned to the logged-in rep, drives web.whatsapp.com's
own DOM to prefill + send the message, and reports back per-lead outcome. All
pacing/cap/business-hours/circuit-breaker logic lives in the extension itself —
this router only ever hands out leads already owned by the requesting rep and
already respecting do_not_contact / is_deleted / a phone on file.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import require_business_development
from app.core.audit import log_audit_event
from app.core.database import get_db
from app.models.user import User
from app.models.contact import Contact
from app.models.organization import Organization
from app.models.campaign import Campaign, CampaignContact, CampaignContactStatus
from app.services import lead_tracker_service as svc

router = APIRouter(
    prefix="/api/business-development/whatsapp-automation",
    tags=["WhatsApp Automation"],
    dependencies=[Depends(require_business_development)],
)

EXCLUDED_STATUSES = {CampaignContactStatus.REJECTED.value, CampaignContactStatus.BOUNCED.value}
DEFAULT_TEMPLATE = (
    "Hi {{first_name}}, this is {{sender_name}} from ELLY — reaching out to {{company}} "
    "about how we could help. Open to a quick chat this week?"
)


def _render_template(template: str, contact: Contact, org: Optional[Organization], sender_name: str) -> str:
    return (
        template
        .replace("{{first_name}}", contact.first_name or "")
        .replace("{{last_name}}", contact.last_name or "")
        .replace("{{company}}", org.name if org else "")
        .replace("{{sender_name}}", sender_name or "")
    )


class ReportRequest(BaseModel):
    result: Literal["sent", "invalid", "failed"]
    note: Optional[str] = None


class TemplateUpdateRequest(BaseModel):
    template: str


@router.get("/queue")
def get_queue(
    campaign_id: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Leads assigned to the calling rep, with a phone on file, not yet WhatsApp'd, not opted out."""
    query = (
        db.query(CampaignContact)
        .join(Contact, Contact.id == CampaignContact.contact_id)
        .filter(CampaignContact.assigned_user_id == current_user.id)
        .filter(CampaignContact.whatsapp_message_sent.is_(False))
        .filter(CampaignContact.whatsapp_invalid_number.is_(False))
        .filter(~CampaignContact.status.in_(EXCLUDED_STATUSES))
        .filter(Contact.phone.isnot(None))
        .filter(Contact.phone != "")
        .filter(Contact.do_not_contact.isnot(True))
        .filter(Contact.is_deleted.is_(False))
    )
    if campaign_id:
        query = query.filter(CampaignContact.campaign_id == campaign_id)

    rows = query.order_by(CampaignContact.next_action_due.asc()).limit(limit).all()

    items: List[Dict[str, Any]] = []
    for cc in rows:
        contact = db.query(Contact).filter(Contact.id == cc.contact_id).first()
        org = db.query(Organization).filter(Organization.id == cc.organization_id).first()
        campaign = db.query(Campaign).filter(Campaign.id == cc.campaign_id).first()
        if not contact:
            continue
        template = (campaign.whatsapp_message_template if campaign and campaign.whatsapp_message_template else DEFAULT_TEMPLATE)
        message = _render_template(template, contact, org, current_user.name or current_user.email)
        items.append({
            "campaign_contact_id": cc.id,
            "contact_id": contact.id,
            "name": f"{contact.first_name} {contact.last_name or ''}".strip(),
            "phone": contact.phone,
            "company": org.name if org else None,
            "campaign_id": cc.campaign_id,
            "campaign_name": campaign.name if campaign else None,
            "message": message,
            "failed_attempts": cc.whatsapp_failed_attempts,
        })

    return {"count": len(items), "items": items}


@router.post("/queue/{campaign_contact_id}/report")
def report_result(
    campaign_contact_id: int,
    body: ReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    cc = db.query(CampaignContact).filter(CampaignContact.id == campaign_contact_id).first()
    if not cc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found.")
    if cc.assigned_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This lead is not assigned to you.")

    now = datetime.now(timezone.utc)
    cc.whatsapp_last_attempt_at = now

    if body.result == "sent":
        cc = svc.update_checkboxes(db, cc.id, current_user.id, {"whatsapp_message_sent": True})
        cc.whatsapp_sent_at = now
        db.commit()
        db.refresh(cc)
    elif body.result == "invalid":
        cc.whatsapp_invalid_number = True
        svc.log_timeline_event(
            db, campaign_contact_id=cc.id, user_id=current_user.id,
            event_type="whatsapp_invalid_number",
            description="WhatsApp number invalid or not on WhatsApp",
            metadata={}, _flush=False,
        )
        db.commit()
        db.refresh(cc)
    else:  # failed
        cc.whatsapp_failed_attempts = (cc.whatsapp_failed_attempts or 0) + 1
        svc.log_timeline_event(
            db, campaign_contact_id=cc.id, user_id=current_user.id,
            event_type="whatsapp_send_failed",
            description=f"WhatsApp send failed: {body.note or 'unknown error'}",
            metadata={"note": body.note}, _flush=False,
        )
        db.commit()
        db.refresh(cc)

    log_audit_event(
        db, action="WHATSAPP_AUTOMATION_REPORT", resource_type="CAMPAIGN_CONTACT",
        resource_id=cc.id, user=current_user,
        metadata={"result": body.result, "note": body.note},
    )

    return {
        "id": cc.id,
        "whatsapp_message_sent": cc.whatsapp_message_sent,
        "whatsapp_invalid_number": cc.whatsapp_invalid_number,
        "whatsapp_failed_attempts": cc.whatsapp_failed_attempts,
    }


@router.get("/settings/{campaign_id}")
def get_template(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found.")
    return {
        "campaign_id": campaign.id,
        "template": campaign.whatsapp_message_template or DEFAULT_TEMPLATE,
        "merge_fields": ["{{first_name}}", "{{last_name}}", "{{company}}", "{{sender_name}}"],
    }


@router.patch("/settings/{campaign_id}")
def update_template(
    campaign_id: int,
    body: TemplateUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found.")
    campaign.whatsapp_message_template = body.template
    db.commit()
    log_audit_event(
        db, action="WHATSAPP_TEMPLATE_UPDATE", resource_type="CAMPAIGN",
        resource_id=campaign.id, user=current_user, metadata={"template": body.template},
    )
    return {"campaign_id": campaign.id, "template": campaign.whatsapp_message_template}
