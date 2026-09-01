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
