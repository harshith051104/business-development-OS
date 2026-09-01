"""
Free-first public web contact discovery provider.

Uses ONLY publicly available information from:
  - Organization website (leadership/team pages)
  - Tavily web search
  - Serper Google search

No paid API required. Never fabricates contacts.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from app.services.enrichment.base import (
    ContactEnrichment,
    ContactEnrichmentProvider,
    EnrichmentResult,
)

logger = logging.getLogger(__name__)

LEADERSHIP_PATHS = [
    "/about", "/about-us", "/team", "/leadership", "/management",
    "/contact", "/our-team", "/leadership-team", "/executive-team",
    "/about/team", "/about/leadership", "/company/leadership",
    "/people", "/our-people", "/executives",
]

ROLE_SEARCH_QUERIES = [
    "{org} CTO",
    "{org} Chief Technology Officer",
    "{org} CIO",
    "{org} Chief Information Officer",
    "{org} CDO",
    "{org} Chief Digital Officer",
    "{org} CEO",
    "{org} Managing Director",
    "{org} Head of IT",
    "{org} Head of Innovation",
    "{org} Head of Digital Transformation",
    "{org} Head of Partnerships",
    "{org} VP of Business Development",
    "{org} leadership team",
]

ROLE_NORMALIZE = {
    "chief executive officer": "CEO", "ceo": "CEO",
    "managing director": "Managing Director",
    "chief technology officer": "CTO", "cto": "CTO",
    "chief information officer": "CIO", "cio": "CIO",
    "chief digital officer": "CDO", "cdo": "CDO",
    "chief medical officer": "CMO", "cmo": "CMO",
    "chief operating officer": "COO", "coo": "COO",
    "head of it": "Head of IT", "head of technology": "Head of IT",
    "head of innovation": "Head of Innovation",
    "head of digital transformation": "Head of Digital Transformation",
    "head of partnerships": "Head of Partnerships",
    "head of business development": "Head of Business Development",
    "director": "Director", "vp": "VP", "vice president": "VP",
}

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_REGEX = re.compile(r"(?:\+?\d{1,3}[\s\-]?)?(?:\(\d{2,4}\)[\s\-]?)?\d{2,4}[\s\-.]?\d{2,4}[\s\-.]?\d{2,4}")
NAME_REGEX = re.compile(r"(?:Dr\.|Mr\.|Ms\.|Mrs\.|Prof\.)?\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3})")


def _normalize_role(title: str) -> str:
    t = title.lower().strip()
    for pattern, normalized in ROLE_NORMALIZE.items():
        if pattern in t:
            return normalized
    return title.strip()


def _extract_emails(text: str) -> List[str]:
    if not text:
        return []
    found = EMAIL_REGEX.findall(text)
    return [e for e in found if not e.endswith((".png", ".jpg", ".gif", ".css", ".js"))]


def _extract_phones(text: str) -> List[str]:
    if not text:
        return []
    found = PHONE_REGEX.findall(text)
    return [p.strip() for p in found if len(re.sub(r'\D', '', p)) >= 8]


def _is_leadership_context(text: str) -> bool:
    keywords = ["leadership", "team", "executive", "management", "director", "officer", "founder"]
    t = text.lower()
    return any(k in t for k in keywords)


class PublicWebContactProvider(ContactEnrichmentProvider):
    """
    Free-first contact discovery using public web sources.

    Searches organization websites for leadership/team pages,
    extracts publicly available names, roles, emails, and phones.
    Never fabricates contacts.
    """

    def __init__(self):
        pass

    @property
    def provider_name(self) -> str:
        return "Public Web Contact Discovery"

    @property
    def is_available(self) -> bool:
        from app.core.config import settings
        return bool(settings.TAVILY_API_KEY or settings.SERPER_API_KEY)

    def _search_web(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search the web using available providers."""
        results = []
        from app.core.config import settings

        # Try Tavily first
        if settings.TAVILY_API_KEY:
            try:
                import httpx
                with httpx.Client(timeout=15.0) as client:
                    resp = client.post(
                        "https://api.tavily.com/search",
                        json={"api_key": settings.TAVILY_API_KEY, "query": query, "max_results": limit},
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        for r in data.get("results", []):
                            results.append({
                                "url": r.get("url", ""),
                                "title": r.get("title", ""),
                                "snippet": r.get("content", ""),
                                "content": r.get("content", ""),
                            })
            except Exception as e:
                logger.debug("Tavily search failed: %s", e)

        # Try Serper if Tavily returned nothing
        if not results and settings.SERPER_API_KEY:
            try:
                import httpx
                with httpx.Client(timeout=15.0) as client:
                    resp = client.post(
                        "https://google.serper.dev/search",
                        headers={"X-API-KEY": settings.SERPER_API_KEY, "Content-Type": "application/json"},
                        json={"q": query, "num": limit},
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        for r in data.get("organic", []):
                            results.append({
                                "url": r.get("link", ""),
                                "title": r.get("title", ""),
                                "snippet": r.get("snippet", ""),
                                "content": r.get("snippet", ""),
                            })
            except Exception as e:
                logger.debug("Serper search failed: %s", e)

        return results

    def _scrape_url(self, url: str) -> str:
        """Scrape text content from a URL."""
        try:
            import httpx
            with httpx.Client(timeout=15.0, follow_redirects=True) as client:
                resp = client.get(url, headers={"User-Agent": "ELLY-BD/1.0"})
                if resp.status_code == 200:
                    # Basic HTML stripping
                    text = resp.text
                    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.DOTALL | re.IGNORECASE)
                    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
                    text = re.sub(r"<[^>]+>", " ", text)
                    text = re.sub(r"\s+", " ", text).strip()
                    return text[:10000]
        except Exception as e:
            logger.debug("Failed to scrape %s: %s", url, e)
        return ""

    def _extract_contacts_from_text(
        self, text: str, org_name: str, source_url: str, source_type: str
    ) -> List[ContactEnrichment]:
        """Extract contact information from text. Only returns what is actually found."""
        contacts = []

        if not text or not _is_leadership_context(text):
            return contacts

        # Extract emails
        emails = _extract_emails(text)
        # Extract phones
        phones = _extract_phones(text)

        # Try to find name + role pairs
        # Look for patterns like "John Smith, CTO" or "John Smith - Chief Technology Officer"
        pair_patterns = [
            re.compile(r"([A-Z][a-z]+\s[A-Z][a-z]+)[,\s]+(?:Chief\s+\w+\s+\w+|CTO|CIO|CDO|CEO|CMO|COO|Head\s+of\s+\w+|Director|VP|Vice\s+President|Managing\s+Director)", re.IGNORECASE),
            re.compile(r"(?:Chief\s+\w+\s+\w+|CTO|CIO|CDO|CEO|CMO|COO|Head\s+of\s+\w+|Director|VP)[,\s\-]+([A-Z][a-z]+\s[A-Z][a-z]+)", re.IGNORECASE),
        ]

        found_pairs = []
        for pattern in pair_patterns:
            for match in pattern.finditer(text):
                groups = match.groups()
                if len(groups) >= 2:
                    name = groups[0].strip() if any(c.isupper() for c in groups[0]) else groups[1].strip()
                    role_text = groups[1].strip() if groups[0] == name else groups[0].strip()
                    role = _normalize_role(role_text)
                    found_pairs.append((name, role))
                elif len(groups) == 1:
                    # Single match - need context
                    start = max(0, match.start() - 50)
                    context = text[start:match.end() + 50]
                    name_match = re.search(r"([A-Z][a-z]+\s[A-Z][a-z]+)", context)
                    role_match = re.search(r"(Chief\s+\w+(?:\s+\w+)?|CTO|CIO|CDO|CEO|CMO|COO|Head\s+of\s+\w+|Director)", context, re.IGNORECASE)
                    if name_match and role_match:
                        found_pairs.append((name_match.group(1), _normalize_role(role_match.group(1))))

        # Deduplicate
        seen = set()
        for name, role in found_pairs:
            key = f"{name.lower()}|{role.lower()}"
            if key in seen:
                continue
            seen.add(key)

            # Find best matching email
            email = None
            email_status = "not_found"
            name_lower = name.lower().replace(" ", "")
            for e in emails:
                local = e.split("@")[0].lower().replace(".", "").replace("-", "")
                if name_lower[:5] in local or local[:5] in name_lower:
                    email = e
                    email_status = "publicly_found"
                    break

            # Find best matching phone
            phone = phones[0] if phones else None
            phone_type = "business_phone" if phone else "not_available"

            contacts.append(ContactEnrichment(
                name=name,
                role=role,
                organization=org_name,
                email=email,
                email_status=email_status,
                phone=phone,
                phone_type=phone_type,
                confidence=70 if email else 50,
                source="public_web",
                source_url=source_url,
                source_type=source_type,
                verification_state="publicly_found" if email else "publicly_found_unverified",
                provider_used="public_web",
            ))

        # If no pairs found but we have emails, create entries for them
        if not contacts and emails:
            for e in emails[:3]:
                contacts.append(ContactEnrichment(
                    name="",
                    role="",
                    organization=org_name,
                    email=e,
                    email_status="publicly_found",
                    confidence=40,
                    source="public_web",
                    source_url=source_url,
                    source_type=source_type,
                    verification_state="publicly_found",
                    provider_used="public_web",
                ))

        return contacts

    def find_contact(
        self,
        organization: str,
        person_name: str = "",
        role: str = "",
        domain: str = "",
    ) -> EnrichmentResult:
        if not self.is_available:
            return EnrichmentResult(
                provider=self.provider_name,
                available=False,
                error="No web search providers configured. Set TAVILY_API_KEY or SERPER_API_KEY.",
            )

        contacts = []

        # Search for the specific person if name provided
        if person_name:
            query = f"{person_name} {role} {organization}" if role else f"{person_name} {organization}"
            results = self._search_web(query, limit=3)
            for r in results:
                url = r.get("url", "")
                snippet = r.get("snippet", "") + " " + r.get("content", "")
                found = self._extract_contacts_from_text(snippet, organization, url, "search_result")
                contacts.extend(found)

        # Search for role at organization
        if role and not contacts:
            query = f"{organization} {role}"
            results = self._search_web(query, limit=3)
            for r in results:
                url = r.get("url", "")
                snippet = r.get("snippet", "") + " " + r.get("content", "")
                found = self._extract_contacts_from_text(snippet, organization, url, "search_result")
                contacts.extend(found)

        # Try organization website leadership pages
        if domain and not contacts:
            base_url = f"https://{domain.replace('https://', '').replace('http://', '').replace('www.', '')}"
            for path in LEADERSHIP_PATHS[:5]:
                url = base_url + path
                text = self._scrape_url(url)
                if text:
                    found = self._extract_contacts_from_text(text, organization, url, "official_website")
                    contacts.extend(found)
                    if contacts:
                        break

        return EnrichmentResult(
            contacts=contacts[:10],
            provider=self.provider_name,
            available=True,
        )

    def enrich_organization_contacts(
        self,
        organization: str,
        contacts: List[Dict[str, str]],
        domain: str = "",
    ) -> EnrichmentResult:
        if not self.is_available:
            return EnrichmentResult(
                provider=self.provider_name,
                available=False,
                error="No web search providers configured.",
            )

        enriched = []
        for contact in contacts:
            name = contact.get("name", "")
            role = contact.get("role", "")
            result = self.find_contact(organization, name, role, domain)
            if result.contacts:
                enriched.extend(result.contacts)

        return EnrichmentResult(
            contacts=enriched,
            provider=self.provider_name,
            available=True,
        )
