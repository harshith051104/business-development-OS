import logging
import math
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.organization import Organization, ConnectionStatus
from app.models.contact import Contact
from app.models.opportunity import Opportunity
from app.models.project import Project
from app.models.communication import (
    Communication,
    CommunicationChannel,
    CommunicationDirection,
    CommunicationStatus,
)
from app.models.activity import ContactActivity
from app.models.followup import FollowUp, FollowUpPriority, FollowUpStatus
from app.models.outreach import (
    OutreachDraft,
    OutreachTemplate,
    OutreachChannel,
    DraftStatus,
    TemplateCategory,
)
from app.schemas.outreach import (
    OutreachDraftCreate,
    OutreachDraftUpdate,
    OutreachDraftOut,
    PaginatedOutreachDraftsOut,
    OutreachTemplateCreate,
    OutreachTemplateUpdate,
    OutreachTemplateOut,
    OutreachRecordActionIn,
    OutreachRecordActionOut,
)
from app.core.audit import log_audit_event

logger = logging.getLogger("elly.bd_portal.outreach")

router = APIRouter(
    prefix="/api/business-development/outreach",
    tags=["Outreach Workspace"],
    dependencies=[Depends(require_business_development)],
)


def _draft_to_out(draft: OutreachDraft) -> OutreachDraftOut:
    return OutreachDraftOut(
        id=draft.id,
        organization_id=draft.organization_id,
        organization_name=draft.organization.name if draft.organization else None,
        contact_id=draft.contact_id,
        contact_name=f"{draft.contact.first_name} {draft.contact.last_name or ''}".strip() if draft.contact else None,
        contact_email=draft.contact.email if draft.contact else None,
        contact_phone=draft.contact.phone if draft.contact else None,
        contact_linkedin=draft.contact.linkedin_url if draft.contact else None,
        opportunity_id=draft.opportunity_id,
        opportunity_title=draft.opportunity.name if draft.opportunity else None,
        project_id=draft.project_id,
        project_name=draft.project.name if draft.project else None,
        channel=draft.channel,
        subject=draft.subject,
        message=draft.message,
        call_purpose=draft.call_purpose,
        status=draft.status,
        created_by=draft.created_by,
        created_at=draft.created_at,
        updated_at=draft.updated_at,
    )


# ══════════════════════════════════════════════════════════════════════════
# DRAFT MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════

