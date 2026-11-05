"""
SEC EDGAR XBRL company-facts fetch + rule-based financial health scoring.

Public, no API key: https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json
SEC requires an identifying User-Agent on every request.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

SEC_USER_AGENT = "ELLY-BD-Portal research@elly-bd-portal.app"

# us-gaap XBRL concepts that map to each tracked metric, in preference order.
METRIC_CONCEPTS: Dict[str, List[str]] = {
    "revenue": [
        "Revenues",
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
        "SalesRevenueNet",
    ],
    "net_income": ["NetIncomeLoss", "ProfitLoss"],
    "total_assets": ["Assets"],
    "total_liabilities": ["Liabilities"],
    "cash": [
        "CashAndCashEquivalentsAtCarryingValue",
        "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    ],
}

# Annual filings only, so year-over-year comparisons are apples-to-apples.
ANNUAL_FORMS = {"10-K", "10-K/A"}

STALE_AFTER_DAYS = 400


class SecEdgarError(Exception):
    pass


def normalize_cik(raw_cik: str) -> str:
    digits = "".join(ch for ch in str(raw_cik or "").strip() if ch.isdigit())
    if not digits:
        raise SecEdgarError("CIK must contain at least one digit.")
    return f"{int(digits):010d}"


async def fetch_company_facts(padded_cik: str) -> dict:
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{padded_cik}.json"
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url, headers={"User-Agent": SEC_USER_AGENT})
        if resp.status_code == 404:
            raise SecEdgarError(f"No SEC EDGAR filings found for CIK {padded_cik}.")
        resp.raise_for_status()
        return resp.json()


def _filing_source_url(cik_num: int, accession: str) -> str:
    if not accession:
        return f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik_num}&type=10-K"
    accession_nodash = accession.replace("-", "")
    return f"https://www.sec.gov/Archives/edgar/data/{cik_num}/{accession_nodash}/{accession}-index.htm"


def _extract_metric_points(facts: dict, concepts: List[str], cik_num: int) -> List[dict]:
    us_gaap = facts.get("facts", {}).get("us-gaap", {})
    by_period: Dict[str, dict] = {}

    # Concepts are tried in preference order, but a company often switches tags
    # over time (e.g. Apple: Revenues -> RevenueFromContractWithCustomer... in 2019),
    # so every concept must be scanned and merged - a higher-priority concept's
    # periods win, lower-priority concepts only fill years it doesn't cover.
    for concept in concepts:
        concept_data = us_gaap.get(concept)
        if not concept_data:
            continue

        concept_periods: Dict[str, dict] = {}
        for unit_values in concept_data.get("units", {}).values():
            for item in unit_values:
                form = item.get("form", "")
                fiscal_period = item.get("fp", "")
                period_end = item.get("end")
                period_start = item.get("start")
                filed = item.get("filed")
                value = item.get("val")
                if (
                    form not in ANNUAL_FORMS
                    or fiscal_period != "FY"
                    or not period_end
                    or not filed
                    or value is None
                ):
                    continue
                # Duration facts (revenue, net income, ...) can appear inside a 10-K's
                # "selected quarterly data" footnote tagged with the filing's own fp="FY" —
                # only the fact's own start/end tells us whether it actually spans a full year.
                if period_start:
                    try:
                        span_days = (
                            datetime.strptime(period_end, "%Y-%m-%d")
                            - datetime.strptime(period_start, "%Y-%m-%d")
                        ).days
                    except ValueError:
                        continue
                    if not (330 <= span_days <= 380):
                        continue
                existing = concept_periods.get(period_end)
                if existing and existing["filed"] >= filed:
                    continue
                accession = item.get("accn", "")
                concept_periods[period_end] = {
                    "period_end": period_end,
                    "fiscal_year": item.get("fy"),
                    "value": float(value),
                    "concept": concept,
                    "form": form,
                    "filed": filed,
                    "accession": accession,
                    "source_url": _filing_source_url(cik_num, accession),
                }

        for period_end, point in concept_periods.items():
            if period_end not in by_period:
                by_period[period_end] = point

    return sorted(by_period.values(), key=lambda p: p["period_end"], reverse=True)


def compute_health(metrics: Dict[str, List[dict]]) -> dict:
    revenue_points = metrics.get("revenue", [])
    net_income_points = metrics.get("net_income", [])

    if not revenue_points:
        return {
            "label": "insufficient_data",
            "reasons": ["No annual revenue figures found in SEC filings for this company."],
            "revenue_growth": None,
            "net_margin": None,
            "period_end": None,
        }

    latest = revenue_points[0]
    period_end = latest["period_end"]

    age_days: Optional[int] = None
    try:
        latest_date = datetime.strptime(period_end, "%Y-%m-%d")
        age_days = (datetime.now(timezone.utc).replace(tzinfo=None) - latest_date).days
    except ValueError:
        pass

    if age_days is not None and age_days > STALE_AFTER_DAYS:
        return {
            "label": "stale",
            "reasons": [f"Latest filed figures are from {period_end}, more than a year old."],
            "revenue_growth": None,
            "net_margin": None,
            "period_end": period_end,
        }

    revenue_growth = None
    if len(revenue_points) > 1 and revenue_points[1]["value"]:
        prev = revenue_points[1]
        revenue_growth = (latest["value"] - prev["value"]) / abs(prev["value"])

    net_margin = None
    matching_net_income = next(
        (p for p in net_income_points if p["period_end"] == period_end), None
    )
    if matching_net_income is not None and latest["value"]:
        net_margin = matching_net_income["value"] / abs(latest["value"])

    if revenue_growth is None or net_margin is None:
        return {
            "label": "insufficient_data",
            "reasons": ["Not enough filed history to assess revenue growth and net margin together."],
            "revenue_growth": revenue_growth,
            "net_margin": net_margin,
            "period_end": period_end,
        }

    if revenue_growth >= 0.05 and net_margin >= 0.05:
        label = "strong"
        reason = f"Revenue grew {revenue_growth * 100:.1f}% year over year with a {net_margin * 100:.1f}% net margin."
    elif revenue_growth < 0 and net_margin < 0:
        label = "weak"
        reason = (
            f"Revenue declined {abs(revenue_growth) * 100:.1f}% year over year "
            f"with a negative {abs(net_margin) * 100:.1f}% net margin."
        )
    else:
        label = "mixed"
        reason = (
            f"Revenue growth of {revenue_growth * 100:.1f}% and net margin of "
            f"{net_margin * 100:.1f}% point in different directions."
        )

    return {
        "label": label,
        "reasons": [reason],
        "revenue_growth": revenue_growth,
        "net_margin": net_margin,
        "period_end": period_end,
    }


async def fetch_financials_for_cik(raw_cik: str) -> dict:
    """Fetch + normalize SEC EDGAR company facts for a CIK, plus a rule-based health label."""
    padded = normalize_cik(raw_cik)
    cik_num = int(padded)

    facts = await fetch_company_facts(padded)
    entity_name = facts.get("entityName")

    metrics: Dict[str, List[dict]] = {}
    for key, concepts in METRIC_CONCEPTS.items():
        points = _extract_metric_points(facts, concepts, cik_num)
        if points:
            metrics[key] = points

    health = compute_health(metrics)

    return {
        "cik": padded,
        "entity_name": entity_name,
        "currency": "USD",
        "company_url": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik_num}&type=10-K&dateb=&owner=include&count=40",
        "dataset_url": f"https://data.sec.gov/api/xbrl/companyfacts/CIK{padded}.json",
        "metrics": metrics,
        "health": health,
    }
