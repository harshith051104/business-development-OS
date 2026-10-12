"""
Investor & VC Discovery provider — finds angel investors, VC firms and funds via
Tavily web search, for the funding/investor outreach flow (not client discovery).

Same shape as TavilySearchProvider (search -> parse -> validate -> qualify), just a
different target query and organization_type label. Registered standalone in
registry.py — never in the default client-discovery chain.
"""
import re
from typing import Any, Dict, List, Optional, Tuple
import logging
import httpx
from urllib.parse import urlparse

from app.services.discovery_providers.base import BaseOrganizationDiscoveryProvider
from app.services.discovery_providers.ai_qualification import qualify_organization
from app.services.discovery_providers.organization_validator import organization_validator
from app.services.discovery_providers.tavily_provider import (
    _extract_org_name,
    _is_article,
    EMAIL_RE,
    PHONE_RE,
)
from app.core.config import settings

logger = logging.getLogger(__name__)

TAVILY_SEARCH_URL = "https://api.tavily.com/search"

INVESTOR_TYPE_MAP = {
    "angel investor": "Angel Investor",
    "angel network": "Angel Network",
    "venture capital": "Venture Capital Firm",
    "venture partner": "Venture Capital Firm",
    "vc firm": "Venture Capital Firm",
    "seed fund": "Seed Fund",
    "seed investor": "Seed Fund",
    "private equity": "Private Equity Firm",
    "family office": "Family Office",
    "accelerator": "Accelerator / Incubator",
    "incubator": "Accelerator / Incubator",
}


def _detect_investor_type(title: str, content: str) -> str:
    combined = f"{title} {content}".lower()
    for pattern, inv_type in INVESTOR_TYPE_MAP.items():
        if pattern in combined:
            return inv_type
    return "Investor"


class InvestorDiscoveryProvider(BaseOrganizationDiscoveryProvider):
    """
    Finds angel investors / VC firms / funds matching a sector, stage and location,
    for the dedicated Funding outreach flow. Reuses the same validate/qualify
    pipeline as client discovery so results flow through DiscoveryOrchestrator
    unchanged; distinguished only via `source_name` / `organization_type`.
    """

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or getattr(settings, "TAVILY_API_KEY", "")

    @property
    def provider_name(self) -> str:
        return "Investor & VC Discovery"

    @property
    def provider_type(self) -> str:
        return "investor_search"

    def _build_query(
        self,
        keyword: Optional[str] = None,
        location: Optional[str] = None,
        organization_type: Optional[str] = None,
        target_icp: Optional[str] = None,
    ) -> str:
        parts = ["venture capital firm OR angel investor OR seed fund"]
        sector = (keyword or organization_type or target_icp or "").strip()
        if sector and sector != "All":
            parts.append(f"investing in {sector}")
        if location and location.strip():
            parts.append(location.strip())
        parts.append("site:.com OR site:.vc")
        parts.append('"portfolio" OR "invest" OR "contact"')
        return " ".join(parts)

    def _parse_result(self, item: Dict[str, Any], location_hint: Optional[str] = None) -> Optional[Dict[str, Any]]:
        title = item.get("title", "").strip()
        url = item.get("url", "")
        content = item.get("content", "")
        if not title or not url:
            return None
        if _is_article(title, url):
            return None

        name = _extract_org_name(title, url)
        inv_type = _detect_investor_type(title, content)

        emails = EMAIL_RE.findall(content)
        phones = PHONE_RE.findall(content)
        email = emails[0] if emails else None
        phone = phones[0].strip() if phones else None

        desc = re.sub(r"#{1,6}\s*", "", content)
        desc = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", desc)
        desc = re.sub(r"\s+", " ", desc).strip()
        sentences = re.split(r"(?<=[.!?])\s+", desc)
        desc = " ".join(sentences[:2])[:400]

        org = {
            "name": name,
            "organization_type": inv_type,
            "industry": "Investment",
            "website": url,
            "description": desc,
            "city": (location_hint or "").strip() or None,
            "email": email,
            "phone": phone,
            "source_type": "investor_search",
            "source_name": "Investor & VC Discovery",
            "source_url": url,
        }

        is_valid, reason, normalized = organization_validator.validate(org)
        if not is_valid:
            logger.debug("Investor discovery rejected: %s — %s", name, reason)
            return None
        return normalized

    def search_organizations(
        self,
        keyword: Optional[str] = None,
        location: Optional[str] = None,
        organization_type: Optional[str] = None,
        product_description: Optional[str] = None,
        target_icp: Optional[str] = None,
        discovery_objective: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> Tuple[List[Dict[str, Any]], int]:
        if not self._api_key:
            logger.warning("TAVILY_API_KEY not configured — skipping investor search")
            return [], 0

        query = self._build_query(keyword, location, organization_type, target_icp)

        try:
            resp = httpx.post(
                TAVILY_SEARCH_URL,
                json={
                    "query": query,
                    "search_depth": "advanced",
                    "include_answer": False,
                    "max_results": min(limit + 10, 20),
                },
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self._api_key}",
                },
                timeout=15.0,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.error(f"Investor discovery search failed: {e}")
            return [], 0

        parsed = []
        for item in data.get("results", []):
            parsed_item = self._parse_result(item, location_hint=location)
            if parsed_item:
                parsed.append(parsed_item)

        seen = set()
        unique = []
        for p in parsed:
            key = p["name"].lower().strip()
            if key not in seen and len(key) > 2:
                seen.add(key)
                unique.append(p)

        total = len(unique)
        paginated = unique[offset: offset + limit]

        qualified = []
        for raw_org in paginated:
            fit_level, score, reason = qualify_organization(
                raw_org,
                product_description=product_description or "Securing funding, strategic connections and investor communication for our company.",
                target_icp=target_icp or "Angel investors, VCs and funds relevant to our sector and stage",
                discovery_objective=discovery_objective or "Raise funding / build investor relationships",
            )
            item = dict(raw_org)
            item["potential_fit"] = fit_level
            item["potential_fit_score"] = score
            item["qualification_reason"] = reason
            qualified.append(item)

        qualified.sort(key=lambda x: x.get("potential_fit_score", 50), reverse=True)
        return qualified, total

    def get_organization_details(self, external_id: str) -> Optional[Dict[str, Any]]:
        return None
