from typing import Optional, Dict, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User
from app.models.lead_import import LeadImportBatch
from app.models.organization import Organization
from app.models.contact import Contact
from app.models.campaign import Campaign
from app.services import lead_import_service
from app.services.google_sheets_service import extract_spreadsheet_id, list_worksheet_tabs, read_worksheet_rows

router = APIRouter(
    prefix="/api/business-development/leads",
    tags=["Lead List Import"],
    dependencies=[Depends(require_business_development)],
)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB
MAX_SHEET_ROWS = 20000


class ImportConfirmRequest(BaseModel):
    upload_id: str
    column_mapping: Dict[str, Optional[str]]
    campaign_id: Optional[int] = None


class GoogleSheetsListTabsRequest(BaseModel):
    spreadsheet_url: str


class GoogleSheetsLoadRequest(BaseModel):
    spreadsheet_url: str
    sheet_names: List[str]


@router.post("/upload")
async def upload_lead_list(
    file: UploadFile = File(...),
    current_user: User = Depends(require_business_development),
):
    """
    Step 1: upload a CSV/XLSX lead list. Parses headers, suggests a column mapping,
    and returns a preview — nothing is written to the CRM yet.
    """
    file_bytes = await file.read()
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10MB).")

    try:
        upload_id = lead_import_service.stage_upload(file.filename or "upload.csv", file_bytes)
        staged = lead_import_service.load_staged_upload(upload_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "upload_id": upload_id,
        "filename": staged["filename"],
        "headers": staged["headers"],
        "total_rows": len(staged["rows"]),
        "preview_rows": staged["rows"][:5],
        "suggested_mapping": lead_import_service.suggest_mapping(staged["headers"]),
        "target_fields": lead_import_service.TARGET_FIELDS,
    }


@router.post("/google-sheets/list-tabs")
def list_google_sheet_tabs(
    payload: GoogleSheetsListTabsRequest,
    current_user: User = Depends(require_business_development),
):
    """Step 1 (Google Sheets flow): resolve a pasted Sheets URL and list its tabs to pick from."""
    spreadsheet_id = extract_spreadsheet_id(payload.spreadsheet_url)
    if not spreadsheet_id:
        raise HTTPException(status_code=400, detail="Enter a valid Google Sheets URL.")
    try:
        tabs = list_worksheet_tabs(spreadsheet_id)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not open that spreadsheet. Make sure it's shared with the server's Google service account, or shared as 'Anyone with the link'. ({e})")

    return {"spreadsheet_id": spreadsheet_id, "tabs": tabs}


@router.post("/google-sheets/load")
def load_google_sheet_rows(
    payload: GoogleSheetsLoadRequest,
    current_user: User = Depends(require_business_development),
):
    """Step 2 (Google Sheets flow): pull rows from the selected tab(s) and stage them for mapping."""
    spreadsheet_id = extract_spreadsheet_id(payload.spreadsheet_url)
    if not spreadsheet_id:
        raise HTTPException(status_code=400, detail="Enter a valid Google Sheets URL.")
    if not payload.sheet_names:
        raise HTTPException(status_code=400, detail="Select at least one sheet tab to import.")

    all_headers: List[str] = []
    all_rows = []
    per_tab_header_sets: List[set] = []
    for name in payload.sheet_names:
        try:
            headers, rows = read_worksheet_rows(spreadsheet_id, name)
        except RuntimeError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not read tab '{name}': {e}")
        per_tab_header_sets.append(set(headers))
        for h in headers:
            if h not in all_headers:
                all_headers.append(h)
        all_rows.extend(rows)
        if len(all_rows) > MAX_SHEET_ROWS:
            raise HTTPException(status_code=400, detail=f"Selected tab(s) have too many rows (max {MAX_SHEET_ROWS}). Narrow your selection.")

    if not all_rows:
        raise HTTPException(status_code=400, detail="The selected sheet tab(s) have no data rows.")

    warning = None
    if len(per_tab_header_sets) > 1 and len(set.intersection(*per_tab_header_sets)) == 0:
        warning = (
            "The selected tabs don't share any column names — after you map columns below, "
            "rows from tabs whose matching column wasn't picked for the mapping will be skipped as missing "
            "organization name. Consider importing mismatched tabs separately."
        )

    filename = f"Google Sheet ({', '.join(payload.sheet_names)})"
    upload_id = lead_import_service.stage_rows(filename, all_headers, all_rows)
    staged = lead_import_service.load_staged_upload(upload_id)

    return {
        "upload_id": upload_id,
        "filename": staged["filename"],
        "headers": staged["headers"],
        "total_rows": len(staged["rows"]),
        "preview_rows": staged["rows"][:5],
        "suggested_mapping": lead_import_service.suggest_mapping(staged["headers"]),
        "target_fields": lead_import_service.TARGET_FIELDS,
        "warning": warning,
    }


