import re
from typing import List, Dict, Any, Optional, Tuple
import logging
import httpx
from urllib.parse import urlparse
from app.services.discovery_providers.base import BaseOrganizationDiscoveryProvider
from app.services.discovery_providers.ai_qualification import qualify_organization
from app.services.discovery_providers.organization_validator import organization_validator
from app.core.config import settings

logger = logging.getLogger(__name__)

TAVILY_SEARCH_URL = "https://api.tavily.com/search"

# Patterns that indicate articles/news, not org pages
SKIP_PATTERNS = re.compile(
    r"(best\s+\w+\s+(?:in|for|of|providers|hospitals|groups|companies|solutions|services)|"
    r"top\s+\d+|listicle|guide|tutorial|"
    r"how\s+to|what\s+is|news|blog|article|review|comparison|"
    r"\d{4}\s+guide|\d{4}\s+list|\d{4}\s+best|"
    r"hospitals?\s+in\s+\w+|"
    r"(?:ways|methods)\s+(?:india|to)\s+|"
    r"\d+\s+(?:cybersecurity|software|companies|tech|healthcare|finance)\s+companies|"
    r"(?:to\s+know|in\s+(?:the\s+)?(?:uk|us|usa|india|australia|germany|canada))|"
    r"industry\s+analysis|industry\s+report|market\s+report|"
    r"(?:leading|top|best)\s+(?:outsourced|uk|us|indian))",
    re.IGNORECASE,
)

# Patterns that suggest actual org pages
ORG_SIGNALS = re.compile(
    r"(/\s*(about|contact|services|solutions|company)\s*/?$|"
    r"\.(com|org|io|net|co)/?$)",
    re.IGNORECASE,
)

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
# Phone: requires 7-15 digits, allows common separators, rejects ZIP codes and truncated
PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[\s\-]?)?"           # optional country code
    r"(?:\(\d{2,4}\)[\s\-]?)?"           # optional area code in parens
    r"\d{2,4}[\s\-.]?\d{2,4}[\s\-.]?\d{2,4}"  # main number
)

# Location extraction from content
LOCATION_PATTERNS = [
    re.compile(r"based\s+in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", re.IGNORECASE),
    re.compile(r"headquartered\s+in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", re.IGNORECASE),
    re.compile(r"located\s+in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", re.IGNORECASE),
    re.compile(r"serves?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:and|region|market)", re.IGNORECASE),
]

# Org type detection
ORG_TYPE_MAP = {
    "hospital": "Hospital",
    "hospital group": "Hospital Group",
    "health system": "Hospital Group",
    "healthcare system": "Hospital Group",
    "clinic": "Clinic",
    "pharmaceutical": "Pharmaceutical Company",
    "pharma": "Pharmaceutical Company",
    "biotech": "Biotechnology Company",
    "diagnostic": "Diagnostic Center",
    "laboratory": "Laboratory",
    "medical device": "Medical Equipment Company",
    "health tech": "Healthcare Technology Company",
    "healthcare technology": "Healthcare Technology Company",
    "digital health": "Healthcare Technology Company",
    "telehealth": "Healthcare Technology Company",
    "telemedicine": "Healthcare Technology Company",
    "insurance": "Insurance Company",
    "health insurance": "Health Insurance",
    "saas": "SaaS Company",
    "software": "Software Company",
    "technology": "Technology Company",
    "ai company": "AI Company",
    "artificial intelligence": "AI Company",
    "machine learning": "AI Company",
    "fintech": "Fintech Company",
    "financial services": "Financial Services",
    "banking": "Banking",
    "manufacturing": "Manufacturing",
    "industrial": "Industrial",
    "automotive": "Automotive",
    "retail": "Retail",
    "e-commerce": "E-commerce",
    "logistics": "Logistics",
    "energy": "Energy",
    "consulting": "Consulting",
}


def _split_camel_case(s: str) -> str:
    """Split camelCase or PascalCase into words: 'MayoClinic' → 'Mayo Clinic'."""
    return re.sub(r"([a-z])([A-Z])", r"\1 \2", s)


def _extract_org_name(title: str, url: str) -> str:
    """Extract clean org name from title and URL."""
    # Clean title first — usually has proper spacing
    name = title
    for sep in [" | ", " - ", " \u2013 ", " \u2014 ", " // ", " :: "]:
        name = name.split(sep)[0]
    for phrase in ["Home", "Homepage", "Official Site", "Contact Us", "About Us",
                    "Services", "Solutions", "Welcome to", "Locations"]:
        name = re.sub(rf"\b{re.escape(phrase)}\b.*$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\s*\d{4}\s*$", "", name)
    name = re.sub(r"^\s*(The|A|An)\s+", "", name)
    # Remove parenthetical notes like "(mentioned in ...)"
    name = re.sub(r"\s*\([^)]*\)\s*$", "", name)
    # Remove trailing article references like "to Know", "to Check Out"
    name = re.sub(r"\s*(?:to\s+Know|to\s+Check\s+Out|to\s+Watch|Overview|Profile).*$", "", name, flags=re.IGNORECASE)
    name = name.strip()
    # If title gave a reasonable name, use it
    if len(name) > 3 and not SKIP_PATTERNS.search(name):
        return name

    # Fallback to URL domain
    domain = urlparse(url).netloc.replace("www.", "").split(".")[0]
    if len(domain) > 2:
        name = _split_camel_case(domain).title()
        if len(name) > 3:
            return name

    return name if len(name) > 3 else domain.title()


