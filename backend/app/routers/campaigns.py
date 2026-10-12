from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.user import User
from app.models.campaign import (
    Campaign,
    CampaignStatus,
    CampaignSequenceStep,
    CampaignContact,
    CampaignContactStatus,
)
from app.models.contact import Contact
from app.models.organization import Organization
from app.schemas.campaign import (
    CampaignCreate,
    CampaignUpdate,
    CampaignOut,
    CampaignDetailOut,
    CampaignContactOut,
    CampaignSequenceStepOut,
    CampaignContactAddRequest,
    CampaignPreviewRequest,
    CampaignPreviewResponse,
    CampaignSendReviewRequest,
)
from app.services.campaign_service import CampaignService
from app.services.campaign.compiler import CampaignCompiler

router = APIRouter(
    prefix="/api/business-development/campaigns",
    tags=["Campaigns & Outreach Sequences"],
    dependencies=[Depends(require_business_development)],
)


def _enrich_campaign_out(c: Campaign, db: Session) -> CampaignOut:
    stats = CampaignService.get_campaign_stats(db, c.id)
    steps_out = [CampaignSequenceStepOut.model_validate(s) for s in c.sequence_steps]
    return CampaignOut(
        id=c.id,
        name=c.name,
        description=c.description,
        status=c.status,
        sender_email=c.sender_email,
        gmail_account_id=c.gmail_account_id,
        target_industry=c.target_industry,
        created_by=c.created_by,
        created_at=c.created_at,
        updated_at=c.updated_at,
        sequence_steps=steps_out,
        stats=stats,
    )


