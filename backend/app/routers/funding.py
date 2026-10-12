"""
Funding / Investor Outreach — thin REST layer over the Copilot funding tools
(tools.find_investors / find_investor_contacts / send_funding_outreach).

Kept intentionally thin: no new pipeline logic lives here. Search reuses the
standalone Investor & VC Discovery provider, contact lookup reuses the existing
executive discovery pipeline, and sending reuses CampaignService.quick_send —
all unchanged by this file. This only exposes them as plain endpoints for the
Funding nav pages.
"""
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User
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