@router.post("/import")
def confirm_lead_import(
    payload: ImportConfirmRequest,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Step 2: user-confirmed column mapping — commits rows into Organizations/Contacts."""
    try:
        staged = lead_import_service.load_staged_upload(payload.upload_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not payload.column_mapping.get("org_name"):
        raise HTTPException(status_code=400, detail="You must map a column to 'org_name' (organization name) to import.")

    if payload.campaign_id is not None:
        campaign = db.query(Campaign).filter(Campaign.id == payload.campaign_id).first()
        if not campaign:
            raise HTTPException(status_code=400, detail=f"Campaign {payload.campaign_id} not found.")

    batch = lead_import_service.import_leads(
        db=db,
        rows=staged["rows"],
        column_mapping=payload.column_mapping,
        user_id=current_user.id,
        filename=staged["filename"],
        campaign_id=payload.campaign_id,
    )
    lead_import_service.discard_staged_upload(payload.upload_id)

    return {
        "batch_id": batch.id,
        "filename": batch.filename,
        "total_rows": batch.total_rows,
        "organizations_created": batch.organizations_created,
        "organizations_matched": batch.organizations_matched,
        "contacts_created": batch.contacts_created,
        "contacts_matched": batch.contacts_matched,
        "skipped_count": batch.skipped_count,
        "contacts_enrolled": getattr(batch, "contacts_enrolled", 0),
        "campaign_id": payload.campaign_id,
        "errors": batch.errors or [],
    }


@router.get("/imports")
def list_lead_imports(
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """History of past lead-list imports."""
    batches = db.query(LeadImportBatch).order_by(LeadImportBatch.created_at.desc()).limit(50).all()
    return [
        {
            "id": b.id,
            "filename": b.filename,
            "total_rows": b.total_rows,
            "organizations_created": b.organizations_created,
            "organizations_matched": b.organizations_matched,
            "contacts_created": b.contacts_created,
            "contacts_matched": b.contacts_matched,
            "skipped_count": b.skipped_count,
            "status": b.status,
            "created_at": b.created_at,
        }
        for b in batches
    ]


@router.get("/imports/{batch_id}/records")
def get_lead_import_records(
    batch_id: int,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Detail view for one past import — every Organization/Contact row it created."""
    batch = db.query(LeadImportBatch).filter(LeadImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Import batch not found.")

    orgs = (
        db.query(Organization)
        .filter(Organization.import_batch_id == batch_id, Organization.is_deleted.is_(False))
        .order_by(Organization.name)
        .all()
    )
    contacts = (
        db.query(Contact)
        .options(joinedload(Contact.organization))
        .filter(Contact.import_batch_id == batch_id, Contact.is_deleted.is_(False))
        .order_by(Contact.first_name)
        .all()
    )

    return {
        "batch_id": batch.id,
        "filename": batch.filename,
        "organizations": [
            {
                "id": o.id,
                "name": o.name,
                "website": o.website,
                "city": o.city,
                "state": o.state,
                "country": o.country,
                "status": o.status,
            }
            for o in orgs
        ],
        "contacts": [
            {
                "id": c.id,
                "full_name": c.full_name,
                "email": c.email,
                "phone": c.phone,
                "designation": c.designation,
                "location": c.location,
                "organization_id": c.organization_id,
                "organization_name": c.organization.name if c.organization else None,
            }
            for c in contacts
        ],
    }