@router.post("", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
def create_campaign(
    data: CampaignCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    campaign = CampaignService.create_campaign(db, current_user, data)
    return _enrich_campaign_out(campaign, db)


@router.get("", response_model=List[CampaignOut])
def list_campaigns(
    status: Optional[str] = None,
    industry: Optional[str] = None,
    owner_scope: str = Query("mine", description="Scope: 'mine' or 'all'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    query = db.query(Campaign).order_by(desc(Campaign.created_at))
    if status and status != "All":
        query = query.filter(Campaign.status == status)
    if industry and industry != "All":
        query = query.filter(Campaign.target_industry == industry)
    if owner_scope == "mine" and current_user.role != "ADMIN":
        query = query.filter(Campaign.owner_id == current_user.id)
    
    campaigns = query.all()
    return [_enrich_campaign_out(c, db) for c in campaigns]


@router.get("/{campaign_id}", response_model=CampaignDetailOut)
def get_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    stats = CampaignService.get_campaign_stats(db, campaign.id)
    steps_out = [CampaignSequenceStepOut.model_validate(s) for s in campaign.sequence_steps]
    
    contacts_out = []
    for cc in campaign.campaign_contacts:
        c = db.query(Contact).filter(Contact.id == cc.contact_id).first()
        org = db.query(Organization).filter(Organization.id == cc.organization_id).first()
        contacts_out.append(CampaignContactOut(
            id=cc.id,
            campaign_id=cc.campaign_id,
            contact_id=cc.contact_id,
            organization_id=cc.organization_id,
            contact_name=c.full_name if c else None,
            contact_email=c.email if c else None,
            contact_role=c.designation if c else None,
            organization_name=org.name if org else None,
            organization_industry=org.industry or org.organization_type if org else None,
            organization_city=org.city if org else None,
            current_step_number=cc.current_step_number,
            status=cc.status,
            personalization_score=cc.personalization_score,
            subject_preview=cc.subject_preview,
            body_preview=cc.body_preview,
            ai_cache=cc.ai_cache,
            last_action_at=cc.last_action_at,
            next_action_due=cc.next_action_due,
            last_message_id=cc.last_message_id,
            thread_id=cc.thread_id,
            created_at=cc.created_at,
            updated_at=cc.updated_at,
        ))

    return CampaignDetailOut(
        id=campaign.id,
        name=campaign.name,
        description=campaign.description,
        status=campaign.status,
        sender_email=campaign.sender_email,
        gmail_account_id=campaign.gmail_account_id,
        target_industry=campaign.target_industry,
        created_by=campaign.created_by,
        created_at=campaign.created_at,
        updated_at=campaign.updated_at,
        sequence_steps=steps_out,
        stats=stats,
        campaign_contacts=contacts_out,
    )


@router.put("/{campaign_id}", response_model=CampaignOut)
def update_campaign(
    campaign_id: int,
    data: CampaignUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if data.name is not None:
        campaign.name = data.name
    if data.description is not None:
        campaign.description = data.description
    if data.status is not None:
        campaign.status = data.status
    if data.sender_email is not None:
        campaign.sender_email = data.sender_email
    if data.gmail_account_id is not None:
        campaign.gmail_account_id = data.gmail_account_id
    if data.target_industry is not None:
        campaign.target_industry = data.target_industry

    if data.sequence_steps is not None:
        # Re-sync sequence steps
        db.query(CampaignSequenceStep).filter(CampaignSequenceStep.campaign_id == campaign_id).delete()
        for step in data.sequence_steps:
            db_step = CampaignSequenceStep(
                campaign_id=campaign_id,
                step_number=step.step_number,
                delay_days=step.delay_days,
                channel=step.channel or "Email",
                subject_template=step.subject_template,
                body_template=step.body_template,
                notes=step.notes,
            )
            db.add(db_step)

    db.commit()
    db.refresh(campaign)
    return _enrich_campaign_out(campaign, db)


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db.delete(campaign)
    db.commit()
    return None


@router.post("/{campaign_id}/start")
def start_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.status = CampaignStatus.ACTIVE.value
    db.commit()
    return {"success": True, "status": campaign.status}


@router.post("/{campaign_id}/pause")
def pause_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.status = CampaignStatus.PAUSED.value
    db.commit()
    return {"success": True, "status": campaign.status}


@router.post("/{campaign_id}/contacts")
def add_contacts_to_campaign(
    campaign_id: int,
    data: CampaignContactAddRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    added = CampaignService.enroll_contacts(db, campaign_id, data.contact_ids, user=current_user)
    return {"success": True, "added_count": added}


@router.delete("/{campaign_id}/contacts/{contact_id}")
def remove_contact_from_campaign(
    campaign_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    cc = db.query(CampaignContact).filter(
        CampaignContact.campaign_id == campaign_id,
        CampaignContact.contact_id == contact_id
    ).first()
    if cc:
        db.delete(cc)
        db.commit()
    return {"success": True}


@router.post("/{campaign_id}/contacts/{contact_id}/preview", response_model=CampaignPreviewResponse)
def preview_campaign_email(
    campaign_id: int,
    contact_id: int,
    data: CampaignPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    step_num = data.step_number if (data and data.step_number) else 1
    step = (
        db.query(CampaignSequenceStep)
        .filter(
            CampaignSequenceStep.campaign_id == campaign_id,
            CampaignSequenceStep.step_number == step_num
        )
        .first()
    )
    subject_tmpl = data.subject_template or (step.subject_template if step else None)
    body_tmpl = data.body_template or (step.body_template if step else "")

    cc = db.query(CampaignContact).filter(
        CampaignContact.campaign_id == campaign_id,
        CampaignContact.contact_id == contact_id
    ).first()

    preview = CampaignCompiler.compile_step_email(
        db=db,
        contact_id=contact_id,
        subject_template=subject_tmpl,
        body_template=body_tmpl,
        step_number=data.step_number or 1,
        sender_user=current_user,
        cached_ai_values=cc.ai_cache if cc and not data.force_regenerate else None,
        force_regenerate=data.force_regenerate,
    )

    if cc:
        cc.ai_cache = preview.get("ai_generated_fields")
        cc.subject_preview = preview.get("subject")
        cc.body_preview = preview.get("body_html")
        cc.personalization_score = preview.get("personalization_score", 80.0)
        db.commit()

    return CampaignPreviewResponse(**preview)


@router.post("/{campaign_id}/contacts/{contact_id}/send")
def send_reviewed_email(
    campaign_id: int,
    contact_id: int,
    data: CampaignSendReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    result = CampaignService.send_step_email(
        db=db,
        campaign_id=campaign_id,
        contact_id=contact_id,
        user=current_user,
        subject=data.subject,
        body_html=data.body_html,
    )
    return result


@router.post("/{campaign_id}/contacts/{contact_id}/pause")
def pause_campaign_contact(
    campaign_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    cc = db.query(CampaignContact).filter(
        CampaignContact.campaign_id == campaign_id,
        CampaignContact.contact_id == contact_id
    ).first()
    if not cc:
        raise HTTPException(status_code=404, detail="Campaign contact not found")
    cc.status = CampaignContactStatus.PAUSED.value
    db.commit()
    return {"success": True, "status": cc.status}


@router.post("/{campaign_id}/contacts/{contact_id}/resume")
def resume_campaign_contact(
    campaign_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    cc = db.query(CampaignContact).filter(
        CampaignContact.campaign_id == campaign_id,
        CampaignContact.contact_id == contact_id
    ).first()
    if not cc:
        raise HTTPException(status_code=404, detail="Campaign contact not found")
    cc.status = CampaignContactStatus.PENDING.value
    db.commit()
    return {"success": True, "status": cc.status}


@router.post("/simulate-reply")
def simulate_reply(
    contact_id: int,
    reply_subject: str = "Re: Collaboration discussion",
    reply_snippet: str = "Thanks for reaching out. We would be interested in seeing a demonstration next week.",
    campaign_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    result = CampaignService.record_reply_and_pause(
        db=db,
        contact_id=contact_id,
        reply_subject=reply_subject,
        reply_snippet=reply_snippet,
        campaign_id=campaign_id,
        user_id=current_user.id,
    )
    return result


@router.get("/{campaign_id}/roi")
def get_campaign_roi_funnel_endpoint(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """
    Computes the complete commercial ROI funnel for a campaign:
    Leads -> Sent -> Opened -> Replied -> Meetings -> Opportunities -> Proposals -> Closed Deals -> Revenue.
    """
    try:
        return CampaignService.get_campaign_roi_funnel(db=db, campaign_id=campaign_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/contacts/{campaign_contact_id}/create-opportunity")
def create_opportunity_from_campaign_contact_endpoint(
    campaign_contact_id: int,
    estimated_value: Optional[float] = None,
    custom_name: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """
    1-Click confirmed conversion of a replied/engaged campaign contact into a commercial Opportunity.
    """
    try:
        return CampaignService.create_opportunity_from_campaign_contact(
            db=db,
            campaign_contact_id=campaign_contact_id,
            user=current_user,
            estimated_value=estimated_value,
            custom_name=custom_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ─────────────────────────────────────────────────────────────
# EMAIL APPROVAL GATE (Tier 0.4)
# ─────────────────────────────────────────────────────────────

@router.post("/contacts/{campaign_contact_id}/approve")
def approve_campaign_contact(
    campaign_contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Approve a draft campaign contact email for sending."""
    from datetime import datetime, timezone
    cc = db.query(CampaignContact).filter(CampaignContact.id == campaign_contact_id).first()
    if not cc:
        raise HTTPException(status_code=404, detail="Campaign contact not found")
    
    if cc.status not in [CampaignContactStatus.DRAFT.value, CampaignContactStatus.READY_FOR_REVIEW.value]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve contact in '{cc.status}' status. Must be Draft or Ready_For_Review."
        )
    
    now = datetime.now(timezone.utc)
    cc.status = CampaignContactStatus.APPROVED.value
    cc.approved_by = current_user.id
    cc.approved_at = now
    cc.updated_at = now
    db.commit()
    
    log_audit_event(
        db=db,
        action="campaign_email_approved",
        resource_type="campaign_contact",
        resource_id=cc.id,
        user=current_user,
        metadata={"campaign_id": cc.campaign_id, "contact_id": cc.contact_id},
    )
    
    return {"id": cc.id, "status": cc.status, "approved_at": now.isoformat()}


@router.post("/contacts/{campaign_contact_id}/reject")
def reject_campaign_contact(
    campaign_contact_id: int,
    reason: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Reject a draft campaign contact email."""
    from datetime import datetime, timezone
    cc = db.query(CampaignContact).filter(CampaignContact.id == campaign_contact_id).first()
    if not cc:
        raise HTTPException(status_code=404, detail="Campaign contact not found")
    
    if cc.status not in [CampaignContactStatus.DRAFT.value, CampaignContactStatus.READY_FOR_REVIEW.value]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject contact in '{cc.status}' status. Must be Draft or Ready_For_Review."
        )
    
    now = datetime.now(timezone.utc)
    cc.status = CampaignContactStatus.REJECTED.value
    cc.rejected_by = current_user.id
    cc.rejected_at = now
    cc.rejection_reason = reason[:500] if reason else None
    cc.updated_at = now
    db.commit()
    
    log_audit_event(
        db=db,
        action="campaign_email_rejected",
        resource_type="campaign_contact",
        resource_id=cc.id,
        user=current_user,
        metadata={"campaign_id": cc.campaign_id, "contact_id": cc.contact_id, "reason": reason[:100] if reason else None},
    )
    
    return {"id": cc.id, "status": cc.status}


@router.post("/batch-approve")
def batch_approve_campaign_contacts(
    campaign_contact_ids: List[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Batch approve multiple draft campaign contacts."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    approved = []
    errors = []
    
    for cc_id in campaign_contact_ids:
        cc = db.query(CampaignContact).filter(CampaignContact.id == cc_id).first()
        if not cc:
            errors.append({"id": cc_id, "error": "Not found"})
            continue
        if cc.status not in [CampaignContactStatus.DRAFT.value, CampaignContactStatus.READY_FOR_REVIEW.value]:
            errors.append({"id": cc_id, "error": f"Invalid status: {cc.status}"})
            continue
        
        cc.status = CampaignContactStatus.APPROVED.value
        cc.approved_by = current_user.id
        cc.approved_at = now
        cc.updated_at = now
        approved.append(cc_id)
    
    db.commit()
    return {"approved": approved, "errors": errors}


@router.get("/tracker/outreach")
def get_outreach_tracker(
    campaign_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Outreach Tracker: every campaign contact that's been sent at least one email,
    with its sent/opened/clicked/replied status and timestamps, plus aggregate counts.
    Backs the frontend Outreach Tracker dashboard.
    """
    sent_statuses = [
        CampaignContactStatus.SENT.value,
        CampaignContactStatus.REPLIED.value,
        CampaignContactStatus.COMPLETED.value,
    ]
    query = db.query(CampaignContact).filter(CampaignContact.status.in_(sent_statuses))
    if campaign_id:
        query = query.filter(CampaignContact.campaign_id == campaign_id)
    rows = query.order_by(desc(CampaignContact.last_action_at)).limit(500).all()

    items = []
    opened = clicked = replied = 0
    for cc in rows:
        contact = db.query(Contact).filter(Contact.id == cc.contact_id).first()
        org = db.query(Organization).filter(Organization.id == cc.organization_id).first()
        campaign = db.query(Campaign).filter(Campaign.id == cc.campaign_id).first()
        if cc.opened_at:
            opened += 1
        if cc.clicked_at:
            clicked += 1
        if cc.replied_at:
            replied += 1
        items.append({
            "campaign_contact_id": cc.id,
            "campaign_id": cc.campaign_id,
            "campaign_name": campaign.name if campaign else None,
            "contact_id": cc.contact_id,
            "contact_name": f"{contact.first_name} {contact.last_name or ''}".strip() if contact else None,
            "contact_email": contact.email if contact else None,
            "organization_id": cc.organization_id,
            "organization_name": org.name if org else None,
            "status": cc.status,
            "subject_preview": cc.subject_preview,
            "sent_at": cc.last_action_at,
            "opened_at": cc.opened_at,
            "open_count": cc.open_count,
            "clicked_at": cc.clicked_at,
            "click_count": cc.click_count,
            "replied_at": cc.replied_at,
        })

    total_sent = len(items)
    return {
        "items": items,
        "summary": {
            "total_sent": total_sent,
            "opened": opened,
            "clicked": clicked,
            "replied": replied,
            "open_rate": round(opened / total_sent * 100, 1) if total_sent else 0.0,
            "click_rate": round(clicked / total_sent * 100, 1) if total_sent else 0.0,
            "reply_rate": round(replied / total_sent * 100, 1) if total_sent else 0.0,
        },
    }


@router.get("/pending-reviews")
def list_pending_reviews(
    campaign_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """List all campaign contacts pending review (Draft or Ready_For_Review)."""
    query = db.query(CampaignContact).filter(
        CampaignContact.status.in_([
            CampaignContactStatus.DRAFT.value,
            CampaignContactStatus.READY_FOR_REVIEW.value,
        ])
    )
    if campaign_id:
        query = query.filter(CampaignContact.campaign_id == campaign_id)
    
    pending = query.order_by(CampaignContact.created_at.desc()).all()
    
    results = []
    for cc in pending:
        contact = db.query(Contact).filter(Contact.id == cc.contact_id).first()
        campaign = db.query(Campaign).filter(Campaign.id == cc.campaign_id).first()
        results.append({
            "id": cc.id,
            "campaign_id": cc.campaign_id,
            "campaign_name": campaign.name if campaign else None,
            "contact_id": cc.contact_id,
            "contact_name": contact.full_name if contact else None,
            "contact_email": contact.email if contact else None,
            "organization_id": cc.organization_id,
            "subject_preview": cc.subject_preview,
            "body_preview": cc.body_preview,
            "personalization_score": cc.personalization_score,
            "status": cc.status,
            "created_at": cc.created_at.isoformat() if cc.created_at else None,
        })
    
    return results