@router.get("/drafts", response_model=PaginatedOutreachDraftsOut)
def list_outreach_drafts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    channel: Optional[str] = None,
    organization_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    query = db.query(OutreachDraft)

    if status and status != "All":
        query = query.filter(OutreachDraft.status == status)
    if channel and channel != "All":
        query = query.filter(OutreachDraft.channel == channel)
    if organization_id:
        query = query.filter(OutreachDraft.organization_id == organization_id)

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    drafts = (
        query.order_by(desc(OutreachDraft.updated_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedOutreachDraftsOut(
        items=[_draft_to_out(d) for d in drafts],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/drafts/{id}", response_model=OutreachDraftOut)
def get_outreach_draft(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    draft = db.query(OutreachDraft).filter(OutreachDraft.id == id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Outreach draft not found.")
    return _draft_to_out(draft)


@router.post("/drafts", response_model=OutreachDraftOut, status_code=status.HTTP_201_CREATED)
def create_outreach_draft(
    payload: OutreachDraftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    org = db.query(Organization).filter(Organization.id == payload.organization_id, Organization.is_deleted == False).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    if payload.contact_id:
        contact = db.query(Contact).filter(Contact.id == payload.contact_id, Contact.is_deleted == False).first()
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found.")
        if contact.organization_id != payload.organization_id:
            raise HTTPException(status_code=400, detail="Contact does not belong to the selected organization.")

    if payload.opportunity_id:
        opp = db.query(Opportunity).filter(Opportunity.id == payload.opportunity_id, Opportunity.is_deleted == False).first()
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity not found.")
        if opp.organization_id != payload.organization_id:
            raise HTTPException(status_code=400, detail="Opportunity does not belong to the selected organization.")

    if payload.project_id:
        proj = db.query(Project).filter(Project.id == payload.project_id, Project.is_deleted == False).first()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found.")

    draft = OutreachDraft(
        organization_id=payload.organization_id,
        contact_id=payload.contact_id,
        opportunity_id=payload.opportunity_id,
        project_id=payload.project_id,
        channel=payload.channel,
        subject=payload.subject,
        message=payload.message,
        call_purpose=payload.call_purpose,
        status=payload.status or DraftStatus.DRAFT.value,
        created_by=current_user.id,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)

    log_audit_event(
        db=db,
        action="OUTREACH_DRAFT_CREATED",
        resource_type="outreach_draft",
        resource_id=draft.id,
        user=current_user,
        metadata={"organization_id": draft.organization_id, "channel": draft.channel, "subject": draft.subject},
    )

    return _draft_to_out(draft)


@router.patch("/drafts/{id}", response_model=OutreachDraftOut)
def update_outreach_draft(
    id: int,
    payload: OutreachDraftUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    draft = db.query(OutreachDraft).filter(OutreachDraft.id == id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Outreach draft not found.")

    if payload.contact_id is not None:
        if payload.contact_id > 0:
            contact = db.query(Contact).filter(Contact.id == payload.contact_id, Contact.is_deleted == False).first()
            if not contact or contact.organization_id != draft.organization_id:
                raise HTTPException(status_code=400, detail="Contact does not belong to the organization.")
            draft.contact_id = payload.contact_id
        else:
            draft.contact_id = None

    if payload.opportunity_id is not None:
        if payload.opportunity_id > 0:
            opp = db.query(Opportunity).filter(Opportunity.id == payload.opportunity_id, Opportunity.is_deleted == False).first()
            if not opp or opp.organization_id != draft.organization_id:
                raise HTTPException(status_code=400, detail="Opportunity does not belong to the organization.")
            draft.opportunity_id = payload.opportunity_id
        else:
            draft.opportunity_id = None

    if payload.project_id is not None:
        draft.project_id = payload.project_id if payload.project_id > 0 else None

    if payload.channel is not None:
        draft.channel = payload.channel
    if payload.subject is not None:
        draft.subject = payload.subject
    if payload.message is not None:
        draft.message = payload.message
    if payload.call_purpose is not None:
        draft.call_purpose = payload.call_purpose
    if payload.status is not None:
        draft.status = payload.status

    draft.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(draft)

    log_audit_event(
        db=db,
        action="OUTREACH_DRAFT_UPDATED",
        resource_type="outreach_draft",
        resource_id=draft.id,
        user=current_user,
        metadata={"status": draft.status, "channel": draft.channel},
    )

    return _draft_to_out(draft)


@router.delete("/drafts/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_outreach_draft(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    draft = db.query(OutreachDraft).filter(OutreachDraft.id == id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Outreach draft not found.")

    org_id = draft.organization_id
    db.delete(draft)
    db.commit()

    log_audit_event(
        db=db,
        action="OUTREACH_DRAFT_DELETED",
        resource_type="outreach_draft",
        resource_id=id,
        user=current_user,
        metadata={"organization_id": org_id},
    )
    return None


# ══════════════════════════════════════════════════════════════════════════
# TEMPLATE MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════

@router.get("/templates", response_model=List[OutreachTemplateOut])
def list_outreach_templates(
    category: Optional[str] = None,
    channel: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    query = db.query(OutreachTemplate)
    if active_only:
        query = query.filter(OutreachTemplate.is_active == True)
    if category and category != "All":
        query = query.filter(OutreachTemplate.category == category)
    if channel and channel != "All":
        query = query.filter(OutreachTemplate.channel == channel)

    return query.order_by(OutreachTemplate.category, OutreachTemplate.name).all()


@router.post("/templates", response_model=OutreachTemplateOut, status_code=status.HTTP_201_CREATED)
def create_outreach_template(
    payload: OutreachTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    tpl = OutreachTemplate(
        name=payload.name,
        category=payload.category,
        channel=payload.channel,
        subject=payload.subject,
        body=payload.body,
        is_active=payload.is_active,
        created_by=current_user.id,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)

    log_audit_event(
        db=db,
        action="OUTREACH_TEMPLATE_CREATED",
        resource_type="outreach_template",
        resource_id=tpl.id,
        user=current_user,
        metadata={"name": tpl.name, "category": tpl.category, "channel": tpl.channel},
    )

    return tpl


@router.patch("/templates/{id}", response_model=OutreachTemplateOut)
def update_outreach_template(
    id: int,
    payload: OutreachTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    tpl = db.query(OutreachTemplate).filter(OutreachTemplate.id == id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Outreach template not found.")

    if payload.name is not None:
        tpl.name = payload.name
    if payload.category is not None:
        tpl.category = payload.category
    if payload.channel is not None:
        tpl.channel = payload.channel
    if payload.subject is not None:
        tpl.subject = payload.subject
    if payload.body is not None:
        tpl.body = payload.body
    if payload.is_active is not None:
        tpl.is_active = payload.is_active

    tpl.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(tpl)

    log_audit_event(
        db=db,
        action="OUTREACH_TEMPLATE_UPDATED",
        resource_type="outreach_template",
        resource_id=tpl.id,
        user=current_user,
        metadata={"name": tpl.name},
    )

    return tpl


@router.delete("/templates/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_outreach_template(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    tpl = db.query(OutreachTemplate).filter(OutreachTemplate.id == id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Outreach template not found.")

    name = tpl.name
    db.delete(tpl)
    db.commit()

    log_audit_event(
        db=db,
        action="OUTREACH_TEMPLATE_DELETED",
        resource_type="outreach_template",
        resource_id=id,
        user=current_user,
        metadata={"name": name},
    )
    return None


# ══════════════════════════════════════════════════════════════════════════
# RECORD OUTREACH ACTION
# ══════════════════════════════════════════════════════════════════════════

@router.post("/record", response_model=OutreachRecordActionOut)
def record_outreach_action(
    payload: OutreachRecordActionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    # 1. Validate organization
    org = db.query(Organization).filter(Organization.id == payload.organization_id, Organization.is_deleted == False).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    # 2. Validate contact if provided
    contact = None
    if payload.contact_id:
        contact = db.query(Contact).filter(Contact.id == payload.contact_id, Contact.is_deleted == False).first()
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found.")
        if contact.organization_id != payload.organization_id:
            raise HTTPException(status_code=400, detail="Contact does not belong to the selected organization.")

    # 3. Validate opportunity if provided
    if payload.opportunity_id:
        opp = db.query(Opportunity).filter(Opportunity.id == payload.opportunity_id, Opportunity.is_deleted == False).first()
        if not opp or opp.organization_id != payload.organization_id:
            raise HTTPException(status_code=400, detail="Opportunity does not belong to the selected organization.")

    # 4. Create Phase 8 Communication record
    comm_date = payload.communication_date or datetime.now(timezone.utc)
    comm_subject = payload.subject or f"Outreach ({payload.channel}): {payload.summary[:50]}"
    comm = Communication(
        organization_id=payload.organization_id,
        contact_id=payload.contact_id,
        opportunity_id=payload.opportunity_id,
        channel=payload.channel,
        direction=payload.direction or CommunicationDirection.OUTGOING.value,
        subject=comm_subject,
        summary=payload.summary,
        content=payload.notes or payload.summary,
        communication_date=comm_date,
        status=CommunicationStatus.COMPLETED.value,
        created_by=current_user.name,
    )
    db.add(comm)

    # 5. Log contact activity if contact is linked
    if contact:
        activity = ContactActivity(
            contact_id=contact.id,
            organization_id=payload.organization_id,
            opportunity_id=payload.opportunity_id,
            performed_by=current_user.name,
            activity_type=f"outreach_{payload.channel.lower()}",
            description=f"Outreach logged ({payload.channel}): {payload.summary}",
        )
        db.add(activity)

    # 6. Update draft status if draft_id is supplied
    if payload.draft_id:
        draft = db.query(OutreachDraft).filter(OutreachDraft.id == payload.draft_id).first()
        if draft:
            draft.status = DraftStatus.COMPLETED.value
            draft.updated_at = datetime.now(timezone.utc)

    # 7. Auto-update org status on outgoing email — email sent = Contacted
    status_updated = False
    new_org_status = None
    if payload.direction == CommunicationDirection.OUTGOING.value and payload.channel == "Email":
        if org.status in [ConnectionStatus.NEW.value, ConnectionStatus.POTENTIAL.value]:
            org.status = ConnectionStatus.CONTACTED.value
            org.updated_at = datetime.now(timezone.utc)
            status_updated = True
            new_org_status = ConnectionStatus.CONTACTED.value
    elif payload.update_organization_status and payload.new_organization_status:
        org.connection_status = payload.new_organization_status
        org.updated_at = datetime.now(timezone.utc)
        status_updated = True
        new_org_status = payload.new_organization_status

    # 8. Optional Phase 6 Follow-up creation
    followup_id = None
    if payload.create_followup:
        followup_title = payload.followup_title or f"Follow-up on outreach: {payload.summary[:40]}"
        due = payload.followup_due_at or datetime.now(timezone.utc)
        prio = payload.followup_priority or FollowUpPriority.MEDIUM.value

        fu = FollowUp(
            organization_id=payload.organization_id,
            contact_id=payload.contact_id,
            title=followup_title,
            due_at=due,
            priority=prio,
            status=FollowUpStatus.PENDING.value,
            description=payload.followup_notes or f"Created from outreach workspace: {payload.summary}",
            assigned_to=current_user.name or str(current_user.id),
            created_by=current_user.id,
        )
        db.add(fu)
        db.flush()
        followup_id = fu.id

    db.commit()
    db.refresh(comm)

    # 9. Structured Audit Log
    log_audit_event(
        db=db,
        action="OUTREACH_RECORDED",
        resource_type="communication",
        resource_id=comm.id,
        user=current_user,
        metadata={
            "organization_id": payload.organization_id,
            "contact_id": payload.contact_id,
            "channel": payload.channel,
            "status_updated": status_updated,
            "followup_id": followup_id,
        },
    )

    return OutreachRecordActionOut(
        communication_id=comm.id,
        draft_id=payload.draft_id,
        organization_id=payload.organization_id,
        organization_status_updated=status_updated,
        new_organization_status=new_org_status,
        followup_id=followup_id,
        message="Outreach communication successfully recorded.",
    )


# ══════════════════════════════════════════════════════════════════════════
# AI-GENERATED PERSONALIZED OUTREACH DRAFT
# ══════════════════════════════════════════════════════════════════════════

@router.post("/generate-ai-draft")
def generate_ai_outreach_draft(
    contact_id: int,
    project_id: Optional[int] = None,
    subject_template: Optional[str] = None,
    body_template: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """
    Generates an AI-personalized outreach email draft utilizing existing Organization,
    Contact, Opportunity, and ELLY Showcase context, scored on a 0-100 quality scale.
    """
    from app.services.campaign.compiler import CampaignCompiler
    from app.services.campaign.research_aggregator import ResearchAggregator

    try:
        # Pre-select preferred project if specified
        context = ResearchAggregator.collect_context(db, contact_id, sender_user=current_user, preferred_project_id=project_id)
        
        compiled = CampaignCompiler.compile_step_email(
            db=db,
            contact_id=contact_id,
            subject_template=subject_template,
            body_template=body_template,
            step_number=1,
            sender_user=current_user,
        )

        return {
            "success": True,
            "contact_id": contact_id,
            "contact_name": compiled["contact_name"],
            "organization_name": compiled["organization_name"],
            "subject": compiled["subject"],
            "body_plain": compiled["body_plain"],
            "body_html": compiled["body_html"],
            "personalization_score": compiled["personalization_score"],
            "unresolved_placeholders": compiled["unresolved_placeholders"],
            "is_valid": compiled["is_valid"],
            "ai_generated_fields": compiled["ai_generated_fields"],
            "showcase_project_used": compiled["showcase_project_used"],
        }
    except Exception as e:
        logger.error(f"Error generating AI outreach draft: {e}")
        raise HTTPException(status_code=400, detail=str(e))

