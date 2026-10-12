import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

import gspread
from google.oauth2.service_account import Credentials

from app.core.config import settings

logger = logging.getLogger(__name__)

# Google Sheets API scopes
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# Column headers for the leads sheet
HEADERS = [
    "Search Date",
    "Keyword",
    "Location",
    "Org Type",
    "Product Description",
    "Target ICP",
    "Objective",
    "Provider",
    "Org Name",
    "Org Type (Result)",
    "Country",
    "City",
    "Website",
    "Email",
    "Phone",
    "Description",
    "Fit Level",
    "Fit Score",
    "Fit Reason",
    "Source",
]

SHEET_NAME = "ELLY Discovery Leads"


def _get_client() -> Optional[gspread.Client]:
    creds_file = settings.GOOGLE_SHEETS_CREDENTIALS_FILE
    if not creds_file:
        return None
    try:
        creds = Credentials.from_service_account_file(creds_file, scopes=SCOPES)
        return gspread.authorize(creds)
    except Exception as e:
        logger.error(f"Google Sheets auth failed: {e}")
        return None


def _get_or_create_sheet(client: gspread.Client) -> Optional[gspread.Worksheet]:
    spreadsheet_id = settings.GOOGLE_SHEETS_SPREADSHEET_ID
    if not spreadsheet_id:
        return None
    try:
        spreadsheet = client.open_by_key(spreadsheet_id)
        try:
            worksheet = spreadsheet.worksheet(SHEET_NAME)
        except gspread.exceptions.WorksheetNotFound:
            worksheet = spreadsheet.add_worksheet(title=SHEET_NAME, rows=1000, cols=len(HEADERS))
            worksheet.update(range_name="A1", values=[HEADERS])
            # Format header row
            worksheet.format("A1:T1", {
                "backgroundColor": {"red": 0.2, "green": 0.1, "blue": 0.5},
                "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
            })
        return worksheet
    except Exception as e:
        logger.error(f"Google Sheets open failed: {e}")
        return None


def save_search_results(
    keyword: Optional[str],
    location: Optional[str],
    organization_type: Optional[str],
    product_description: Optional[str],
    target_icp: Optional[str],
    discovery_objective: Optional[str],
    provider_name: str,
    results: List[Dict[str, Any]],
) -> bool:
    """
    Appends search results to Google Sheets. Skips duplicate org names.
    Returns True on success. Fails silently.
    """
    client = _get_client()
    if not client:
        return False

    worksheet = _get_or_create_sheet(client)
    if not worksheet:
        return False

    # Read existing org names (column I = index 8) to skip duplicates
    try:
        existing_names = set()
        all_names = worksheet.col_values(9)  # column I = index 9 in gspread (1-based)
        for name in all_names:
            if name and name.strip():
                existing_names.add(name.strip().lower())
    except Exception:
        existing_names = set()  # if read fails, allow all

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    new_rows = []
    for r in results:
        org_name = r.get("name", "").strip()
        if not org_name or org_name.lower() in existing_names:
            continue  # skip duplicates
        existing_names.add(org_name.lower())
        new_rows.append([
            now,
            keyword or "",
            location or "",
            organization_type or "",
            (product_description or "")[:200],
            (target_icp or "")[:200],
            (discovery_objective or "")[:200],
            provider_name,
            org_name,
            r.get("organization_type", ""),
            r.get("country", ""),
            r.get("city", ""),
            r.get("website", ""),
            r.get("email", ""),
            r.get("phone", ""),
            (r.get("description", "") or "")[:300],
            r.get("potential_fit", ""),
            r.get("potential_fit_score", ""),
            r.get("qualification_reason", "")[:200],
            r.get("source_name", ""),
        ])

    if not new_rows:
        return True  # nothing new to add

    try:
        worksheet.append_rows(new_rows, value_input_option="USER_ENTERED")
        logger.info(f"Google Sheets: appended {len(new_rows)} new rows, skipped {len(results) - len(new_rows)} duplicates")
        return True
    except Exception as e:
        logger.error(f"Google Sheets append failed: {e}")
        return False


# ─────────────────────────────────────────────────────────────
# CRM sync — live Organizations/Contacts tabs, upserted by ID.
# Distinct from the raw-search-results "ELLY Discovery Leads" tab above:
# this mirrors the actual CRM state (any creation path — manual, AI
# discovery, funding/investor discovery, lead-list import).
# ─────────────────────────────────────────────────────────────

ORG_SHEET_NAME = "ELLY Organizations"
ORG_HEADERS = [
    "ID", "Name", "Type", "Website", "Email", "Phone",
    "Country", "State", "City", "Industry", "Status", "Priority",
    "Owner ID", "Created At", "Updated At",
]

CONTACT_SHEET_NAME = "ELLY Contacts"
CONTACT_HEADERS = [
    "ID", "Organization ID", "Organization Name", "Full Name", "Designation",
    "Department", "Email", "Phone", "LinkedIn", "Decision Maker",
    "Connection Status", "Updated At",
]


