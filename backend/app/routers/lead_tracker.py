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
from app.core.security import hash_password
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
    assigned_user: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
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
    elif assigned_user and assigned_user.lower() != "all":
        u_ids = [
            u.id
            for u in db.query(User)
            .filter(or_(User.name.ilike(f"%{assigned_user}%"), User.email.ilike(f"%{assigned_user}%")))
            .all()
        ]
        if u_ids:
            query = query.filter(CampaignContact.assigned_user_id.in_(u_ids))
        else:
            query = query.filter(CampaignContact.id == -1)
    if status and status.lower() != "all":
        query = query.filter(CampaignContact.status.ilike(status))
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


@router.post("/sync/push")
def sync_push_to_sheet(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Manually push all tracker leads to Google Sheets."""
    result = google_sheets_service.push_all_tracker_rows(db)
    log_audit_event(
        db,
        action="LEAD_TRACKER_SHEET_PUSH",
        resource_type="CAMPAIGN_CONTACT",
        resource_id=None,
        user=current_user,
        metadata=result,
    )
    pushed = result.get("pushed", 0)
    return {"success": True, "message": f"Successfully pushed {pushed} leads to Google Sheets.", **result}


class TrackerUserCreate(BaseModel):
    name: str
    display_name: Optional[str] = None
    email: str
    password: Optional[str] = "Secret123!"
    role: Optional[str] = "BUSINESS_DEVELOPMENT"


class TrackerUserUpdate(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None


@router.get("/users")
def get_tracker_users(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.is_active.is_(True)).all()
    return [
        {
            "id": str(u.id),
            "name": u.name,
            "display_name": u.name,
            "email": u.email,
            "role": u.role,
        }
        for u in users
    ]


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_tracker_user(
    body: TrackerUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    email_clean = body.email.lower().strip()
    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"User with email '{email_clean}' already exists.")
    user = User(
        name=body.display_name or body.name,
        email=email_clean,
        password_hash=hash_password(body.password or "Secret123!"),
        role=body.role or "BUSINESS_DEVELOPMENT",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "id": str(user.id),
        "name": user.name,
        "display_name": user.name,
        "email": user.email,
        "role": user.role,
    }


@router.patch("/users/{user_id}")
def update_tracker_user(
    user_id: int,
    body: TrackerUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if body.name or body.display_name:
        user.name = body.display_name or body.name
    if body.email:
        user.email = body.email.lower().strip()
    if body.role:
        user.role = body.role
    db.commit()
    db.refresh(user)
    return {
        "id": str(user.id),
        "name": user.name,
        "display_name": user.name,
        "email": user.email,
        "role": user.role,
    }


@router.delete("/users/{user_id}")
def delete_tracker_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    user.is_active = False
    db.commit()
    return {"message": f"User '{user.name}' successfully removed."}


class CreateLeadRequest(BaseModel):
    name: str
    email: str
    company: Optional[str] = None
    focus: Optional[str] = None
    linkedin: Optional[str] = None
    campaign_id: Optional[int] = None
    notes: Optional[str] = None
    role: Optional[str] = "lead"


@router.post("/leads", status_code=status.HTTP_201_CREATED)
def create_tracker_lead(
    body: CreateLeadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    # Find or select campaign
    campaign = None
    if body.campaign_id:
        campaign = db.query(Campaign).filter(Campaign.id == body.campaign_id).first()
    if not campaign:
        campaign = db.query(Campaign).first()
    if not campaign:
        campaign = Campaign(name="General Outreach", category="client", status="Active")
        db.add(campaign)
        db.commit()
        db.refresh(campaign)

    # Find or create organization
    org_name = (body.company or "Independent / Unspecified").strip()
    org = db.query(Organization).filter(Organization.name.ilike(org_name)).first()
    if not org:
        org = Organization(name=org_name, organization_type="Prospect", status="Active", owner_id=current_user.id)
        db.add(org)
        db.commit()
        db.refresh(org)

    # Find or create contact
    parts = body.name.strip().split(" ", 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ""
    contact = db.query(Contact).filter(Contact.email == body.email.strip()).first()
    if not contact:
        contact = Contact(
            first_name=first_name,
            last_name=last_name,
            email=body.email.strip(),
            linkedin_url=body.linkedin.strip() if body.linkedin else None,
            organization_id=org.id,
            owner_id=current_user.id,
        )
        db.add(contact)
        db.commit()
        db.refresh(contact)

    # Create CampaignContact
    cc = CampaignContact(
        campaign_id=campaign.id,
        contact_id=contact.id,
        organization_id=org.id,
        assigned_user_id=current_user.id,
        focus=body.focus,
        tracker_notes=body.notes,
        status="Pending",
    )
    db.add(cc)
    db.commit()
    db.refresh(cc)

    svc.log_timeline_event(
        db,
        campaign_contact_id=cc.id,
        user_id=current_user.id,
        event_type="lead_created",
        description=f"Lead created in campaign '{campaign.name}'",
        metadata={"name": body.name, "email": body.email},
    )
    google_sheets_service.push_tracker_row(cc)
    return _row_out(cc, db)


@router.delete("/{campaign_contact_id}")
def delete_tracker_lead(
    campaign_contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    cc = db.query(CampaignContact).filter(CampaignContact.id == campaign_contact_id).first()
    if not cc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found.")
    contact_name = f"{cc.contact.first_name} {cc.contact.last_name or ''}".strip() if cc.contact else f"Lead #{cc.id}"
    db.delete(cc)
    db.commit()
    return {"message": f"Lead '{contact_name}' deleted successfully."}