def _detect_org_type(title: str, content: str) -> str:
    """Detect org type from title, content, or URL."""
    combined = f"{title} {content}".lower()
    for pattern, org_type in ORG_TYPE_MAP.items():
        if pattern in combined:
            return org_type
    # URL path hints
    url_hints = {
        "/hospital": "Hospital",
        "/clinic": "Clinic",
        "/pharma": "Pharmaceutical Company",
        "/diagnostic": "Diagnostic Center",
        "/health-tech": "Healthcare Technology Company",
        "/healthtech": "Healthcare Technology Company",
        "/digital-health": "Healthcare Technology Company",
        "/insurance": "Health Insurance",
    }
    title_lower = title.lower()
    for hint, org_type in url_hints.items():
        if hint in title_lower:
            return org_type
    return "Organization"


def _extract_location(content: str, location_hint: Optional[str] = None) -> Dict[str, str]:
    """Extract country, state, city from content."""
    result = {"country": None, "state": None, "city": None}
    for pat in LOCATION_PATTERNS:
        m = pat.search(content)
        if m:
            result["city"] = m.group(1).strip()
            break
    if location_hint:
        loc = location_hint.strip()
        # Check if it's a country or city
        countries = ["usa", "us", "united states", "uk", "united kingdom", "india",
                      "canada", "australia", "germany", "france", "japan", "singapore",
                      "uae", "saudi arabia", "brazil", "south korea", "china",
                      "south africa", "mexico", "netherlands"]
        if loc.lower() in countries:
            result["country"] = loc
        else:
            result["city"] = loc
    return result


def _is_article(title: str, url: str) -> bool:
    """Check if the result is an article/blog post rather than an org page."""
    if SKIP_PATTERNS.search(title):
        return True
    skip_domains = [
        "wikipedia.org", "reddit.com", "youtube.com", "twitter.com",
        "facebook.com", "linkedin.com/pulse", "medium.com",
        "forbes.com", "bloomberg.com", "reuters.com",
        "instagram.com", "pinterest.com", "tiktok.com",
    ]
    url_lower = url.lower()
    if any(d in url_lower for d in skip_domains):
        return True
    # Blog/news paths
    if any(p in url_lower for p in ["/blog/", "/news/", "/article/", "/post/", "/story/", "/pressrelease"]):
        return True
    return False


class TavilySearchProvider(BaseOrganizationDiscoveryProvider):
    """
    Real-time B2B lead discovery via Tavily web search API.
    Searches the live web for organizations matching the query criteria.
    """

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or getattr(settings, "TAVILY_API_KEY", "")

    @property
    def provider_name(self) -> str:
        return "Tavily Web Search"

    @property
    def provider_type(self) -> str:
        return "web_search"

    def _build_query(
        self,
        keyword: Optional[str] = None,
        location: Optional[str] = None,
        organization_type: Optional[str] = None,
    ) -> str:
        """Build targeted queries that find actual org pages, not articles."""
        parts = []
        if organization_type and organization_type.strip() and organization_type.strip() != "All":
            parts.append(organization_type.strip())
        if keyword and keyword.strip() and len(keyword.strip()) >= 3:
            parts.append(keyword.strip())
        if location and location.strip() and len(location.strip()) >= 3:
            parts.append(location.strip())
        # Add site hints to find actual company pages
        parts.append("site:.com OR site:.org")
        parts.append('"contact us" OR "about us" OR "our services"')
        return " ".join(parts)

    def _parse_result(
        self,
        item: Dict[str, Any],
        location_hint: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        title = item.get("title", "").strip()
        url = item.get("url", "")
        content = item.get("content", "")
        if not title or not url:
            return None
        if _is_article(title, url):
            return None

        name = _extract_org_name(title, url)
        # Detect org type from title + content + URL
        org_type = _detect_org_type(title, content)
        if org_type == "Organization":
            org_type = _detect_org_type(url, content)
        loc = _extract_location(content, location_hint)

        # Extract contacts from content
        emails = EMAIL_RE.findall(content)
        phones = PHONE_RE.findall(content)
        email = emails[0] if emails else None
        phone = phones[0].strip() if phones else None

        # Clean description — first 2 meaningful sentences
        desc = re.sub(r"#{1,6}\s*", "", content)
        desc = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", desc)
        desc = re.sub(r"\s+", " ", desc).strip()
        sentences = re.split(r"(?<=[.!?])\s+", desc)
        desc = " ".join(sentences[:2])[:400]

        org = {
            "name": name,
            "organization_type": org_type,
            "website": url,
            "description": desc,
            "country": loc.get("country"),
            "city": loc.get("city"),
            "email": email,
            "phone": phone,
            "source_type": "web_search",
            "source_name": "Tavily Web Search",
            "source_url": url,
        }

        # Validate through quality gate
        is_valid, reason, normalized = organization_validator.validate(org)
        if not is_valid:
            logger.debug("Tavily rejected: %s — %s", name, reason)
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
            logger.warning("TAVILY_API_KEY not configured — skipping Tavily search")
            return [], 0

        query = self._build_query(keyword, location, organization_type)

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
            logger.error(f"Tavily search failed: {e}")
            return [], 0

        raw_results = data.get("results", [])
        parsed = []
        for item in raw_results:
            parsed_item = self._parse_result(item, location_hint=location)
            if parsed_item:
                parsed.append(parsed_item)

        # Deduplicate by normalized name
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

        # Apply AI qualification
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