def is_configured() -> bool:
    return bool(settings.GOOGLE_SHEETS_CREDENTIALS_FILE and settings.GOOGLE_SHEETS_SPREADSHEET_ID)


def get_spreadsheet_url() -> Optional[str]:
    spreadsheet_id = settings.GOOGLE_SHEETS_SPREADSHEET_ID
    if not spreadsheet_id:
        return None
    return f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit"


def _get_or_create_named_sheet(client: gspread.Client, sheet_name: str, headers: List[str]) -> Optional[gspread.Worksheet]:
    spreadsheet_id = settings.GOOGLE_SHEETS_SPREADSHEET_ID
    if not spreadsheet_id:
        return None
    try:
        spreadsheet = client.open_by_key(spreadsheet_id)
        try:
            worksheet = spreadsheet.worksheet(sheet_name)
        except gspread.exceptions.WorksheetNotFound:
            worksheet = spreadsheet.add_worksheet(title=sheet_name, rows=2000, cols=len(headers))
            worksheet.update(range_name="A1", values=[headers])
            last_col = chr(ord("A") + len(headers) - 1)
            worksheet.format(f"A1:{last_col}1", {
                "backgroundColor": {"red": 0.2, "green": 0.1, "blue": 0.5},
                "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
            })
        return worksheet
    except Exception as e:
        logger.error(f"Google Sheets open failed for '{sheet_name}': {e}")
        return None


def _upsert_row_by_id(worksheet: gspread.Worksheet, id_value: Any, row_values: List[Any]) -> bool:
    """Updates the row matching id_value in column A, or appends a new one."""
    try:
        row_values = [("" if v is None else v) for v in row_values]
        id_col = worksheet.col_values(1)
        str_id = str(id_value)
        if str_id in id_col:
            row_idx = id_col.index(str_id) + 1  # 1-based row number
            last_col = chr(ord("A") + len(row_values) - 1)
            worksheet.update(range_name=f"A{row_idx}:{last_col}{row_idx}", values=[row_values])
        else:
            worksheet.append_row(row_values, value_input_option="USER_ENTERED")
        return True
    except Exception as e:
        logger.error(f"Google Sheets upsert failed: {e}")
        return False


def sync_organization(org: Any) -> bool:
    """Upserts one Organization row into the 'ELLY Organizations' tab. Fails silently."""
    client = _get_client()
    if not client:
        return False
    worksheet = _get_or_create_named_sheet(client, ORG_SHEET_NAME, ORG_HEADERS)
    if not worksheet:
        return False
    row = [
        org.id, org.name, org.organization_type, org.website, org.email, org.phone,
        org.country, org.state, org.city, org.industry, org.status, org.priority,
        org.owner_id,
        org.created_at.isoformat() if org.created_at else "",
        org.updated_at.isoformat() if org.updated_at else "",
    ]
    return _upsert_row_by_id(worksheet, org.id, row)


def sync_contact(contact: Any) -> bool:
    """Upserts one Contact row into the 'ELLY Contacts' tab. Fails silently."""
    client = _get_client()
    if not client:
        return False
    worksheet = _get_or_create_named_sheet(client, CONTACT_SHEET_NAME, CONTACT_HEADERS)
    if not worksheet:
        return False
    row = [
        contact.id, contact.organization_id,
        contact.organization.name if contact.organization else "",
        contact.full_name, contact.designation, contact.department,
        contact.email, contact.phone, contact.linkedin_url,
        "Yes" if contact.is_decision_maker else "No",
        contact.connection_status,
        contact.updated_at.isoformat() if contact.updated_at else "",
    ]
    return _upsert_row_by_id(worksheet, contact.id, row)


# ─────────────────────────────────────────────────────────────
# Lead Tracker two-way sync — "ELLY Lead Tracker" tab.
# push_tracker_row mirrors a CampaignContact's editable tracker fields into
# the sheet (called after every backend-side checkbox/field update, and
# again after a pull reconciles a sheet-side edit, so the sheet's own
# "Updated At" column always reflects the row's current DB updated_at).
# pull_updates reads the sheet back and reconciles sheet-side edits into the
# DB: a row is only pulled in if its "Updated At" cell still matches the
# DB's updated_at at read time (i.e. nothing changed in the DB since our
# last push) -- otherwise the DB is newer and wins, last-write-wins style.
# ─────────────────────────────────────────────────────────────

TRACKER_SHEET_NAME = "ELLY Lead Tracker"
TRACKER_HEADERS = [
    "ID", "Campaign", "Organization", "Contact", "Status",
    "Focus", "Notes", "Assigned User ID", "Next Follow-up At",
    "Linkedin Followed", "Linkedin Connection Sent", "Linkedin Connection Accepted",
    "Linkedin First Message Sent", "Linkedin Reply Received",
    "Followup 1 Sent", "Followup 2 Sent", "Followup 3 Sent",
    "Meeting Scheduled", "Opportunity Closed",
    "Updated At",
]


