import json
import math
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, func

from app.auth.deps import require_admin
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.organization import Organization, OrganizationType, ConnectionStatus, PriorityLevel
from app.models.contact import Contact
from app.models.opportunity import Opportunity, OpportunityStage
from app.models.partnership import Partnership, PartnershipType, PartnershipStatus, PartnershipPriority
from app.models.project import Project, ProjectCategory, ProjectStatus
from app.models.meeting import Meeting, MeetingType
from app.models.followup import FollowUp
from app.models.audit import AuditLog
from app.models.setting import SystemSetting
from app.schemas.admin import (
    AdminUserOut,
    AdminUserCreate,
    AdminUserUpdate,
    AdminUserStatusUpdate,
    AdminUserRoleUpdate,
    AdminUserActivitySummary,
    AdminUserDetailOut,
    PaginatedAdminUsersOut,
    AdminTeamMemberOut,
    AdminTeamListOut,
    AdminDashboardStatsOut,
    AdminBulkAssignmentPayload,
    AdminAssignmentResult,
    AdminProjectCreate,
    AdminProjectUpdate,
    AdminProjectStatusUpdate,
    SystemSettingsOut,
    SystemSettingsUpdate,
)
from app.schemas.audit import PaginatedAuditLogsOut, AuditLogOut
from app.schemas.project import ProjectOut, PaginatedProjectsOut

router = APIRouter(
    prefix="/api/admin",
    tags=["Administration & Team Management"],
    dependencies=[Depends(require_admin)],
)


# ── Helpers ──

def _check_last_admin_protection(db: Session, target_user_id: int) -> None:
    """Ensure that modifying or deactivating target_user does not leave 0 active administrators."""
    active_admins_count = (
        db.query(User)
        .filter(User.role == UserRole.ADMIN.value, User.is_active.is_(True))
        .count()
    )
    target_user = db.query(User).filter(User.id == target_user_id).first()
    if target_user and target_user.role == UserRole.ADMIN.value and target_user.is_active:
        if active_admins_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one active administrator is required.",
            )


def _validate_project_urls(data: Dict[str, Any]) -> None:
    """Ensure project URLs do not expose secrets, credentials, or private keys."""
    sensitive_patterns = [
        re.compile(r"api_key=", re.I),
        re.compile(r"bearer\s+[a-z0-9\-_]+", re.I),
        re.compile(r":\/\/[^:]+:[^@]+@", re.I),  # http://user:password@host
        re.compile(r"token=[a-z0-9\-_]+", re.I),
        re.compile(r"secret=", re.I),
    ]
    url_fields = ["demo_url", "website_url", "repository_url", "presentation_url", "thumbnail_url", "video_url"]
    for field in url_fields:
        val = data.get(field)
        if val and isinstance(val, str):
            for pat in sensitive_patterns:
                if pat.search(val):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Project URL field '{field}' contains sensitive credentials or secret tokens.",
                    )


# ── 1. Admin Dashboard ──

@router.get("/dashboard", response_model=AdminDashboardStatsOut)
def get_admin_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    total_users = db.query(User).count()
    active_bd_users = (
        db.query(User)
        .filter(
            User.is_active.is_(True),
            User.role.in_([UserRole.BUSINESS_DEVELOPMENT.value, UserRole.ADMIN.value]),
        )
        .count()
    )
    active_orgs = db.query(Organization).filter(Organization.is_deleted.is_(False)).count()
    active_opps = (
        db.query(Opportunity)
        .filter(
            Opportunity.is_deleted.is_(False),
            Opportunity.stage != OpportunityStage.PARTNERSHIP.value,
        )
        .count()
    )
    active_partnerships = (
        db.query(Partnership)
        .filter(
            Partnership.is_deleted.is_(False),
            Partnership.status == PartnershipStatus.ACTIVE.value,
        )
        .count()
    )

    recent_logs = (
        db.query(AuditLog)
        .order_by(desc(AuditLog.timestamp))
        .limit(10)
        .all()
    )
    recent_activity = [
        {
            "id": log.id,
            "action": log.action,
            "user_email": log.user_email,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        }
        for log in recent_logs
    ]

    return AdminDashboardStatsOut(
        total_users=total_users,
        active_bd_users=active_bd_users,
        active_organizations=active_orgs,
        active_opportunities=active_opps,
        active_partnerships=active_partnerships,
        recent_system_activity=recent_activity,
    )


# ── 2. User Management ──

