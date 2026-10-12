from typing import Optional, Tuple, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.models.organization import Organization, ConnectionStatus, PriorityLevel, OrganizationType
from app.models.contact import Contact, ContactRelationshipStatus
from app.models.activity import ContactActivity
from app.models.discovery import DiscoveredOrganization, DiscoveredContact, DiscoveryStatus
from app.core.audit import log_audit_event


def check_organization_duplicate(
    db: Session,
    name: str,
    website: Optional[str] = None,
    city: Optional[str] = None,
) -> Tuple[bool, Optional[int], Optional[str]]:
    """
    Checks for existing organizations by normalized name, domain, or close identifier.
    Returns (is_duplicate, existing_id, existing_name).
    """
    clean_name = name.strip().lower()
    existing = db.query(Organization).filter(
        Organization.is_deleted.is_(False),
        func.lower(Organization.name) == clean_name,
    ).first()
    if existing:
        return True, existing.id, existing.name

    # Check website domain match
    if website and website.strip():
        clean_site = (
            website.strip()
            .lower()
            .replace("https://", "")
            .replace("http://", "")
            .split("/")[0]
            .replace("www.", "")
        )
        if len(clean_site) > 3:
            existing_site = db.query(Organization).filter(
                Organization.is_deleted.is_(False),
                Organization.website.ilike(f"%{clean_site}%"),
            ).first()
            if existing_site:
                return True, existing_site.id, existing_site.name

    return False, None, None


def check_contact_duplicate(
    db: Session,
    email: Optional[str] = None,
    full_name: Optional[str] = None,
    organization_id: Optional[int] = None,
) -> Tuple[bool, Optional[int], Optional[str]]:
    """
    Checks for existing contacts by email or (name + organization_id).
    Returns (is_duplicate, existing_id, existing_name).
    """
    if email and email.strip():
        clean_email = email.strip().lower()
        existing_email = db.query(Contact).filter(
            Contact.is_deleted.is_(False),
            func.lower(Contact.email) == clean_email,
        ).first()
        if existing_email:
            return True, existing_email.id, f"{existing_email.first_name} {existing_email.last_name or ''}".strip()

    if full_name and organization_id:
        clean_name = full_name.strip().lower()
        parts = clean_name.split(maxsplit=1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""

        existing_contact = db.query(Contact).filter(
            Contact.is_deleted.is_(False),
            Contact.organization_id == organization_id,
            func.lower(Contact.first_name) == first_name,
        ).first()
        if existing_contact:
            return True, existing_contact.id, f"{existing_contact.first_name} {existing_contact.last_name or ''}".strip()

    return False, None, None


def convert_discovered_org_to_crm(
    db: Session,
    discovered_org: DiscoveredOrganization,
    selected_contact_ids: Optional[List[int]] = None,
    user_id: Optional[int] = None,
    initial_priority: str = "Medium",
    internal_notes: Optional[str] = None,
) -> Tuple[Organization, List[Contact]]:
    """
    Converts a DiscoveredOrganization and its selected DiscoveredContacts into
    official ELLY CRM Organization and Contact records in one transaction.
    """
    # 1. Create or link Organization
    if discovered_org.organization_id:
        org = db.query(Organization).filter(Organization.id == discovered_org.organization_id).first()
    else:
        # Map organization type safely
        org_type_val = discovered_org.organization_type
        if org_type_val not in [e.value for e in OrganizationType]:
            org_type_val = "Technology Company"  # Universal default

        priority_val = initial_priority
        if discovered_org.potential_fit == "High":
            priority_val = PriorityLevel.HIGH.value
        elif discovered_org.potential_fit == "Low":
            priority_val = PriorityLevel.LOW.value

        org = Organization(
            name=discovered_org.name,
            organization_type=org_type_val,
            country=discovered_org.country or "Unknown",
            state=discovered_org.state,
            city=discovered_org.city,
            address=discovered_org.address,
            website=discovered_org.website,
            phone=discovered_org.phone,
            email=discovered_org.email,
            description=discovered_org.description,
            status=ConnectionStatus.POTENTIAL.value,
            priority=priority_val,
            notes=internal_notes or (
                f"Sourced via AI B2B Discovery ({discovered_org.source_name}). "
                f"Fit Reason: {discovered_org.qualification_reason or 'Qualified lead'}"
            ),
            owner_id=user_id,
        )
        db.add(org)
        db.flush()

        discovered_org.organization_id = org.id
        discovered_org.status = DiscoveryStatus.ADDED.value

        # Auto-geocode discovered organization in background thread
        try:
            import threading
            def _geocode_sync():
                import asyncio
                from app.services import nominatim_service
                from app.core.database import SessionLocal
                db_bg = SessionLocal()
                try:
                    org_bg = db_bg.query(Organization).filter(Organization.id == org.id).first()
                    if org_bg:
                        addr_parts = [p for p in [org_bg.address, org_bg.city, org_bg.state, org_bg.country] if p]
                        geocode_addr = ', '.join(addr_parts) if addr_parts else org_bg.name
                        loop = asyncio.new_event_loop()
                        result = loop.run_until_complete(nominatim_service.geocode(geocode_addr))
                        loop.close()
                        if result:
                            org_bg.latitude = result['latitude']
                            org_bg.longitude = result['longitude']
                            db_bg.commit()
                except Exception:
                    pass
                finally:
                    db_bg.close()
            threading.Thread(target=_geocode_sync, daemon=True).start()
        except Exception:
            pass

    # 2. Convert DiscoveredContacts if selected
    created_contacts: List[Contact] = []
    contacts_to_convert = []

    if selected_contact_ids:
        contacts_to_convert = [c for c in discovered_org.contacts if c.id in selected_contact_ids]
    else:
        contacts_to_convert = discovered_org.contacts

    for idx, d_contact in enumerate(contacts_to_convert):
        # Check duplicate before creating
        is_dup, existing_c_id, _ = check_contact_duplicate(
            db, email=d_contact.email, full_name=d_contact.full_name, organization_id=org.id
        )
        if is_dup and existing_c_id:
            d_contact.matched_existing_contact_id = existing_c_id
            d_contact.status = DiscoveryStatus.ADDED.value
            continue

        parts = d_contact.full_name.strip().split(maxsplit=1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""

        c = Contact(
            organization_id=org.id,
            first_name=first_name,
            last_name=last_name,
            designation=d_contact.job_title,
            department=d_contact.department or "Executive Management",
            email=d_contact.email,
            phone=d_contact.phone,
            linkedin_url=d_contact.linkedin_url,
            is_decision_maker=True,
            is_primary_contact=(idx == 0 and not org.contacts),
            connection_status=ContactRelationshipStatus.NOT_CONTACTED.value,
            notes=f"Discovered executive lead. Fit: {d_contact.fit_level}. {d_contact.fit_reason or ''}",
        )
        db.add(c)
        db.flush()

        d_contact.matched_existing_contact_id = c.id
        d_contact.status = DiscoveryStatus.ADDED.value
        created_contacts.append(c)

        # Log contact creation activity
        act = ContactActivity(
            contact_id=c.id,
            organization_id=org.id,
            activity_type="discovery_import",
            description=f"Contact added to CRM from B2B Discovery: {c.first_name} {c.last_name} ({c.designation})",
        )
        db.add(act)

    db.commit()
    db.refresh(org)

    try:
        from app.services.google_sheets_service import sync_organization, sync_contact
        sync_organization(org)
        for c in created_contacts:
            sync_contact(c)
    except Exception:
        pass

    return org, created_contacts
