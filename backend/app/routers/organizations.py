from datetime import datetime, timezone
import math
import threading
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, case

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.user import User
from app.models.organization import (
    Organization,
    OrganizationType,
    ConnectionStatus,
    PriorityLevel,
)
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationStatusUpdate,
    OrganizationPriorityUpdate,
    OrganizationNoteAdd,
    OrganizationOut,
    OrganizationDetailOut,
    PaginatedOrganizationsOut,
    DuplicateCheckResponse,
)

router = APIRouter(prefix="/api/business-development/organizations", tags=["Organizations"])


@router.get("", response_model=PaginatedOrganizationsOut)
def list_organizations(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term for name, city, state, type, industry"),
    organization_type: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by pipeline stage"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    city: Optional[str] = Query(None, description="Filter by city"),
    state: Optional[str] = Query(None, description="Filter by state"),
    owner_scope: str = Query("mine", description="Scope: 'mine' (owner_id=current user), 'all' (admin/manager view)"),
    sort_by: str = Query("created_at", description="Field to sort by: name, created_at, updated_at, priority, status"),
    sort_order: str = Query("desc", description="Sort direction: asc or desc"),
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Retrieve paginated list of organizations with search, filtering, and sorting."""
    query = db.query(Organization).filter(Organization.is_deleted.is_(False))

    # Ownership scoping
    if owner_scope == "mine" and current_user.role != "ADMIN":
        query = query.filter(Organization.owner_id == current_user.id)

    # Apply search
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Organization.name).like(term),
                func.lower(Organization.city).like(term),
                func.lower(Organization.state).like(term),
                func.lower(Organization.organization_type).like(term),
                func.lower(Organization.industry).like(term),
            )
        )

    # Apply filters
    if organization_type and organization_type.strip():
        query = query.filter(Organization.organization_type == organization_type.strip())
    if status and status.strip():
        query = query.filter(Organization.status == status.strip())
    if priority and priority.strip():
        query = query.filter(Organization.priority == priority.strip())
    if city and city.strip():
        query = query.filter(func.lower(Organization.city) == city.strip().lower())
    if state and state.strip():
        query = query.filter(func.lower(Organization.state) == state.strip().lower())

    total = query.count()

    # Apply sorting
    sort_col = getattr(Organization, sort_by, Organization.created_at)
    if sort_by == "priority":
        # Custom priority order: High (1) -> Medium (2) -> Low (3)
        priority_order = case(
            (Organization.priority == "High", 1),
            (Organization.priority == "Medium", 2),
            (Organization.priority == "Low", 3),
            else_=4,
        )
        query = query.order_by(priority_order.asc() if sort_order == "asc" else priority_order.desc())
    elif sort_order.lower() == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedOrganizationsOut(
        items=[OrganizationOut.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/check-duplicate", response_model=DuplicateCheckResponse)
def check_duplicate_organization(
    name: str = Query(..., min_length=1, description="Organization name to check"),
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Check if an organization with an identical or similar name already exists."""
    clean_name = name.strip().lower()
    existing = (
        db.query(Organization)
        .filter(
            Organization.is_deleted.is_(False),
            func.lower(Organization.name) == clean_name,
        )
        .first()
    )

    if existing:
        return DuplicateCheckResponse(
            is_duplicate=True,
            existing_id=existing.id,
            existing_name=existing.name,
            message=f"An organization named '{existing.name}' already exists in the database.",
        )
    return DuplicateCheckResponse(
        is_duplicate=False,
        message="No duplicate organization found.",
    )


@router.post("", response_model=OrganizationDetailOut, status_code=status.HTTP_201_CREATED)
def create_organization(
    payload: OrganizationCreate,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Create a new organization with duplicate checking and validation."""
    clean_name = payload.name.strip()

    # Check for duplicate
    existing = (
        db.query(Organization)
        .filter(
            Organization.is_deleted.is_(False),
            func.lower(Organization.name) == clean_name.lower(),
        )
        .first()
    )

    if existing and not payload.allow_duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An organization with the name '{existing.name}' already exists (ID: {existing.id}). Set allow_duplicate=true to create anyway.",
        )

    now = datetime.now(timezone.utc)
    new_org = Organization(
        name=clean_name,
        organization_type=payload.organization_type.strip(),
        description=payload.description.strip() if payload.description else None,
        website=payload.website.strip() if payload.website else None,
        email=payload.email.strip().lower() if payload.email else None,
        phone=payload.phone.strip() if payload.phone else None,
        country=payload.country.strip() if payload.country else "Unknown",
        state=payload.state.strip() if payload.state else None,
        city=payload.city.strip() if payload.city else None,
        address=payload.address.strip() if payload.address else None,
        industry=payload.industry.strip() if payload.industry else "Unknown",
        size=payload.size.strip() if payload.size else "200-1000",
        status=payload.status.strip() if payload.status else ConnectionStatus.POTENTIAL.value,
        priority=payload.priority.strip() if payload.priority else PriorityLevel.MEDIUM.value,
        notes=payload.notes.strip() if payload.notes else None,
        is_deleted=False,
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )

    db.add(new_org)
    db.commit()
    db.refresh(new_org)

    # Auto-geocode in background thread (non-blocking)
    try:
        def _geocode_sync():
            import asyncio
            from app.services import nominatim_service
            from app.core.database import SessionLocal
            db_bg = SessionLocal()
            try:
                org_bg = db_bg.query(Organization).filter(Organization.id == new_org.id).first()
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

    log_audit_event(
        db=db,
        action="ORGANIZATION_CREATED",
        resource_type="Organization",
        resource_id=new_org.id,
        user=current_user,
        metadata={"name": new_org.name, "status": new_org.status, "priority": new_org.priority},
    )

    try:
        from app.services.google_sheets_service import sync_organization
        sync_organization(new_org)
    except Exception:
        pass

    return OrganizationDetailOut.model_validate(new_org)


@router.get("/{id}", response_model=OrganizationDetailOut)
def get_organization(
    id: int,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Retrieve full organization profile details."""
    org = db.query(Organization).filter(Organization.id == id, Organization.is_deleted.is_(False)).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with ID {id} not found.",
        )
    return OrganizationDetailOut.model_validate(org)


@router.put("/{id}", response_model=OrganizationDetailOut)
def update_organization(
    id: int,
    payload: OrganizationUpdate,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Update organization profile information."""
    org = db.query(Organization).filter(Organization.id == id, Organization.is_deleted.is_(False)).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with ID {id} not found.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None and isinstance(value, str):
            setattr(org, field, value.strip())
        else:
            setattr(org, field, value)

    org.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(org)

    log_audit_event(
        db=db,
        action="ORGANIZATION_UPDATED",
        resource_type="Organization",
        resource_id=org.id,
        user=current_user,
        metadata={"updated_fields": list(update_data.keys())},
    )

    return OrganizationDetailOut.model_validate(org)


@router.patch("/{id}/status", response_model=OrganizationDetailOut)
def update_organization_status(
    id: int,
    payload: OrganizationStatusUpdate,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Quickly update organization connection pipeline status and optionally append a transition note."""
    org = db.query(Organization).filter(Organization.id == id, Organization.is_deleted.is_(False)).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with ID {id} not found.",
        )

    old_status = org.status
    org.status = payload.status.strip()

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    transition_note = f"[{now_str}] Status changed: {old_status} -> {org.status} by {current_user.name}"
    if payload.note and payload.note.strip():
        transition_note += f": {payload.note.strip()}"

    if org.notes:
        org.notes = f"{org.notes}\n\n{transition_note}"
    else:
        org.notes = transition_note

    org.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(org)
    return OrganizationDetailOut.model_validate(org)


@router.patch("/{id}/priority", response_model=OrganizationDetailOut)
def update_organization_priority(
    id: int,
    payload: OrganizationPriorityUpdate,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Quickly adjust internal BD priority (High, Medium, Low)."""
    org = db.query(Organization).filter(Organization.id == id, Organization.is_deleted.is_(False)).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with ID {id} not found.",
        )

    org.priority = payload.priority.strip()
    org.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(org)
    return OrganizationDetailOut.model_validate(org)


@router.post("/{id}/notes", response_model=OrganizationDetailOut)
def add_organization_note(
    id: int,
    payload: OrganizationNoteAdd,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Append a timestamped internal BD note to the organization."""
    org = db.query(Organization).filter(Organization.id == id, Organization.is_deleted.is_(False)).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with ID {id} not found.",
        )

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    new_note_entry = f"[{now_str} - {current_user.name}]\n{payload.note.strip()}"

    if org.notes:
        org.notes = f"{org.notes}\n\n{new_note_entry}"
    else:
        org.notes = new_note_entry

    org.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(org)
    return OrganizationDetailOut.model_validate(org)


@router.delete("/{id}")
def delete_organization(
    id: int,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Soft delete an organization."""
    org = db.query(Organization).filter(Organization.id == id, Organization.is_deleted.is_(False)).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with ID {id} not found.",
        )

    org.is_deleted = True
    org.updated_at = datetime.now(timezone.utc)
    db.commit()

    log_audit_event(
        db=db,
        action="ORGANIZATION_DELETED",
        resource_type="Organization",
        resource_id=org.id,
        user=current_user,
        metadata={"name": org.name},
    )

    return {"status": "success", "message": f"Organization '{org.name}' successfully deleted."}