@router.get("/users", response_model=PaginatedAdminUsersOut)
def list_admin_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = db.query(User)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(User.name.ilike(term), User.email.ilike(term)))
    if role and role.strip() and role != "All":
        query = query.filter(User.role == role.strip().upper())
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    total = query.count()
    total_pages = max(1, math.ceil(total / page_size))
    items = (
        query.order_by(desc(User.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedAdminUsersOut(
        items=[AdminUserOut.model_validate(u) for u in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_admin_user(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    existing = db.query(User).filter(User.email.ilike(payload.email.strip())).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email '{payload.email}' already exists.",
        )

    new_user = User(
        name=payload.name.strip(),
        email=payload.email.strip().lower(),
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        is_active=payload.is_active,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Log creation in audit log
    audit = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="CREATE_USER",
        resource_type="USER",
        resource_id=new_user.id,
        metadata_json=json.dumps({"name": new_user.name, "email": new_user.email, "role": new_user.role}),
    )
    db.add(audit)
    db.commit()

    return AdminUserOut.model_validate(new_user)


@router.get("/users/{user_id}", response_model=AdminUserDetailOut)
def get_admin_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Activity counters
    orgs_count = db.query(Organization).filter(Organization.owner_id == user.id, Organization.is_deleted.is_(False)).count()
    contacts_count = db.query(Contact).filter(Contact.created_by == user.id, Contact.is_deleted.is_(False)).count()
    meetings_count = db.query(Meeting).filter(Meeting.organizer_id == user.id, Meeting.is_deleted.is_(False)).count()
    opps_count = db.query(Opportunity).filter(Opportunity.owner_id == user.id, Opportunity.is_deleted.is_(False)).count()
    parts_count = db.query(Partnership).filter(Partnership.owner_id == user.id, Partnership.is_deleted.is_(False)).count()

    # Owned items
    owned_orgs = [
        {"id": o.id, "name": o.name, "organization_type": o.organization_type, "status": o.status}
        for o in db.query(Organization).filter(Organization.owner_id == user.id, Organization.is_deleted.is_(False)).limit(10).all()
    ]
    owned_opps = [
        {"id": o.id, "name": o.name, "stage": o.stage, "priority": o.priority}
        for o in db.query(Opportunity).filter(Opportunity.owner_id == user.id, Opportunity.is_deleted.is_(False)).limit(10).all()
    ]
    owned_parts = [
        {"id": p.id, "name": p.name, "partnership_type": p.partnership_type, "status": p.status}
        for p in db.query(Partnership).filter(Partnership.owner_id == user.id, Partnership.is_deleted.is_(False)).limit(10).all()
    ]

    recent_actions = [
        {
            "id": a.id,
            "action": a.action,
            "resource_type": a.resource_type,
            "resource_id": a.resource_id,
            "timestamp": a.timestamp.isoformat() if a.timestamp else None,
        }
        for a in db.query(AuditLog).filter(AuditLog.user_id == user.id).order_by(desc(AuditLog.timestamp)).limit(10).all()
    ]

    return AdminUserDetailOut(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
        activity=AdminUserActivitySummary(
            organizations_count=orgs_count,
            contacts_count=contacts_count,
            meetings_count=meetings_count,
            opportunities_count=opps_count,
            partnerships_count=parts_count,
        ),
        recent_actions=recent_actions,
        owned_organizations=owned_orgs,
        owned_opportunities=owned_opps,
        owned_partnerships=owned_parts,
    )


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_admin_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Last admin protection checks
    if payload.is_active is False and user.is_active:
        _check_last_admin_protection(db, user_id)
    if payload.role and payload.role != UserRole.ADMIN.value and user.role == UserRole.ADMIN.value:
        _check_last_admin_protection(db, user_id)

    if payload.name is not None:
        user.name = payload.name.strip()
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.password is not None:
        user.password_hash = get_password_hash(payload.password)

    db.commit()
    db.refresh(user)

    audit = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="UPDATE_USER",
        resource_type="USER",
        resource_id=user.id,
        metadata_json=json.dumps({"updated_fields": list(payload.model_dump(exclude_unset=True).keys())}),
    )
    db.add(audit)
    db.commit()

    return AdminUserOut.model_validate(user)


@router.patch("/users/{user_id}/status", response_model=AdminUserOut)
def update_admin_user_status(
    user_id: int,
    payload: AdminUserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if payload.is_active is False and user.is_active:
        _check_last_admin_protection(db, user_id)

    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)

    audit = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="CHANGE_USER_STATUS",
        resource_type="USER",
        resource_id=user.id,
        metadata_json=json.dumps({"is_active": user.is_active}),
    )
    db.add(audit)
    db.commit()

    return AdminUserOut.model_validate(user)


@router.patch("/users/{user_id}/role", response_model=AdminUserOut)
def update_admin_user_role(
    user_id: int,
    payload: AdminUserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if payload.role != UserRole.ADMIN.value and user.role == UserRole.ADMIN.value:
        _check_last_admin_protection(db, user_id)

    user.role = payload.role
    db.commit()
    db.refresh(user)

    audit = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="CHANGE_USER_ROLE",
        resource_type="USER",
        resource_id=user.id,
        metadata_json=json.dumps({"role": user.role}),
    )
    db.add(audit)
    db.commit()

    return AdminUserOut.model_validate(user)


# ── 3. BD Team View ──

@router.get("/team", response_model=AdminTeamListOut)
def get_bd_team(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    team_users = (
        db.query(User)
        .filter(User.role.in_([UserRole.BUSINESS_DEVELOPMENT.value, UserRole.ADMIN.value]))
        .order_by(User.name.asc())
        .all()
    )

    items: List[AdminTeamMemberOut] = []
    for u in team_users:
        orgs_cnt = db.query(Organization).filter(Organization.owner_id == u.id, Organization.is_deleted.is_(False)).count()
        opps_cnt = db.query(Opportunity).filter(Opportunity.owner_id == u.id, Opportunity.is_deleted.is_(False)).count()
        parts_cnt = db.query(Partnership).filter(Partnership.owner_id == u.id, Partnership.is_deleted.is_(False)).count()

        latest_audit = (
            db.query(AuditLog.timestamp)
            .filter(AuditLog.user_id == u.id)
            .order_by(desc(AuditLog.timestamp))
            .first()
        )

        items.append(
            AdminTeamMemberOut(
                id=u.id,
                name=u.name,
                email=u.email,
                role=u.role,
                is_active=u.is_active,
                organizations_count=orgs_cnt,
                opportunities_count=opps_cnt,
                partnerships_count=parts_cnt,
                last_activity_date=latest_audit[0] if latest_audit else None,
            )
        )

    return AdminTeamListOut(items=items, total=len(items))


# ── 4. Ownership Assignment ──

@router.patch("/organizations/{org_id}/owner")
def assign_organization_owner(
    org_id: int,
    payload: Dict[str, Optional[int]],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    owner_id = payload.get("owner_id")
    org = db.query(Organization).filter(Organization.id == org_id, Organization.is_deleted.is_(False)).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")

    if owner_id is not None:
        target_owner = db.query(User).filter(User.id == owner_id, User.is_active.is_(True)).first()
        if not target_owner or target_owner.role not in [UserRole.BUSINESS_DEVELOPMENT.value, UserRole.ADMIN.value]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected owner must be an active BD or Admin user.")

    org.owner_id = owner_id
    db.commit()

    audit = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="ASSIGN_ORGANIZATION_OWNER",
        resource_type="ORGANIZATION",
        resource_id=org.id,
        metadata_json=json.dumps({"organization_name": org.name, "new_owner_id": owner_id}),
    )
    db.add(audit)
    db.commit()

    return {"message": "Organization owner updated successfully.", "organization_id": org.id, "owner_id": org.owner_id}


@router.patch("/opportunities/{opp_id}/owner")
def assign_opportunity_owner(
    opp_id: int,
    payload: Dict[str, Optional[int]],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    owner_id = payload.get("owner_id")
    opp = db.query(Opportunity).filter(Opportunity.id == opp_id, Opportunity.is_deleted.is_(False)).first()
    if not opp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found.")

    if owner_id is not None:
        target_owner = db.query(User).filter(User.id == owner_id, User.is_active.is_(True)).first()
        if not target_owner or target_owner.role not in [UserRole.BUSINESS_DEVELOPMENT.value, UserRole.ADMIN.value]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected owner must be an active BD or Admin user.")

    opp.owner_id = owner_id
    db.commit()

    audit = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="ASSIGN_OPPORTUNITY_OWNER",
        resource_type="OPPORTUNITY",
        resource_id=opp.id,
        metadata_json=json.dumps({"opportunity_name": opp.name, "new_owner_id": owner_id}),
    )
    db.add(audit)
    db.commit()

    return {"message": "Opportunity owner updated successfully.", "opportunity_id": opp.id, "owner_id": opp.owner_id}


@router.patch("/partnerships/{partnership_id}/owner")
def assign_partnership_owner(
    partnership_id: int,
    payload: Dict[str, Optional[int]],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    owner_id = payload.get("owner_id")
    p = db.query(Partnership).filter(Partnership.id == partnership_id, Partnership.is_deleted.is_(False)).first()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partnership not found.")

    if owner_id is not None:
        target_owner = db.query(User).filter(User.id == owner_id, User.is_active.is_(True)).first()
        if not target_owner or target_owner.role not in [UserRole.BUSINESS_DEVELOPMENT.value, UserRole.ADMIN.value]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected owner must be an active BD or Admin user.")

    p.owner_id = owner_id
    db.commit()

    audit = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="ASSIGN_PARTNERSHIP_OWNER",
        resource_type="PARTNERSHIP",
        resource_id=p.id,
        metadata_json=json.dumps({"partnership_name": p.name, "new_owner_id": owner_id}),
    )
    db.add(audit)
    db.commit()

    return {"message": "Partnership owner updated successfully.", "partnership_id": p.id, "owner_id": p.owner_id}


@router.post("/assignments/bulk", response_model=AdminAssignmentResult)
def bulk_assign_ownership(
    payload: AdminBulkAssignmentPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if payload.owner_id is not None:
        target_owner = db.query(User).filter(User.id == payload.owner_id, User.is_active.is_(True)).first()
        if not target_owner or target_owner.role not in [UserRole.BUSINESS_DEVELOPMENT.value, UserRole.ADMIN.value]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected owner must be an active BD or Admin user.")

    updated_orgs = 0
    if payload.organization_ids:
        updated_orgs = (
            db.query(Organization)
            .filter(Organization.id.in_(payload.organization_ids), Organization.is_deleted.is_(False))
            .update({Organization.owner_id: payload.owner_id}, synchronize_session=False)
        )

    updated_opps = 0
    if payload.opportunity_ids:
        updated_opps = (
            db.query(Opportunity)
            .filter(Opportunity.id.in_(payload.opportunity_ids), Opportunity.is_deleted.is_(False))
            .update({Opportunity.owner_id: payload.owner_id}, synchronize_session=False)
        )

    updated_parts = 0
    if payload.partnership_ids:
        updated_parts = (
            db.query(Partnership)
            .filter(Partnership.id.in_(payload.partnership_ids), Partnership.is_deleted.is_(False))
            .update({Partnership.owner_id: payload.owner_id}, synchronize_session=False)
        )

    db.commit()

    audit = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="BULK_ASSIGN_OWNER",
        resource_type="ASSIGNMENTS",
        metadata_json=json.dumps({
            "owner_id": payload.owner_id,
            "orgs_count": updated_orgs,
            "opps_count": updated_opps,
            "parts_count": updated_parts,
        }),
    )
    db.add(audit)
    db.commit()

    return AdminAssignmentResult(
        success=True,
        message="Bulk ownership reassignment completed successfully.",
        updated_organizations=updated_orgs,
        updated_opportunities=updated_opps,
        updated_partnerships=updated_parts,
    )


# ── 5. Showcase Project Governance ──

@router.get("/showcase", response_model=PaginatedProjectsOut)
def list_admin_showcase_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = db.query(Project).filter(Project.is_deleted.is_(False))

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Project.name.ilike(term),
                Project.short_description.ilike(term),
                Project.description.ilike(term),
            )
        )
    if status_filter and status_filter.strip() and status_filter != "All":
        query = query.filter(Project.status.ilike(status_filter.strip()))
    if category and category.strip() and category != "All":
        query = query.filter(Project.category == category.strip())

    total = query.count()
    total_pages = max(1, math.ceil(total / page_size))
    items = (
        query.order_by(desc(Project.is_featured), desc(Project.updated_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedProjectsOut(
        items=[ProjectOut.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/showcase", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_admin_showcase_project(
    payload: AdminProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    payload_dict = payload.model_dump()
    _validate_project_urls(payload_dict)

    slug = payload.slug or re.sub(r"[^a-z0-9]+", "-", payload.name.lower()).strip("-")
    existing_slug = db.query(Project).filter(Project.slug == slug).first()
    if existing_slug:
        slug = f"{slug}-{int(datetime.now(timezone.utc).timestamp())}"

    new_project = Project(
        name=payload.name.strip(),
        slug=slug,
        short_description=payload.short_description.strip(),
        description=payload.description.strip(),
        category=payload.category,
        status=payload.status,
        thumbnail_url=payload.thumbnail_url,
        video_url=payload.video_url,
        demo_url=payload.demo_url,
        website_url=payload.website_url,
        presentation_url=payload.presentation_url,
        key_features=payload.key_features,
        business_value=payload.business_value,
        business_use_cases=payload.business_use_cases,
        tags=payload.tags,
        is_featured=payload.is_featured,
        created_by=current_user.id,
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    audit = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="CREATE_PROJECT",
        resource_type="PROJECT",
        resource_id=new_project.id,
        metadata_json=json.dumps({"name": new_project.name, "status": new_project.status}),
    )
    db.add(audit)
    db.commit()

    return ProjectOut.model_validate(new_project)


@router.patch("/showcase/{project_id}", response_model=ProjectOut)
def update_admin_showcase_project(
    project_id: int,
    payload: AdminProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    proj = db.query(Project).filter(Project.id == project_id, Project.is_deleted.is_(False)).first()
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    update_data = payload.model_dump(exclude_unset=True)
    _validate_project_urls(update_data)

    for field, val in update_data.items():
        setattr(proj, field, val)

    db.commit()
    db.refresh(proj)

    audit = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="UPDATE_PROJECT",
        resource_type="PROJECT",
        resource_id=proj.id,
        metadata_json=json.dumps({"updated_fields": list(update_data.keys())}),
    )
    db.add(audit)
    db.commit()

    return ProjectOut.model_validate(proj)


@router.patch("/showcase/{project_id}/status", response_model=ProjectOut)
def update_admin_showcase_project_status(
    project_id: int,
    payload: AdminProjectStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    proj = db.query(Project).filter(Project.id == project_id, Project.is_deleted.is_(False)).first()
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    proj.status = payload.status
    db.commit()
    db.refresh(proj)

    audit = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="CHANGE_PROJECT_STATUS",
        resource_type="PROJECT",
        resource_id=proj.id,
        metadata_json=json.dumps({"status": proj.status}),
    )
    db.add(audit)
    db.commit()

    return ProjectOut.model_validate(proj)


@router.delete("/showcase/{project_id}")
def delete_admin_showcase_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    proj = db.query(Project).filter(Project.id == project_id, Project.is_deleted.is_(False)).first()
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    proj.is_deleted = True
    proj.status = ProjectStatus.ARCHIVED.value
    db.commit()

    audit = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="ARCHIVE_PROJECT",
        resource_type="PROJECT",
        resource_id=proj.id,
        metadata_json=json.dumps({"name": proj.name}),
    )
    db.add(audit)
    db.commit()

    return {"message": "Project archived successfully.", "id": project_id}


# ── 6. Audit Log Monitoring ──

@router.get("/audit-logs", response_model=PaginatedAuditLogsOut)
def get_admin_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    user_email: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = db.query(AuditLog)

    if action and action.strip():
        query = query.filter(AuditLog.action.ilike(f"%{action.strip()}%"))
    if resource_type and resource_type.strip():
        query = query.filter(AuditLog.resource_type == resource_type.strip())
    if user_email and user_email.strip():
        query = query.filter(AuditLog.user_email.ilike(f"%{user_email.strip()}%"))
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                AuditLog.action.ilike(term),
                AuditLog.user_email.ilike(term),
                AuditLog.resource_type.ilike(term),
                AuditLog.metadata_json.ilike(term),
            )
        )
    if start_date:
        try:
            sd = datetime.fromisoformat(start_date)
            query = query.filter(AuditLog.timestamp >= sd)
        except Exception:
            pass
    if end_date:
        try:
            ed = datetime.fromisoformat(end_date)
            query = query.filter(AuditLog.timestamp <= ed)
        except Exception:
            pass

    total = query.count()
    total_pages = max(1, math.ceil(total / page_size))
    items = (
        query.order_by(desc(AuditLog.timestamp))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedAuditLogsOut(
        items=[AuditLogOut.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# ── 7. Safe System Configuration ──

DEFAULT_ORG_TYPES = [
    "Hospital", "Hospital Group", "Clinic", "Diagnostic Center",
    "Healthcare Company", "Healthcare Technology Company",
    "Medical Infrastructure Company", "Home Healthcare", "Elder Care",
    "Pharmacy", "Medical Equipment Company", "Insurance Company",
    "SaaS Company", "Software Company", "Technology Company",
    "AI Company", "Fintech Company", "Financial Services",
    "Manufacturing", "Industrial", "Automotive",
    "Retail", "E-commerce", "Logistics",
    "Energy", "Consulting", "NGO", "Other"
]

DEFAULT_CONNECTION_STATUSES = [
    "Potential", "Contacted", "Connected", "Interested", "Meeting", "Discussion", "Partnership"
]

DEFAULT_PARTNERSHIP_TYPES = [
    "Technology Partnership", "Business Partnership", "Strategic Partnership",
    "Integration Partnership", "Service Partnership", "Distribution Partnership",
    "Referral Partnership", "Other"
]

DEFAULT_MEETING_TYPES = [
    "Introduction", "Product Demo", "Technical Deep Dive", "Executive Meeting",
    "Follow-up", "Negotiation", "Partnership Review", "Other"
]

DEFAULT_PRIORITY_LEVELS = ["High", "Medium", "Low"]

DEFAULT_PROJECT_CATEGORIES = [
    "Healthcare", "SaaS", "Fintech", "Manufacturing",
    "Artificial Intelligence", "Data Science", "Automation",
    "Communication", "Business", "Web Platform", "Mobile Application", "Other"
]


@router.get("/settings", response_model=SystemSettingsOut)
def get_system_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    org_types_setting = db.query(SystemSetting).filter(SystemSetting.key == "organization_types").first()
    org_types = org_types_setting.value_json if org_types_setting else DEFAULT_ORG_TYPES

    part_types_setting = db.query(SystemSetting).filter(SystemSetting.key == "partnership_types").first()
    part_types = part_types_setting.value_json if part_types_setting else DEFAULT_PARTNERSHIP_TYPES

    meet_types_setting = db.query(SystemSetting).filter(SystemSetting.key == "meeting_types").first()
    meet_types = meet_types_setting.value_json if meet_types_setting else DEFAULT_MEETING_TYPES

    proj_cats_setting = db.query(SystemSetting).filter(SystemSetting.key == "project_categories").first()
    proj_cats = proj_cats_setting.value_json if proj_cats_setting else DEFAULT_PROJECT_CATEGORIES

    return SystemSettingsOut(
        organization_types=org_types,
        connection_statuses=DEFAULT_CONNECTION_STATUSES,
        partnership_types=part_types,
        meeting_types=meet_types,
        priority_levels=DEFAULT_PRIORITY_LEVELS,
        project_categories=proj_cats,
    )


@router.patch("/settings", response_model=SystemSettingsOut)
def update_system_settings(
    payload: SystemSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if payload.organization_types is not None:
        s = db.query(SystemSetting).filter(SystemSetting.key == "organization_types").first()
        if not s:
            s = SystemSetting(key="organization_types", category="organizations", value_json=payload.organization_types, updated_by=current_user.email)
            db.add(s)
        else:
            s.value_json = payload.organization_types
            s.updated_by = current_user.email

    if payload.partnership_types is not None:
        s = db.query(SystemSetting).filter(SystemSetting.key == "partnership_types").first()
        if not s:
            s = SystemSetting(key="partnership_types", category="partnerships", value_json=payload.partnership_types, updated_by=current_user.email)
            db.add(s)
        else:
            s.value_json = payload.partnership_types
            s.updated_by = current_user.email

    if payload.meeting_types is not None:
        s = db.query(SystemSetting).filter(SystemSetting.key == "meeting_types").first()
        if not s:
            s = SystemSetting(key="meeting_types", category="meetings", value_json=payload.meeting_types, updated_by=current_user.email)
            db.add(s)
        else:
            s.value_json = payload.meeting_types
            s.updated_by = current_user.email

    if payload.project_categories is not None:
        s = db.query(SystemSetting).filter(SystemSetting.key == "project_categories").first()
        if not s:
            s = SystemSetting(key="project_categories", category="projects", value_json=payload.project_categories, updated_by=current_user.email)
            db.add(s)
        else:
            s.value_json = payload.project_categories
            s.updated_by = current_user.email

    db.commit()

    audit = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="UPDATE_SYSTEM_SETTINGS",
        resource_type="SETTINGS",
        metadata_json=json.dumps({"updated_settings": list(payload.model_dump(exclude_unset=True).keys())}),
    )
    db.add(audit)
    db.commit()

    return get_system_settings(db=db, current_user=current_user)
