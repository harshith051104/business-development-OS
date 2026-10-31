"""
Funding / Investor Outreach — thin REST layer over the Copilot funding tools
(tools.find_investors / find_investor_contacts / send_funding_outreach).

Kept intentionally thin: no new pipeline logic lives here. Search reuses the
standalone Investor & VC Discovery provider, contact lookup reuses the existing
executive discovery pipeline, and sending reuses CampaignService.quick_send —
all unchanged by this file. This only exposes them as plain endpoints for the
Funding nav pages.
"""
import csv
import io
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User
from app.models.discovery import DiscoveredOrganization
from app.models.contact import Contact
from app.services.copilot import tools

router = APIRouter(
    prefix="/api/business-development/funding",
    tags=["Funding / Investor Outreach"],
    dependencies=[Depends(require_business_development)],
)


class InvestorSearchRequest(BaseModel):
    sector: str = ""
    stage: str = ""
    location: str = ""
    limit: int = 10


class FindContactsRequest(BaseModel):
    discovered_org_id: int
    roles: Optional[str] = None


class SendFundingOutreachRequest(BaseModel):
    organization_ids: List[int]
    template: Optional[str] = None
    use_ai_template: bool = False
    campaign_name: Optional[str] = None


@router.post("/search")
def search_investors(
    payload: InvestorSearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    return tools.find_investors(
        db=db,
        sector=payload.sector,
        stage=payload.stage,
        location=payload.location,
        limit=payload.limit,
        user=current_user,
    )


@router.post("/contacts/search")
def find_contacts(
    payload: FindContactsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    return tools.find_investor_contacts(
        db=db,
        discovered_org_id=payload.discovered_org_id,
        roles=payload.roles,
        user=current_user,
    )


EXPORT_COLUMNS = [
    "Firm Name",
    "Investor Type",
    "Investment Focus",
    "First Name",
    "Last Name",
    "Full Name",
    "Contact Title",
    "Email",
    "Preferred Geography",
    "LinkedIn Profile",
    "Firm Description",
    "Stage",
]


@router.get("/export")
def export_investors_csv(
    sector: str = "",
    stage: str = "",
    location: str = "",
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """CSV export of an investor search — one row per firm contact (or one
    blank-contact row for firms with none yet), columns matching the
    requested Excel layout. Plain CSV (not .xlsx) to avoid a new dependency;
    opens fine in Excel/Sheets."""
    rows = tools.find_investors(
        db=db,
        sector=sector,
        stage=stage,
        location=location,
        limit=limit,
        user=current_user,
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(EXPORT_COLUMNS)

    for row in rows:
        discovered_org_id = row.get("discovered_org_id")
        organization_id = row.get("organization_id")

        disc_org = (
            db.query(DiscoveredOrganization).filter(DiscoveredOrganization.id == discovered_org_id).first()
            if discovered_org_id
            else None
        )

        firm_name = (disc_org.name if disc_org else row.get("name")) or ""
        investor_type = (disc_org.organization_type if disc_org else "") or ""
        firm_description = (disc_org.description if disc_org else "") or ""
        geography = (
            ", ".join(filter(None, [disc_org.city if disc_org else None, disc_org.state if disc_org else None, disc_org.country if disc_org else None]))
            if disc_org
            else ""
        ) or location

        contacts = (
            db.query(Contact).filter(Contact.organization_id == organization_id, Contact.is_deleted == False).all()  # noqa: E712
            if organization_id
            else []
        )

        if not contacts:
            writer.writerow([
                firm_name, investor_type, sector, "", "", "", "", "", geography, "", firm_description, stage,
            ])
            continue

        for contact in contacts:
            full_name = " ".join(filter(None, [contact.first_name, contact.last_name])).strip()
            writer.writerow([
                firm_name,
                investor_type,
                sector,
                contact.first_name or "",
                contact.last_name or "",
                full_name,
                contact.designation or "",
                contact.email or "",
                geography,
                contact.linkedin_url or "",
                firm_description,
                stage,
            ])

    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=investor_leads.csv"},
    )


@router.post("/send")
def send_outreach(
    payload: SendFundingOutreachRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    return tools.send_funding_outreach(
        db=db,
        organization_ids=",".join(str(i) for i in payload.organization_ids),
        template=payload.template,
        use_ai_template=payload.use_ai_template,
        campaign_name=payload.campaign_name,
        user=current_user,
    )
