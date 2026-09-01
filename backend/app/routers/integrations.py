from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.auth.deps import get_current_user
from app.models.user import User
from app.models.organization import Organization, ConnectionStatus, PriorityLevel, OrganizationType
from app.models.contact import Contact
from app.core.audit import log_audit_event
from app.schemas.integrations import (
    ExternalLeadIngestRequest,
    ExternalLeadIngestResponse,
    IntegrationStatus,
)

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
    # Check if organization already exists by name (prevent duplicates)
    org = (
        db.query(Organization)
        .filter(Organization.name.ilike(payload.organization_name.strip()), Organization.is_deleted == False)
        .first()
    )

    is_new_org = False
    if not org:
        is_new_org = True
        org = Organization(
            name=payload.organization_name.strip(),
            organization_type=payload.organization_type or OrganizationType.HOSPITAL.value,
            city=payload.city,
            state=payload.state,
            website=payload.website,
            status=ConnectionStatus.NEW.value,
            priority=PriorityLevel.HIGH.value if (payload.lead_score or 50) >= 80 else PriorityLevel.MEDIUM.value,
            notes=f"Source: {payload.source_system}. Campaign/Event: {payload.campaign_name or payload.event_name or 'N/A'}. Score: {payload.lead_score}. Notes: {payload.notes or ''}",
            created_by=current_user.id,
        )
        db.add(org)
        db.flush()

    contact_id = None
    if payload.contact_name:
        parts = payload.contact_name.strip().split(maxsplit=1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""

        # Check existing contact
        c = (
            db.query(Contact)
            .filter(
                Contact.organization_id == org.id,
                Contact.first_name.ilike(first_name),
                Contact.is_deleted == False
            )
            .first()
        )
        if not c:
            c = Contact(
                organization_id=org.id,
                first_name=first_name,
                last_name=last_name,
                designation=payload.contact_role or "Lead Contact",
                email=payload.contact_email,
                phone=payload.contact_phone,
                is_decision_maker=True if any(t in (payload.contact_role or "").lower() for t in ["ceo", "cto", "cio", "director", "head"]) else False,
                created_by=current_user.id,
            )
            db.add(c)
            db.flush()
        contact_id = c.id

    log_audit_event(
        db,
        action=f"INGEST_LEAD_{payload.source_system.upper()}",
        resource_type="ORGANIZATION",
        resource_id=org.id,
        user=current_user,
        metadata={"source": payload.source_system, "organization_name": org.name, "is_new": is_new_org},
    )
    db.commit()
    db.refresh(org)

    return ExternalLeadIngestResponse(
        success=True,
        message=f"Successfully ingested lead from {payload.source_system} into ELLY CRM.",
        organization_id=org.id,
        contact_id=contact_id,
        is_new_organization=is_new_org,
        source_system=payload.source_system,
    )
