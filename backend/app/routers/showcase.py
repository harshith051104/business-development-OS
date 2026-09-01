import math
import re
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, cast, String, Text

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User
from app.models.project import Project, ProjectCategory, ProjectStatus
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectOut,
    ProjectDetailOut,
    PaginatedProjectsOut,
)

router = APIRouter(prefix="/api/business-development", tags=["Showcase"])


def _generate_slug(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s)
    return s


def _format_project_out(project: Project) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        name=project.name,
        slug=project.slug,
        short_description=project.short_description,
        category=project.category,
        status=project.status,
        thumbnail_url=project.thumbnail_url,
        demo_url=project.demo_url,
        website_url=project.website_url,
        presentation_url=project.presentation_url,
        tags=project.tags or [],
        sort_order=project.sort_order,
        is_featured=project.is_featured,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def _format_project_detail_out(project: Project) -> ProjectDetailOut:
    return ProjectDetailOut(
        id=project.id,
        name=project.name,
        slug=project.slug,
        short_description=project.short_description,
        description=project.description,
        category=project.category,
        status=project.status,
        thumbnail_url=project.thumbnail_url,
        images=project.images or [],
        video_url=project.video_url,
        demo_url=project.demo_url,
        website_url=project.website_url,
        repository_url=project.repository_url,
        presentation_url=project.presentation_url,
        key_features=project.key_features or [],
        business_value=project.business_value or {},
        business_use_cases=project.business_use_cases or [],
        tags=project.tags or [],
        sort_order=project.sort_order,
        is_featured=project.is_featured,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get("/showcase", response_model=PaginatedProjectsOut)
def list_showcase_projects(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search name, description, tags, keywords"),
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by status: Active, Coming Soon, Archived"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    is_featured: Optional[bool] = Query(None, description="Filter by featured flag"),
    sort_by: str = Query("sort_order", description="Sort by: sort_order, name, created_at"),
    sort_order: str = Query("asc", description="Sort direction: asc, desc"),
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Retrieve list of approved company projects for business presentation."""
    query = db.query(Project).filter(Project.is_deleted.is_(False))

    # Search filter
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Project.name).like(term),
                func.lower(Project.short_description).like(term),
                func.lower(Project.description).like(term),
                func.lower(Project.category).like(term),
                cast(Project.tags, Text).ilike(term),
            )
        )

    # Category filter
    if category and category.strip() and category.strip().lower() != "all":
        query = query.filter(func.lower(Project.category) == category.strip().lower())

    # Status filter
    if status and status.strip() and status.strip().lower() != "all":
        query = query.filter(func.lower(Project.status) == status.strip().lower())

    # Tag filter
    if tag and tag.strip():
        tag_term = f"%{tag.strip()}%"
        query = query.filter(cast(Project.tags, Text).ilike(tag_term))

    # Featured filter
    if is_featured is not None:
        query = query.filter(Project.is_featured == is_featured)

    total = query.count()

    # Sorting
    if sort_by == "name":
        sort_col = Project.name
    elif sort_by == "created_at":
        sort_col = Project.created_at
    else:
        sort_col = Project.sort_order

    if sort_order.lower() == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedProjectsOut(
        items=[_format_project_out(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/showcase/categories")
def get_categories_and_tags(
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Retrieve distinct categories and popular tags across active showcase projects."""
    projects = db.query(Project).filter(Project.is_deleted.is_(False)).all()

    categories = [cat.value for cat in ProjectCategory]
    active_categories = sorted(list({p.category for p in projects if p.category}))

    all_tags = []
    for p in projects:
        if p.tags:
            all_tags.extend(p.tags)
    unique_tags = sorted(list(set(all_tags)))

    return {
        "categories": categories,
        "active_categories": active_categories,
        "tags": unique_tags,
    }


@router.get("/showcase/{id}", response_model=ProjectDetailOut)
def get_showcase_project(
    id: int,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Retrieve detailed project specification, business value, use cases, and presentation materials."""
    project = db.query(Project).filter(Project.id == id, Project.is_deleted.is_(False)).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {id} not found.",
        )
    return _format_project_detail_out(project)


@router.post("/showcase", response_model=ProjectDetailOut, status_code=status.HTTP_201_CREATED)
def create_showcase_project(
    payload: ProjectCreate,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Create a new showcase project record."""
    slug = payload.slug or _generate_slug(payload.name)

    # Ensure unique slug
    existing = db.query(Project).filter(Project.slug == slug, Project.is_deleted.is_(False)).first()
    if existing:
        slug = f"{slug}-{int(datetime.now(timezone.utc).timestamp())}"

    now = datetime.now(timezone.utc)
    new_project = Project(
        name=payload.name.strip(),
        slug=slug,
        short_description=payload.short_description.strip(),
        description=payload.description.strip(),
        category=payload.category,
        status=payload.status,
        thumbnail_url=payload.thumbnail_url,
        images=[img.model_dump() for img in payload.images] if payload.images else [],
        video_url=payload.video_url,
        demo_url=payload.demo_url,
        website_url=payload.website_url,
        repository_url=payload.repository_url,
        presentation_url=payload.presentation_url,
        key_features=payload.key_features or [],
        business_value=payload.business_value.model_dump() if payload.business_value else {},
        business_use_cases=[uc.model_dump() for uc in payload.business_use_cases] if payload.business_use_cases else [],
        tags=payload.tags or [],
        sort_order=payload.sort_order,
        is_featured=payload.is_featured,
        is_deleted=False,
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )

    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    return _format_project_detail_out(new_project)


@router.put("/showcase/{id}", response_model=ProjectDetailOut)
def update_showcase_project(
    id: int,
    payload: ProjectUpdate,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Update existing showcase project record."""
    project = db.query(Project).filter(Project.id == id, Project.is_deleted.is_(False)).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {id} not found.",
        )

    now = datetime.now(timezone.utc)
    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        if field == "images" and value is not None:
            project.images = [img if isinstance(img, dict) else img.model_dump() for img in value]
        elif field == "business_value" and value is not None:
            project.business_value = value if isinstance(value, dict) else value.model_dump()
        elif field == "business_use_cases" and value is not None:
            project.business_use_cases = [uc if isinstance(uc, dict) else uc.model_dump() for uc in value]
        else:
            setattr(project, field, value)

    project.updated_at = now
    db.commit()
    db.refresh(project)

    return _format_project_detail_out(project)


@router.delete("/showcase/{id}")
def delete_showcase_project(
    id: int,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Soft delete a showcase project record."""
    project = db.query(Project).filter(Project.id == id, Project.is_deleted.is_(False)).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {id} not found.",
        )

    project.is_deleted = True
    project.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"status": "success", "message": f"Project '{project.name}' deleted successfully."}
