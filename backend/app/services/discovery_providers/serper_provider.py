import re
from typing import List, Dict, Any, Optional, Tuple
import logging
import httpx
from app.services.discovery_providers.base import BaseOrganizationDiscoveryProvider
from app.services.discovery_providers.ai_qualification import qualify_organization
from app.services.discovery_providers.tavily_provider import (
    _extract_org_name, _detect_org_type, _extract_location, _is_article,
    EMAIL_RE, PHONE_RE,
)
from app.services.discovery_providers.organization_validator import organization_validator
from app.core.config import settings

logger = logging.getLogger(__name__)

SERPER_SEARCH_URL = "https://google.serper.dev/search"

COUNTRY_CODES = {
    "india": "in", "united states": "us", "usa": "us", "united kingdom": "gb",
    "uk": "gb", "canada": "ca", "australia": "au", "germany": "de",
    "france": "fr", "japan": "jp", "singapore": "sg", "uae": "ae",
    "saudi arabia": "sa", "brazil": "br", "south korea": "kr",
    "china": "cn", "south africa": "za", "mexico": "mx", "netherlands": "nl",
}


class SerperSearchProvider(BaseOrganizationDiscoveryProvider):
    """
    Real-time B2B lead discovery via Serper (Google Search) API.
    """

    def __init__(self):
        self._api_key = settings.SERPER_API_KEY

    @property
    def provider_name(self) -> str:
        return "Serper Google Search"

    @property
    def provider_type(self) -> str:
        return "web_search"

    def _build_query(
        self,
        keyword: Optional[str] = None,
        location: Optional[str] = None,
        organization_type: Optional[str] = None,
    ) -> str:
        parts = []
        if organization_type and organization_type.strip() and organization_type.strip() != "All":
            parts.append(organization_type.strip())
        if keyword and keyword.strip() and len(keyword.strip()) >= 3:
            parts.append(keyword.strip())
        if location and location.strip() and len(location.strip()) >= 3:
            parts.append(location.strip())
        parts.append("official site contact")
        return " ".join(parts)

    def _get_country_code(self, location: Optional[str]) -> str:
        if not location:
            return "us"
        return COUNTRY_CODES.get(location.strip().lower(), "us")

    def _parse_result(
        self,
        item: Dict[str, Any],
        location_hint: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        title = item.get("title", "").strip()
        url = item.get("link", "")
        snippet = item.get("snippet", "")
        if not title or not url:
            return None
        if _is_article(title, url):
            return None

        name = _extract_org_name(title, url)
        org_type = _detect_org_type(title, snippet)
        loc = _extract_location(snippet, location_hint)

        emails = EMAIL_RE.findall(snippet)
        phones = PHONE_RE.findall(snippet)

        # Clean snippet
        desc = re.sub(r"#{1,6}\s*", "", snippet)
        desc = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", desc)
        desc = re.sub(r"\s+", " ", desc).strip()[:400]

        org = {
            "name": name,
            "organization_type": org_type,
            "website": url,
            "description": desc,
            "country": loc.get("country"),
            "city": loc.get("city"),
            "email": emails[0] if emails else None,
            "phone": phones[0].strip() if phones else None,
            "source_type": "web_search",
            "source_name": "Serper Google Search",
            "source_url": url,
        }

        # Validate through quality gate
        is_valid, reason, normalized = organization_validator.validate(org)
        if not is_valid:
            logger.debug("Serper rejected: %s — %s", name, reason)
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
            logger.warning("SERPER_API_KEY not configured — skipping Serper search")
            return [], 0

        query = self._build_query(keyword, location, organization_type)
        country_code = self._get_country_code(location)

        try:
            resp = httpx.post(
                SERPER_SEARCH_URL,
                json={
                    "q": query,
                    "gl": country_code,
                    "hl": "en",
                    "num": min(limit + 10, 20),
                },
                headers={
                    "Content-Type": "application/json",
                    "X-API-KEY": self._api_key,
                },
                timeout=15.0,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.error(f"Serper search failed: {e}")
            return [], 0

        raw_results = data.get("organic", [])
        parsed = []
        for item in raw_results:
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
        paginated = unique[offset : offset + limit]

        # Scrape top results for enriched data (best-effort, max 3)
        try:
            from app.core.config import settings as _cfg
            if _cfg.SCRAPEGRAPH_ENABLED:
                from app.services.scrapegraph_provider import scrape_organization, enrich_scraped_data
                for org in paginated[:3]:
                    url = org.get("website", "")
                    if url and url.startswith("http"):
                        scraped = scrape_organization(url)
                        if scraped:
                            org.update(enrich_scraped_data(scraped, org))
        except Exception as e:
            logger.debug(f"Scrapegraph enrichment skipped: {e}")

        qualified = []
        for raw_org in paginated:
            fit_level, score, reason = qualify_organization(
                raw_org,
                product_description=product_description,
                target_icp=target_icp,
                discovery_objective=discovery_objective,
            )
            item = dict(raw_org)
            item["potential_fit"] = fit_level
            item["potential_fit_score"] = score
            item["qualification_reason"] = reason
            item["product_description"] = product_description
            item["target_icp"] = target_icp
            item["discovery_objective"] = discovery_objective
            qualified.append(item)

        qualified.sort(key=lambda x: x.get("potential_fit_score", 50), reverse=True)
        return qualified, total

    def get_organization_details(self, external_id: str) -> Optional[Dict[str, Any]]:
        return None
