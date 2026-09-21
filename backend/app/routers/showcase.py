import math
import os
import re
import uuid
import zipfile
import subprocess
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
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


ALLOWED_PRESENTATION_EXTENSIONS = {".pdf", ".ppt", ".pptx"}
MAX_PRESENTATION_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("/showcase/{id}/upload-presentation", response_model=ProjectDetailOut)
async def upload_project_presentation(
    id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Uploads a presentation deck (.pdf, .ppt, .pptx) and attaches it to the showcase project."""
    project = db.query(Project).filter(Project.id == id, Project.is_deleted.is_(False)).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {id} not found.",
        )

    filename = file.filename or "presentation.pdf"
    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_PRESENTATION_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid presentation format '{ext}'. Supported formats: .pdf, .ppt, .pptx",
        )

    content = await file.read()
    if len(content) > MAX_PRESENTATION_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Presentation file exceeds maximum allowable size (50MB).",
        )

    uploads_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "presentations"))
    os.makedirs(uploads_dir, exist_ok=True)

    sanitized_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", filename)
    unique_filename = f"{uuid.uuid4().hex[:12]}_{sanitized_name}"
    file_path = os.path.join(uploads_dir, unique_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    project.presentation_url = f"/api/uploads/presentations/{unique_filename}"
    project.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(project)

    return _format_project_detail_out(project)


@router.post("/showcase/upload-presentation-file")
async def upload_standalone_presentation_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_business_development),
):
    """Uploads a presentation deck before project creation and returns the hosted URL."""
    filename = file.filename or "presentation.pdf"
    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_PRESENTATION_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid presentation format '{ext}'. Supported formats: .pdf, .ppt, .pptx",
        )

    content = await file.read()
    if len(content) > MAX_PRESENTATION_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Presentation file exceeds maximum allowable size (50MB).",
        )

    uploads_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "presentations"))
    os.makedirs(uploads_dir, exist_ok=True)

    sanitized_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", filename)
    unique_filename = f"{uuid.uuid4().hex[:12]}_{sanitized_name}"
    file_path = os.path.join(uploads_dir, unique_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    return {
        "status": "success",
        "filename": filename,
        "presentation_url": f"/api/uploads/presentations/{unique_filename}",
        "file_type": ext.lstrip(".").upper(),
        "file_size": len(content),
    }


def _convert_pptx_to_pdf(file_path: str) -> Optional[str]:
    """Convert PPTX/PPT to exact high-fidelity PDF using PowerPoint automation."""
    if not os.path.exists(file_path):
        return None
    
    base, ext = os.path.splitext(file_path)
    if ext.lower() not in {".pptx", ".ppt"}:
        return None
        
    pdf_path = f"{base}.pdf"
    if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 0:
        return pdf_path

    script_path = os.path.abspath(
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "scripts", "convert_pptx_to_pdf.ps1")
    )
    if not os.path.exists(script_path):
        return None

    try:
        cmd = [
            "powershell",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            script_path,
            "-InputPath",
            os.path.abspath(file_path),
            "-OutputPath",
            os.path.abspath(pdf_path),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=40)
        if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 0:
            return pdf_path
    except Exception:
        pass

    return None


def _parse_pptx_slides(file_path: str, uploads_dir: str) -> List[dict]:
    """Parse a PowerPoint .pptx presentation and extract structured slide contents and images."""
    if not os.path.exists(file_path):
        return []

    unique_prefix = os.path.basename(file_path).split(".")[0]
    extracted_dir = os.path.join(uploads_dir, "extracted", unique_prefix)
    os.makedirs(extracted_dir, exist_ok=True)
    web_prefix = f"/api/uploads/presentations/extracted/{unique_prefix}"

    try:
        with zipfile.ZipFile(file_path, "r") as z:
            # Extract slide images/media
            media_files = [n for n in z.namelist() if n.startswith("ppt/media/")]
            for mf in media_files:
                out_mf = os.path.join(extracted_dir, os.path.basename(mf))
                if not os.path.exists(out_mf):
                    with open(out_mf, "wb") as f:
                        f.write(z.read(mf))

            slide_files = sorted(
                [n for n in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml", n)],
                key=lambda x: int(re.search(r"\d+", x).group())
            )

            ns = {
                "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
                "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
            }

            slides = []
            for idx, sf in enumerate(slide_files, 1):
                tree = ET.fromstring(z.read(sf))

                # Image relationships for this slide
                rels_file = f"ppt/slides/_rels/{os.path.basename(sf)}.rels"
                slide_images = []
                if rels_file in z.namelist():
                    rels_tree = ET.fromstring(z.read(rels_file))
                    for rel in rels_tree.iter("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
                        target = rel.attrib.get("Target", "")
                        if "media/" in target:
                            img_name = os.path.basename(target)
                            slide_images.append(f"{web_prefix}/{img_name}")

                # Text shapes
                blocks = []
                title = None
                for sp in tree.findall(".//p:sp", ns):
                    txBody = sp.find(".//p:txBody", ns)
                    if txBody is None:
                        continue
                    lines = []
                    for p in txBody.findall(".//a:p", ns):
                        t = "".join([elem.text for elem in p.findall(".//a:t", ns) if elem.text])
                        if t.strip():
                            lines.append(t.strip())
                    if lines:
                        if title is None:
                            title = lines[0]
                            if len(lines) > 1:
                                blocks.append({"type": "paragraph", "lines": lines[1:]})
                        else:
                            blocks.append({"type": "paragraph", "lines": lines})

                # Tables
                tables = []
                for tbl in tree.findall(".//a:tbl", ns):
                    rows = []
                    for tr in tbl.findall(".//a:tr", ns):
                        row = []
                        for tc in tr.findall(".//a:tc", ns):
                            cell_text = "".join([elem.text for elem in tc.findall(".//a:t", ns) if elem.text]).strip()
                            row.append(cell_text)
                        if any(row):
                            rows.append(row)
                    if rows:
                        tables.append(rows)

                slides.append({
                    "slide_number": idx,
                    "title": title or f"Slide {idx}",
                    "blocks": blocks,
                    "tables": tables,
                    "images": slide_images,
                })
            return slides
    except Exception as e:
        return []


@router.get("/showcase/{id}/slides")
def get_project_presentation_slides(
    id: int,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Retrieve structured presentation slide content for the project deck."""
    project = db.query(Project).filter(Project.id == id, Project.is_deleted.is_(False)).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {id} not found.",
        )

    if not project.presentation_url:
        return {
            "has_presentation": False,
            "file_type": None,
            "filename": None,
            "presentation_url": None,
            "slide_count": 0,
            "slides": [],
        }

    raw_url = project.presentation_url
    filename = os.path.basename(raw_url)
    _, ext = os.path.splitext(filename.lower())

    uploads_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "presentations"))
    file_path = os.path.join(uploads_dir, filename)

    exact_pdf_url = None
    if ext == ".pdf":
        exact_pdf_url = raw_url
        return {
            "has_presentation": True,
            "file_type": "pdf",
            "filename": filename,
            "presentation_url": raw_url,
            "exact_pdf_url": exact_pdf_url,
            "slide_count": 1,
            "slides": [],
        }
    elif ext in {".pptx", ".ppt"}:
        converted_pdf = _convert_pptx_to_pdf(file_path)
        if converted_pdf:
            pdf_filename = os.path.basename(converted_pdf)
            exact_pdf_url = f"/api/uploads/presentations/{pdf_filename}"

        slides = _parse_pptx_slides(file_path, uploads_dir) if ext == ".pptx" else []
        return {
            "has_presentation": True,
            "file_type": ext.lstrip("."),
            "filename": filename,
            "presentation_url": raw_url,
            "exact_pdf_url": exact_pdf_url,
            "slide_count": len(slides),
            "slides": slides,
        }
    else:
        return {
            "has_presentation": True,
            "file_type": ext.lstrip("."),
            "filename": filename,
            "presentation_url": raw_url,
            "exact_pdf_url": None,
            "slide_count": 0,
            "slides": [],
        }


