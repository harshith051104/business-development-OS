import enum
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.auth.deps import get_current_user
from app.models.user import User
from app.models.organization import Organization, ConnectionStatus
from app.models.contact import Contact
from app.models.opportunity import Opportunity
from app.models.followup import FollowUp, FollowUpPriority, FollowUpStatus
from app.models.communication import (
    Communication,
    CommunicationChannel,
    CommunicationDirection,
    CommunicationStatus,
)
from app.core.audit import log_audit_event

router = APIRouter(prefix="/api/business-development/calls", tags=["Calls"])


class CallOutcome(str, enum.Enum):
    CONNECTED = "Connected"
    INTERESTED = "Interested"
    NOT_INTERESTED = "Not Interested"
    CALLBACK = "Callback"
    NO_ANSWER = "No Answer"
    WRONG_NUMBER = "Wrong Number"
    MEETING_REQUESTED = "Meeting Requested"
    DEMO_REQUESTED = "Demo Requested"


class CallLogRequest(BaseModel):
    organization_id: int
    contact_id: Optional[int] = None
    opportunity_id: Optional[int] = None
    call_date: Optional[datetime] = None
    duration_minutes: Optional[int] = 5
    outcome: CallOutcome = CallOutcome.CONNECTED
    notes: str
    next_action: Optional[str] = None
    schedule_followup: Optional[bool] = False
    followup_date: Optional[datetime] = None


class CallLogOut(BaseModel):
    id: int
    organization_id: int
    contact_id: Optional[int] = None
    opportunity_id: Optional[int] = None
    channel: str
    direction: str
    subject: str
    summary: Optional[str] = None
    content: Optional[str] = None
    communication_date: datetime
    status: str
    organization_name: Optional[str] = None
    contact_name: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=List[CallLogOut])
def list_calls(
    organization_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Communication).filter(
        Communication.channel == CommunicationChannel.PHONE.value,
        Communication.is_deleted == False
    )
    if organization_id:
        q = q.filter(Communication.organization_id == organization_id)
    if contact_id:
        q = q.filter(Communication.contact_id == contact_id)

    calls = q.order_by(desc(Communication.communication_date)).limit(limit).all()

    results = []
    for c in calls:
        results.append(CallLogOut(
            id=c.id,
            organization_id=c.organization_id,
            contact_id=c.contact_id,
            opportunity_id=c.opportunity_id,
            channel=c.channel,
            direction=c.direction,
            subject=c.subject,
            summary=c.summary,
            content=c.content,
            communication_date=c.communication_date,
            status=c.status,
            organization_name=c.organization.name if c.organization else None,
            contact_name=f"{c.contact.first_name} {c.contact.last_name}" if c.contact else None,
            created_by=c.created_by,
            created_at=c.created_at,
        ))
    return results


@router.post("", response_model=CallLogOut, status_code=status.HTTP_201_CREATED)
def log_call(
    payload: CallLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = db.query(Organization).filter(Organization.id == payload.organization_id, Organization.is_deleted == False).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    contact = None
    if payload.contact_id:
        contact = db.query(Contact).filter(Contact.id == payload.contact_id, Contact.is_deleted == False).first()

    contact_name = f"{contact.first_name} {contact.last_name}" if contact else "Decision Maker"
    subject = f"Phone Call with {contact_name} ({payload.outcome.value})"
    summary = f"Outcome: {payload.outcome.value}. Notes: {payload.notes[:100]}"
    call_dt = payload.call_date or datetime.now(timezone.utc)

    # Insert into unified Communication timeline
    comm = Communication(
        organization_id=payload.organization_id,
        contact_id=payload.contact_id,
        opportunity_id=payload.opportunity_id,
        channel=CommunicationChannel.PHONE.value,
        direction=CommunicationDirection.OUTGOING.value,
        subject=subject,
        summary=summary,
        content=f"Call Outcome: {payload.outcome.value}\nDuration: {payload.duration_minutes} mins\nNotes: {payload.notes}\nNext Action: {payload.next_action or 'N/A'}",
        communication_date=call_dt,
        status=CommunicationStatus.COMPLETED.value,
        created_by=current_user.name,
    )
    db.add(comm)

    # If outcome is Interested / Meeting Requested / Demo Requested, update organization stage
    if payload.outcome in [CallOutcome.DEMO_REQUESTED]:
        org.status = ConnectionStatus.DEMO.value
    elif payload.outcome in [CallOutcome.MEETING_REQUESTED]:
        org.status = ConnectionStatus.MEETING.value
    elif payload.outcome in [CallOutcome.INTERESTED, CallOutcome.CONNECTED]:
        if org.status in [ConnectionStatus.NEW.value, ConnectionStatus.POTENTIAL.value, ConnectionStatus.CONTACTED.value]:
            org.status = ConnectionStatus.RESPONDED.value
    elif org.status in [ConnectionStatus.NEW.value, ConnectionStatus.POTENTIAL.value]:
        org.status = ConnectionStatus.CONTACTED.value

    # Optional auto-schedule follow-up
    if payload.schedule_followup and payload.followup_date:
        fu = FollowUp(
            organization_id=payload.organization_id,
            contact_id=payload.contact_id,
            opportunity_id=payload.opportunity_id,
            title=f"Call Follow-up: {payload.next_action or 'Check-in with ' + contact_name}",
            description=f"Generated from call on {call_dt.strftime('%b %d')}. Outcome was {payload.outcome.value}.",
            due_at=payload.followup_date,
            priority=FollowUpPriority.HIGH.value if payload.outcome in [CallOutcome.INTERESTED, CallOutcome.MEETING_REQUESTED, CallOutcome.DEMO_REQUESTED] else FollowUpPriority.MEDIUM.value,
            status=FollowUpStatus.PENDING.value,
            assigned_to=current_user.name,
            created_by=current_user.id,
        )
        db.add(fu)

    log_audit_event(
        db,
        action="LOG_CALL",
        resource_type="CALL",
        resource_id=org.id,
        user=current_user,
        metadata={"outcome": payload.outcome.value, "organization_name": org.name, "contact_name": contact_name},
    )
    db.commit()
    db.refresh(comm)

    return CallLogOut(
        id=comm.id,
        organization_id=comm.organization_id,
        contact_id=comm.contact_id,
        opportunity_id=comm.opportunity_id,
        channel=comm.channel,
        direction=comm.direction,
        subject=comm.subject,
        summary=comm.summary,
        content=comm.content,
        communication_date=comm.communication_date,
        status=comm.status,
        organization_name=org.name,
        contact_name=contact_name if contact else None,
        created_by=comm.created_by,
        created_at=comm.created_at,
    )
