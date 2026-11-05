from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User
from app.models.organization import Organization
from app.models.organization_financials import OrganizationFinancials
from app.schemas.insights import (
    InsightOrganizationOut,
    InsightFinancialsOut,
    InsightPointOut,
    InsightsResponseOut,
)
from app.schemas.organization_financials import FinancialHealthOut

router = APIRouter(prefix="/api/business-development/insights", tags=["Analytics & Reporting"])

MAX_ORGANIZATIONS = 2000


def _to_insight_financials(fin: OrganizationFinancials) -> InsightFinancialsOut:
    metrics = {}
    for key, points in (fin.metrics or {}).items():
        metrics[key] = [
            InsightPointOut(
                fiscal_year=p.get("fiscal_year"),
                period_end=p.get("period_end"),
                value=p.get("value"),
                form=p.get("form"),
                filed=p.get("filed"),
                source_url=p.get("source_url"),
            )
            for p in points
        ]

    return InsightFinancialsOut(
        entity_name=fin.entity_name,
        cik=fin.cik,
        currency=fin.currency or "USD",
        company_url=(
            f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={int(fin.cik)}&type=10-K"
            if fin.cik and fin.cik.isdigit()
            else None
        ),
        fetched_at=fin.fetched_at.isoformat() if fin.fetched_at else None,
        fetch_status=fin.fetch_status,
        health=FinancialHealthOut(
            label=fin.health_label or "insufficient_data",
            reasons=fin.health_reasons or [],
            revenue_growth=fin.revenue_growth,
            net_margin=fin.net_margin,
            period_end=fin.health_period_end,
        ),
        metrics=metrics,
    )


@router.get("/organizations", response_model=InsightsResponseOut)
def list_organization_insights(
    owner_scope: str = Query("mine", description="Scope: 'mine' (owner_id=current user) or 'all'"),
    ids: Optional[str] = Query(None, description="Comma-separated organization IDs to restrict to"),
    organization_type: Optional[str] = Query(None, description="Filter by category"),
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Aggregate organization + linked SEC financials data for Analytics and comparison views."""
    query = db.query(Organization).filter(Organization.is_deleted.is_(False))

    if owner_scope == "mine" and current_user.role != "ADMIN":
        query = query.filter(Organization.owner_id == current_user.id)

    id_list: List[int] = []
    if ids:
        for part in ids.split(","):
            part = part.strip()
            if part.isdigit():
                id_list.append(int(part))
        if id_list:
            query = query.filter(Organization.id.in_(id_list))

    if organization_type and organization_type.strip():
        query = query.filter(Organization.organization_type == organization_type.strip())

    total = query.count()
    truncated = total > MAX_ORGANIZATIONS

    orgs = query.order_by(func.lower(Organization.name).asc()).limit(MAX_ORGANIZATIONS).all()

    org_ids = [org.id for org in orgs]
    financials_by_org = {}
    if org_ids:
        rows = (
            db.query(OrganizationFinancials)
            .filter(OrganizationFinancials.organization_id.in_(org_ids))
            .all()
        )
        financials_by_org = {row.organization_id: row for row in rows}

    items = []
    for org in orgs:
        fin = financials_by_org.get(org.id)
        items.append(
            InsightOrganizationOut(
                id=org.id,
                name=org.name,
                organization_type=org.organization_type,
                industry=org.industry,
                priority=org.priority,
                status=org.status,
                city=org.city,
                state=org.state,
                country=org.country,
                owner_id=org.owner_id,
                owner_name=org.owner_name,
                created_at=org.created_at,
                financials=_to_insight_financials(fin) if fin is not None else None,
            )
        )

    return InsightsResponseOut(
        items=items,
        truncated=truncated,
        limit=MAX_ORGANIZATIONS,
        owner_scope=owner_scope,
    )
