import csv
import io
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from openpyxl import load_workbook
from sqlalchemy.orm import Session

from app.models.organization import Organization, ConnectionStatus, PriorityLevel
from app.models.contact import Contact, ContactRelationshipStatus
from app.models.activity import ContactActivity
from app.models.lead_import import LeadImportBatch
from app.services.discovery_engine import check_organization_duplicate, check_contact_duplicate

logger = logging.getLogger("elly.lead_import")

STAGING_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "private_uploads", "lead_imports")

# Target CRM fields a column can be mapped to. "org_name" is the only required one.
TARGET_FIELDS = [
    "org_name", "org_website", "org_industry", "org_country", "org_state", "org_city",
    "org_phone", "org_email",
    "contact_full_name", "contact_first_name", "contact_last_name",
    "contact_email", "contact_phone", "contact_designation", "contact_linkedin",
]

# Keyword hints used to auto-suggest a mapping from the uploaded sheet's own headers.
# Ordered longest/most-specific hint first within each list isn't required — suggest_mapping()
# picks the longest matching hint across ALL targets per header, so specific hints always
# beat generic ones (e.g. "firm name" beats bare "name") regardless of dict order.
_SUGGEST_HINTS: Dict[str, List[str]] = {
    "org_name": [
        "company name", "organization name", "org name", "firm name", "account name",
        "business name", "company", "organization", "firm", "account", "business",
    ],
    "org_website": ["website", "domain", "url"],
    "org_industry": ["industry", "sector", "vertical"],
    "org_country": ["country"],
    "org_state": ["state", "province", "region"],
    "org_city": ["city", "town"],
    "org_phone": ["company phone", "office phone", "main phone"],
    "org_email": ["company email", "info@", "general email"],
    "contact_full_name": ["full name", "contact name", "name"],
    "contact_first_name": ["first name", "firstname"],
    "contact_last_name": ["last name", "lastname", "surname"],
    "contact_email": ["email", "e-mail"],
    "contact_phone": ["phone", "mobile", "cell", "contact number"],
    "contact_designation": ["title", "designation", "job title", "position", "role"],
    "contact_linkedin": ["linkedin"],
}


def _ensure_staging_dir():
    os.makedirs(STAGING_DIR, exist_ok=True)


def parse_upload(filename: str, file_bytes: bytes) -> Tuple[List[str], List[Dict[str, str]]]:
    """Parses a CSV or XLSX upload into (headers, rows-as-dicts). Raises ValueError on bad input."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    rows: List[Dict[str, str]] = []

    if ext == "csv":
        text = file_bytes.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        headers = [h.strip() for h in (reader.fieldnames or [])]
        for raw_row in reader:
            rows.append({(k or "").strip(): (v or "").strip() if v else "" for k, v in raw_row.items()})
    elif ext in ("xlsx", "xlsm"):
        wb = load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        ws = wb.active
        header_row = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), None)
        if not header_row:
            raise ValueError("Sheet has no header row.")
        headers = [str(h).strip() if h is not None else "" for h in header_row]
        for raw_row in ws.iter_rows(min_row=2, values_only=True):
            row_dict = {}
            for idx, h in enumerate(headers):
                if not h:
                    continue
                val = raw_row[idx] if idx < len(raw_row) else None
                row_dict[h] = "" if val is None else str(val).strip()
            if any(v for v in row_dict.values()):
                rows.append(row_dict)
    else:
        raise ValueError(f"Unsupported file type '.{ext}'. Upload a .csv or .xlsx file.")

    headers = [h for h in headers if h]
    return headers, rows


def suggest_mapping(headers: List[str]) -> Dict[str, Optional[str]]:
    """
    Best-effort auto-suggestion of header -> target field, for the mapping UI to pre-fill.
    For each header, picks the target whose matching hint is longest (most specific), so
    e.g. "Firm Name" maps to org_name (via the "firm name"/"firm" hints) rather than being
    stolen by contact_full_name's generic "name" hint.
    """
    mapping: Dict[str, Optional[str]] = {f: None for f in TARGET_FIELDS}
    for header in headers:
        lower = header.lower().strip()
        best_target: Optional[str] = None
        best_hint_len = 0
        for target, hints in _SUGGEST_HINTS.items():
            if mapping[target]:
                continue
            for hint in hints:
                if hint in lower and len(hint) > best_hint_len:
                    best_target = target
                    best_hint_len = len(hint)
        if best_target:
            mapping[best_target] = header
    return mapping


def stage_upload(filename: str, file_bytes: bytes) -> str:
    """Parses + persists an upload to disk so the confirm step doesn't need a re-upload. Returns upload_id."""
    headers, rows = parse_upload(filename, file_bytes)
    _ensure_staging_dir()
    upload_id = uuid.uuid4().hex
    staged_path = os.path.join(STAGING_DIR, f"{upload_id}.json")
    with open(staged_path, "w", encoding="utf-8") as f:
        json.dump({"filename": filename, "headers": headers, "rows": rows}, f)
    return upload_id