def push_tracker_row(cc: Any) -> bool:
    """Upserts one CampaignContact's tracker fields into the 'ELLY Lead Tracker' tab. Fails silently."""
    from app.models.campaign import LEAD_TRACKER_CHECKBOX_FIELDS

    client = _get_client()
    if not client:
        return False
    worksheet = _get_or_create_named_sheet(client, TRACKER_SHEET_NAME, TRACKER_HEADERS)
    if not worksheet:
        return False
    row = [
        cc.id,
        cc.campaign.name if cc.campaign else "",
        cc.organization.name if cc.organization else "",
        cc.contact.full_name if cc.contact else "",
        cc.status,
        cc.focus or "",
        cc.tracker_notes or "",
        cc.assigned_user_id or "",
        cc.next_followup_at.isoformat() if cc.next_followup_at else "",
    ] + [
        "Yes" if getattr(cc, f) else "No" for f in LEAD_TRACKER_CHECKBOX_FIELDS
    ] + [
        cc.updated_at.isoformat() if cc.updated_at else "",
    ]
    return _upsert_row_by_id(worksheet, cc.id, row)


def pull_updates(db: Any) -> Dict[str, Any]:
    """Reads the 'ELLY Lead Tracker' tab and reconciles sheet-side edits into
    CampaignContact rows. Last-write-wins by updated_at: a row is pulled in
    only if the sheet's 'Updated At' cell still matches the DB row's current
    updated_at (meaning nobody edited it in the DB since our last push)."""
    from app.models.campaign import CampaignContact, LEAD_TRACKER_CHECKBOX_FIELDS
    from app.services.lead_tracker_service import log_timeline_event

    client = _get_client()
    if not client:
        return {"success": False, "reason": "not_configured", "checked": 0, "updated": 0, "skipped_newer": 0}
    worksheet = _get_or_create_named_sheet(client, TRACKER_SHEET_NAME, TRACKER_HEADERS)
    if not worksheet:
        return {"success": False, "reason": "sheet_unavailable", "checked": 0, "updated": 0, "skipped_newer": 0}

    try:
        rows = worksheet.get_all_values()[1:]  # skip header row
    except Exception as e:
        logger.error(f"Google Sheets tracker read failed: {e}")
        return {"success": False, "reason": "read_failed", "checked": 0, "updated": 0, "skipped_newer": 0}

    checked = 0
    updated = 0
    skipped_newer = 0
    checkbox_start_col = 9  # index of first checkbox column in TRACKER_HEADERS

    for row in rows:
        if not row or not row[0].strip():
            continue
        checked += 1
        try:
            cc_id = int(row[0])
        except ValueError:
            continue

        cc = db.query(CampaignContact).filter(CampaignContact.id == cc_id).first()
        if not cc:
            continue

        sheet_updated_at = row[19] if len(row) > 19 else ""
        cc_updated_at = cc.updated_at.isoformat() if cc.updated_at else ""
        if sheet_updated_at != cc_updated_at:
            skipped_newer += 1
            continue  # DB changed since our last push -- DB wins, skip

        changed_fields: Dict[str, Any] = {}

        def _apply(field: str, new_val: Any) -> None:
            if getattr(cc, field) != new_val:
                changed_fields[field] = new_val
                setattr(cc, field, new_val)

        _apply("focus", (row[5] or None) if len(row) > 5 else None)
        _apply("tracker_notes", (row[6] or None) if len(row) > 6 else None)

        assigned_raw = row[7].strip() if len(row) > 7 else ""
        _apply("assigned_user_id", int(assigned_raw) if assigned_raw.isdigit() else None)

        next_followup_raw = row[8].strip() if len(row) > 8 else ""
        try:
            next_followup = datetime.fromisoformat(next_followup_raw) if next_followup_raw else None
        except ValueError:
            next_followup = cc.next_followup_at
        _apply("next_followup_at", next_followup)

        for i, field in enumerate(LEAD_TRACKER_CHECKBOX_FIELDS):
            col = checkbox_start_col + i
            val = row[col].strip() if len(row) > col else ""
            _apply(field, val.lower() == "yes")

        if changed_fields:
            cc.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(cc)
            log_timeline_event(
                db,
                campaign_contact_id=cc.id,
                user_id=None,
                event_type="sheet_sync",
                description="Updated via Google Sheets sync",
                metadata={"changed": list(changed_fields.keys())},
            )
            push_tracker_row(cc)  # refresh sheet's own Updated At column
            updated += 1

    return {"success": True, "checked": checked, "updated": updated, "skipped_newer": skipped_newer}


def pull_updates_job() -> None:
    """APScheduler entry point -- opens its own DB session, mirrors the
    pattern in task_sweep_service/reply_sync_job/signal_service."""
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        result = pull_updates(db)
        if result.get("updated"):
            logger.info(f"Google Sheets tracker pull: {result}")
    finally:
        db.close()
