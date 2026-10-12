"""
Shared external-lead ingestion logic, used by both the authenticated
POST /integrations/ingest endpoint and the inbound webhook receiver
(POST /integrations/webhooks/{source}). Kept here so both call sites stay
in sync rather than duplicating the organization/contact dedupe logic.
"""
from __future__ import annotations

from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.core.audit import log_audit_event
from app.models.contact import Contact
from app.models.organization import Organization, ConnectionStatus, PriorityLevel, OrganizationType
from app.models.user import User
from app.schemas.integrations import ExternalLeadIngestRequest


def ingest_external_lead(
    db: Session,
    payload: ExternalLeadIngestRequest,
    user: Optional[User] = None,
) -> Tuple[Organization, Optional[int], bool]:
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
            created_by=user.id if user else None,
        )
        db.add(org)
        db.flush()

    contact_id = None
    if payload.contact_name:
        parts = payload.contact_name.strip().split(maxsplit=1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""

        c = (
            db.query(Contact)
            .filter(
                Contact.organization_id == org.id,
                Contact.first_name.ilike(first_name),
                Contact.is_deleted == False,
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
                created_by=user.id if user else None,
            )
            db.add(c)
            db.flush()
        contact_id = c.id

    log_audit_event(
        db,
        action=f"INGEST_LEAD_{payload.source_system.upper()}",
        resource_type="ORGANIZATION",
        resource_id=org.id,
        user=user,
        metadata={"source": payload.source_system, "organization_name": org.name, "is_new": is_new_org},
    )
    db.commit()
    db.refresh(org)

    return org, contact_id, is_new_org
