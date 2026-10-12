"""
LinkedIn send-queue for the browser-extension automation tool.

Mirrors whatsapp_automation.py's shape. The milestone checkboxes themselves
(linkedin_connection_sent, linkedin_connection_accepted, linkedin_first_message_sent)
already existed on CampaignContact from the Lead Tracker build — this router just
hands out leads that still need one of those actions, to the rep they're assigned
to, and lets the extension report which one it completed by inspecting the
profile's own DOM state (it decides connect-vs-message per visit, not this router).
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.auth.deps import require_business_development
from app.core.audit import log_audit_event
from app.core.database import get_db
from app.models.user import User
from app.models.contact import Contact
from app.models.organization import Organization
from app.models.campaign import Campaign, CampaignContact, CampaignContactStatus
from app.services import lead_tracker_service as svc

router = APIRouter(
    prefix="/api/business-development/linkedin-automation",
    tags=["LinkedIn Automation"],
    dependencies=[Depends(require_business_development)],
)

EXCLUDED_STATUSES = {CampaignContactStatus.REJECTED.value, CampaignContactStatus.BOUNCED.value}
ALLOWED_SET_FIELDS = {"linkedin_connection_sent", "linkedin_connection_accepted", "linkedin_first_message_sent"}

DEFAULT_CONNECTION_NOTE = "Hi {{first_name}}, I work with ELLY and would love to connect."
DEFAULT_FIRST_MESSAGE = (
    "Thanks for connecting, {{first_name}}! Wanted to share how ELLY could help {{company}} — "
    "open to a quick chat this week?"
)


def _render(template: str, contact: Contact, org: Optional[Organization], sender_name: str) -> str:
    return (
        template
        .replace("{{first_name}}", contact.first_name or "")
        .replace("{{last_name}}", contact.last_name or "")
        .replace("{{company}}", org.name if org else "")
        .replace("{{sender_name}}", sender_name or "")
    )


class ReportRequest(BaseModel):
    set: List[Literal["linkedin_connection_sent", "linkedin_connection_accepted", "linkedin_first_message_sent"]] = []
    result: Literal["ok", "failed", "unavailable", "pending_skip"] = "ok"
    note: Optional[str] = None


class TemplateUpdateRequest(BaseModel):
    connection_note: Optional[str] = None
    first_message: Optional[str] = None


@router.get("/queue")
def get_queue(
    campaign_id: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Leads assigned to the calling rep with a LinkedIn URL and something left to do."""
    query = (
        db.query(CampaignContact)
        .join(Contact, Contact.id == CampaignContact.contact_id)
        .filter(CampaignContact.assigned_user_id == current_user.id)
        .filter(CampaignContact.linkedin_unavailable.is_(False))
        .filter(~CampaignContact.status.in_(EXCLUDED_STATUSES))
        .filter(Contact.linkedin_url.isnot(None))
        .filter(Contact.linkedin_url != "")
        .filter(Contact.do_not_contact.isnot(True))
        .filter(Contact.is_deleted.is_(False))
        .filter(
            or_(
                CampaignContact.linkedin_connection_sent.is_(False),
                CampaignContact.linkedin_first_message_sent.is_(False),
            )
        )
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
        note_template = (campaign.linkedin_connection_note_template if campaign and campaign.linkedin_connection_note_template else DEFAULT_CONNECTION_NOTE)
        msg_template = (campaign.linkedin_first_message_template if campaign and campaign.linkedin_first_message_template else DEFAULT_FIRST_MESSAGE)
        sender_name = current_user.name or current_user.email
        items.append({
            "campaign_contact_id": cc.id,
            "contact_id": contact.id,
            "name": f"{contact.first_name} {contact.last_name or ''}".strip(),
            "linkedin_url": contact.linkedin_url,
            "company": org.name if org else None,
            "campaign_id": cc.campaign_id,
            "campaign_name": campaign.name if campaign else None,
            "connection_note": _render(note_template, contact, org, sender_name),
            "first_message": _render(msg_template, contact, org, sender_name),
            "state": {
                "connection_sent": cc.linkedin_connection_sent,
                "connection_accepted": cc.linkedin_connection_accepted,
                "first_message_sent": cc.linkedin_first_message_sent,
            },
            "failed_attempts": cc.linkedin_failed_attempts,
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
    cc.linkedin_last_attempt_at = now
    db.commit()

    if body.set:
        updates = {f: True for f in body.set if f in ALLOWED_SET_FIELDS}
        if updates:
            cc = svc.update_checkboxes(db, cc.id, current_user.id, updates)

    if body.result == "failed":
        cc.linkedin_failed_attempts = (cc.linkedin_failed_attempts or 0) + 1
        svc.log_timeline_event(
            db, campaign_contact_id=cc.id, user_id=current_user.id,
            event_type="linkedin_action_failed",
            description=f"LinkedIn action failed: {body.note or 'unknown error'}",
            metadata={"note": body.note}, _flush=False,
        )
        db.commit()
        db.refresh(cc)
    elif body.result == "unavailable":
        cc.linkedin_unavailable = True
        svc.log_timeline_event(
            db, campaign_contact_id=cc.id, user_id=current_user.id,
            event_type="linkedin_unavailable",
            description=f"No Connect/Message action available on this profile: {body.note or ''}".strip(),
            metadata={"note": body.note}, _flush=False,
        )
        db.commit()
        db.refresh(cc)

    log_audit_event(
        db, action="LINKEDIN_AUTOMATION_REPORT", resource_type="CAMPAIGN_CONTACT",
        resource_id=cc.id, user=current_user,
        metadata={"set": body.set, "result": body.result, "note": body.note},
    )

    return {
        "id": cc.id,
        "linkedin_connection_sent": cc.linkedin_connection_sent,
        "linkedin_connection_accepted": cc.linkedin_connection_accepted,
        "linkedin_first_message_sent": cc.linkedin_first_message_sent,
        "linkedin_unavailable": cc.linkedin_unavailable,
        "linkedin_failed_attempts": cc.linkedin_failed_attempts,
    }


@router.get("/settings/{campaign_id}")
def get_templates(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found.")
    return {
        "campaign_id": campaign.id,
        "connection_note": campaign.linkedin_connection_note_template or DEFAULT_CONNECTION_NOTE,
        "first_message": campaign.linkedin_first_message_template or DEFAULT_FIRST_MESSAGE,
        "merge_fields": ["{{first_name}}", "{{last_name}}", "{{company}}", "{{sender_name}}"],
    }


@router.patch("/settings/{campaign_id}")
def update_templates(
    campaign_id: int,
    body: TemplateUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found.")
    if body.connection_note is not None:
        campaign.linkedin_connection_note_template = body.connection_note
    if body.first_message is not None:
        campaign.linkedin_first_message_template = body.first_message
    db.commit()
    log_audit_event(
        db, action="LINKEDIN_TEMPLATE_UPDATE", resource_type="CAMPAIGN",
        resource_id=campaign.id, user=current_user,
        metadata={"connection_note": body.connection_note, "first_message": body.first_message},
    )
    return {
        "campaign_id": campaign.id,
        "connection_note": campaign.linkedin_connection_note_template,
        "first_message": campaign.linkedin_first_message_template,
    }