def load_staged_upload(upload_id: str) -> Dict[str, Any]:
    staged_path = os.path.join(STAGING_DIR, f"{upload_id}.json")
    if not os.path.exists(staged_path):
        raise ValueError("Upload not found or has expired. Please re-upload the file.")
    with open(staged_path, "r", encoding="utf-8") as f:
        return json.load(f)


def discard_staged_upload(upload_id: str) -> None:
    staged_path = os.path.join(STAGING_DIR, f"{upload_id}.json")
    if os.path.exists(staged_path):
        try:
            os.remove(staged_path)
        except OSError:
            pass


def import_leads(
    db: Session,
    rows: List[Dict[str, str]],
    column_mapping: Dict[str, Optional[str]],
    user_id: Optional[int],
    filename: str,
) -> LeadImportBatch:
    """
    Imports rows into Organization/Contact using the user-confirmed column mapping.
    One row = one organization (+ optionally one contact). Dedupes against existing CRM
    records the same way AI discovery promotion does, and mirrors every created/matched
    record into the Google Sheets CRM sync (best-effort, non-fatal).
    """
    from app.services.google_sheets_service import sync_organization, sync_contact

    def get_val(row: Dict[str, str], field: str) -> str:
        header = column_mapping.get(field)
        if not header:
            return ""
        return (row.get(header) or "").strip()

    orgs_created = orgs_matched = contacts_created = contacts_matched = skipped = 0
    errors: List[str] = []
    now = datetime.now(timezone.utc)

    for i, row in enumerate(rows, start=1):
        try:
            org_name = get_val(row, "org_name")
            if not org_name:
                skipped += 1
                continue

            is_dup, existing_org_id, _ = check_organization_duplicate(
                db, org_name, website=get_val(row, "org_website")
            )
            if is_dup and existing_org_id:
                org = db.query(Organization).filter(Organization.id == existing_org_id).first()
                orgs_matched += 1
            else:
                org = Organization(
                    name=org_name,
                    organization_type="Technology Company",
                    website=get_val(row, "org_website") or None,
                    email=get_val(row, "org_email") or None,
                    phone=get_val(row, "org_phone") or None,
                    country=get_val(row, "org_country") or "Unknown",
                    state=get_val(row, "org_state") or None,
                    city=get_val(row, "org_city") or None,
                    industry=get_val(row, "org_industry") or "Unknown",
                    status=ConnectionStatus.POTENTIAL.value,
                    priority=PriorityLevel.MEDIUM.value,
                    notes=f"Imported from lead list '{filename}'.",
                    created_by=user_id,
                    owner_id=user_id,
                    created_at=now,
                    updated_at=now,
                )
                db.add(org)
                db.flush()
                orgs_created += 1
                try:
                    sync_organization(org)
                except Exception:
                    pass

            full_name = get_val(row, "contact_full_name")
            first_name = get_val(row, "contact_first_name")
            last_name = get_val(row, "contact_last_name")
            if not first_name and full_name:
                parts = full_name.split(maxsplit=1)
                first_name = parts[0]
                last_name = parts[1] if len(parts) > 1 else ""
            contact_email = get_val(row, "contact_email")

            if first_name or contact_email:
                is_c_dup, existing_contact_id, _ = check_contact_duplicate(
                    db, email=contact_email, full_name=f"{first_name} {last_name}".strip(), organization_id=org.id
                )
                if is_c_dup and existing_contact_id:
                    contacts_matched += 1
                else:
                    contact = Contact(
                        organization_id=org.id,
                        first_name=first_name or "Unknown",
                        last_name=last_name or None,
                        designation=get_val(row, "contact_designation") or None,
                        email=contact_email or None,
                        phone=get_val(row, "contact_phone") or None,
                        linkedin_url=get_val(row, "contact_linkedin") or None,
                        connection_status=ContactRelationshipStatus.NOT_CONTACTED.value,
                        notes=f"Imported from lead list '{filename}'.",
                        created_by=user_id,
                        owner_id=user_id,
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(contact)
                    db.flush()
                    db.add(ContactActivity(
                        contact_id=contact.id,
                        organization_id=org.id,
                        activity_type="lead_import",
                        description=f"Contact added via lead-list import ('{filename}').",
                    ))
                    contacts_created += 1
                    try:
                        sync_contact(contact)
                    except Exception:
                        pass
        except Exception as e:
            logger.warning(f"Lead import row {i} failed: {e}")
            if len(errors) < 50:
                errors.append(f"Row {i}: {e}")
            skipped += 1

    db.commit()

    batch = LeadImportBatch(
        filename=filename,
        uploaded_by=user_id,
        column_mapping=column_mapping,
        total_rows=len(rows),
        organizations_created=orgs_created,
        organizations_matched=orgs_matched,
        contacts_created=contacts_created,
        contacts_matched=contacts_matched,
        skipped_count=skipped,
        errors=errors or None,
        status="completed",
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch
