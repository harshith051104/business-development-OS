import math
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import desc, asc, or_
from sqlalchemy.orm import Session

from app.auth.deps import require_business_development
from app.core.audit import log_audit_event
from app.core.database import get_db
from app.models.user import User
from app.models.contact import Contact
from app.models.organization import Organization
from app.models.campaign import (
    Campaign,
    CampaignContact,
    LEAD_TRACKER_CHECKBOX_FIELDS,
    LEAD_TRACKER_CHECKBOX_LABELS,
)
from app.services import lead_tracker_service as svc
from app.services import google_sheets_service

router = APIRouter(
    prefix="/api/business-development/lead-tracker",
    tags=["Lead Tracker"],
    dependencies=[Depends(require_business_development)],
)

SENT_STATUSES = {"Sent", "Replied", "Completed"}


class CheckboxUpdateRequest(BaseModel):
    updates: Dict[str, Any]


class TimelineEventRequest(BaseModel):
    event_type: str
    description: str
    metadata: Dict[str, Any] = {}


def _row_out(cc: CampaignContact, db: Session) -> Dict[str, Any]:
    contact = db.query(Contact).filter(Contact.id == cc.contact_id).first()
    org = db.query(Organization).filter(Organization.id == cc.organization_id).first()
    campaign = db.query(Campaign).filter(Campaign.id == cc.campaign_id).first()
    assignee = db.query(User).filter(User.id == cc.assigned_user_id).first() if cc.assigned_user_id else None

    out = {
        "id": cc.id,
        "campaign_id": cc.campaign_id,
        "campaign_name": campaign.name if campaign else None,
        "contact_id": cc.contact_id,
        "name": f"{contact.first_name} {contact.last_name or ''}".strip() if contact else None,
        "email": contact.email if contact else None,
        "linkedin": contact.linkedin_url if contact else None,
        "company": org.name if org else None,
        "organization_id": cc.organization_id,
        "status": cc.status,
        "focus": cc.focus,
        "notes": cc.tracker_notes,
        "assigned_user_id": cc.assigned_user_id,
        "assigned_user": assignee.name if assignee else None,
        "next_followup_at": cc.next_followup_at,
        "last_activity_at": cc.updated_at,
        "email_sent": cc.status in SENT_STATUSES,
        "email_opened": cc.opened_at is not None,
        "email_replied": cc.replied_at is not None,
    }
    for f in LEAD_TRACKER_CHECKBOX_FIELDS:
        out[f] = bool(getattr(cc, f))
    return out


@router.get("/fields")
def get_checkbox_fields():
    return {"checkbox_fields": LEAD_TRACKER_CHECKBOX_FIELDS, "labels": LEAD_TRACKER_CHECKBOX_LABELS}


@router.get("/team-progress")
def team_progress(campaign_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    return svc.get_team_progress(db, campaign_id=campaign_id)


@router.post("/sync/pull")
def sync_pull_from_sheet(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Manually trigger a pull of 'ELLY Lead Tracker' sheet edits into the DB."""
    result = google_sheets_service.pull_updates(db)
    log_audit_event(
        db,
        action="LEAD_TRACKER_SHEET_PULL",
        resource_type="CAMPAIGN_CONTACT",
        resource_id=None,
        user=current_user,
        metadata=result,
    )
    return result


@router.get("")
def get_tracker_board(
    campaign_id: Optional[int] = Query(None),
    assigned_user_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sort_by: str = Query("last_activity_at"),
    sort_dir: int = Query(-1, ge=-1, le=1),
    db: Session = Depends(get_db),
):
    query = db.query(CampaignContact)
    if campaign_id:
        query = query.filter(CampaignContact.campaign_id == campaign_id)
    if assigned_user_id:
        query = query.filter(CampaignContact.assigned_user_id == assigned_user_id)
    if search:
        matching_contacts = db.query(Contact.id).filter(
            or_(Contact.first_name.ilike(f"%{search}%"), Contact.last_name.ilike(f"%{search}%"), Contact.email.ilike(f"%{search}%"))
        )
        matching_orgs = db.query(Organization.id).filter(Organization.name.ilike(f"%{search}%"))
        query = query.filter(
            or_(
                CampaignContact.contact_id.in_(matching_contacts),
                CampaignContact.organization_id.in_(matching_orgs),
            )
        )

    total = query.count()

    sort_field_map = {
        "last_activity_at": CampaignContact.updated_at,
        "created_at": CampaignContact.created_at,
        "status": CampaignContact.status,
        "next_followup_at": CampaignContact.next_followup_at,
    }
    sort_col = sort_field_map.get(sort_by, CampaignContact.updated_at)
    query = query.order_by(desc(sort_col) if sort_dir < 0 else asc(sort_col))

    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    leads = [_row_out(cc, db) for cc in rows]

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
        "leads": leads,
    }


@router.get("/{campaign_contact_id}")
def get_tracker_row(campaign_contact_id: int, db: Session = Depends(get_db)):
    cc = db.query(CampaignContact).filter(CampaignContact.id == campaign_contact_id).first()
    if not cc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found.")
    return _row_out(cc, db)


@router.patch("/{campaign_contact_id}/checkboxes")
def update_lead_checkboxes(
    campaign_contact_id: int,
    body: CheckboxUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    if not body.updates:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="updates must be non-empty.")
    try:
        cc = svc.update_checkboxes(db, campaign_contact_id, current_user.id, body.updates)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    log_audit_event(
        db,
        action="LEAD_TRACKER_CHECKBOX_UPDATE",
        resource_type="CAMPAIGN_CONTACT",
        resource_id=cc.id,
        user=current_user,
        metadata={"updates": body.updates},
    )
    return _row_out(cc, db)


@router.get("/{campaign_contact_id}/timeline")
def get_lead_timeline(campaign_contact_id: int, limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    events = svc.get_timeline(db, campaign_contact_id, limit=limit)
    return [
        {
            "id": e.id,
            "campaign_contact_id": e.campaign_contact_id,
            "user_id": e.user_id,
            "event_type": e.event_type,
            "description": e.description,
            "metadata": e.event_metadata,
            "created_at": e.created_at,
        }
        for e in events
    ]


@router.post("/{campaign_contact_id}/timeline", status_code=status.HTTP_201_CREATED)
def add_timeline_event(
    campaign_contact_id: int,
    body: TimelineEventRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    event = svc.log_timeline_event(
        db,
        campaign_contact_id=campaign_contact_id,
        user_id=current_user.id,
        event_type=body.event_type,
        description=body.description,
        metadata=body.metadata,
    )
    return {
        "id": event.id,
        "campaign_contact_id": event.campaign_contact_id,
        "user_id": event.user_id,
        "event_type": event.event_type,
        "description": event.description,
        "metadata": event.event_metadata,
        "created_at": event.created_at,
    }
