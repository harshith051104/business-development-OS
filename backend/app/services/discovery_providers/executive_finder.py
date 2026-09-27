"""
Executive finder — names, roles and contact info for leadership at an organization.

Source order (each verified live; first that yields enough contacts wins):
  1. Serper  — Google `site:linkedin.com/in` results. Structured "Name - Title - Company"
               titles: fastest and most precise source of real people + roles.
  2. Tavily  — web search snippets (leadership / team / about pages, press).
  3. Website — the org's own leadership/team/contact pages (plain HTTP).
  4. ScrapeGraph — LLM page extraction, last resort only (slow; depends on the LLM
               provider being up, so it is never on the primary path).

Only people found in a cited source are returned. Nothing is fabricated; every
contact carries `source` + `source_url`. Emails are only returned when actually
found on a page ("publicly_found"); pattern guesses are added by the caller and
marked "predicted".
"""
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SERPER_URL = "https://google.serper.dev/search"
TAVILY_URL = "https://api.tavily.com/search"

LEADERSHIP_PATHS = [
    "/team", "/leadership", "/about", "/about-us", "/our-team", "/management",
    "/leadership-team", "/executive-team", "/people", "/company/leadership", "/contact", "/contact-us",
]

ROLE_KEYWORDS = (
    r"chief\s+[a-z&]+(?:\s+[a-z&]+)?\s+officer|ceo|cto|cio|cdo|coo|cfo|cmo|cso|"
    r"co-?founder|founder|owner|proprietor|managing\s+director|executive\s+director|"
    r"president|vice\s+president|vp\b|svp|evp|director|head\s+of\s+[a-z&]+(?:\s+[a-z&]+)?|"
    r"general\s+manager|partner\b|principal\b|chairman|chairperson|managing\s+partner"
)
ROLE_RE = re.compile(rf"\b(?:{ROLE_KEYWORDS})", re.IGNORECASE)
TOP_ROLE_RE = re.compile(
    r"\b(?:ceo|chief\s+executive|founder|co-?founder|owner|proprietor|managing\s+director|md\b|"
    r"(?<!vice )(?<!vice-)(?<!assistant vice )president|chairman|chairperson|managing\s+partner)",
    re.IGNORECASE,
)
JUNIOR_ROLE_RE = re.compile(r"\b(?:associate|assistant|deputy|junior|intern|trainee|senior\s+manager)", re.IGNORECASE)

# Tokens that mean "this is not a person's name".
NAME_STOP = {
    "linkedin", "ceo", "cto", "cio", "coo", "cfo", "founder", "cofounder", "team", "company", "private",
    "limited", "pvt", "ltd", "llc", "inc", "executive", "leadership", "management", "officer", "chief",
    "director", "president", "about", "contact", "careers", "jobs", "news", "blog", "home", "our",
    "the", "and", "for", "with", "top", "best", "equity", "insights", "view", "agenda", "terms",
    "policy", "privacy", "accessibility", "services", "solutions", "technologies", "technology",
    "software", "group", "global", "india", "profile", "member", "staff", "employees", "senior",
    "board", "advisor", "advisory", "investor", "startup", "business", "corporate", "corporation",
}
NAME_TOKEN_RE = re.compile(r"^[A-Za-z][A-Za-z'\-\.]{1,}$")
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
JUNK_EMAIL_PARTS = (
    "sentry", "wixpress", "example.", "@2x", "noreply", "no-reply", "donotreply", "u003e",
    "@company.com", "@domain.com", "@email.com", "@yourdomain", "@yourcompany", "@test.com", "@mail.com",
)
ORG_SUFFIX_WORDS = {
    "pvt", "ltd", "llp", "llc", "inc", "limited", "private", "corp", "corporation", "co", "company",
    "technologies", "technology", "solutions", "software", "systems", "services", "india", "the",
}
SEP_RE = re.compile(r"\s+[-–—|·•]\s+")


def _org_tokens(org_name: str) -> List[str]:
    words = re.findall(r"[a-z0-9]+", org_name.lower())
    core = [w for w in words if w not in ORG_SUFFIX_WORDS and len(w) > 1]
    return core or words


def _mentions_org(text: str, org_name: str) -> bool:
    tokens = _org_tokens(org_name)
    if not tokens:
        return False
    low = re.sub(r"[^a-z0-9 ]", " ", text.lower())
    # all core tokens for short names, the first two for long ones
    needed = tokens[:2]
    return all(t in low for t in needed)


def _clean_name(raw: str) -> Optional[str]:
    raw = re.sub(r"\b(?:Dr|Mr|Ms|Mrs|Prof|CA|CS)\.?\s+", "", raw.strip(), flags=re.IGNORECASE)
    raw = re.sub(r"[,(].*$", "", raw).strip()  # drop ", MBA" / "(Sri)" tails
    parts = raw.split()
    if not 2 <= len(parts) <= 4:
        return None
    for p in parts:
        if not NAME_TOKEN_RE.match(p) or p.lower().strip(".") in NAME_STOP:
            return None
    return " ".join(p[:1].upper() + p[1:].lower() if p.islower() or p.isupper() else p for p in parts)


def _clean_role(raw: str) -> str:
    raw = re.split(r"\s+(?:at|@)\s+", raw, maxsplit=1, flags=re.IGNORECASE)[0]
    raw = re.sub(r"\s+", " ", raw).strip(" -–—|,.")
    if len(raw) > 40 and "," in raw:
        raw = raw.split(",")[0]
    return raw[:60].strip(" -–—|,.")


def _seniority_rank(role: str) -> int:
    """0 = owner/C-level, 1 = VP/Director/Head, 2 = other, 3 = junior."""
    if JUNIOR_ROLE_RE.search(role):
        return 3
    if TOP_ROLE_RE.search(role) or re.search(r"\bc[a-z]o\b|chief", role, re.IGNORECASE):
        return 0
    if re.search(r"\b(?:vp|vice\s+president|svp|evp|director|head\s+of|general\s+manager|partner)", role, re.IGNORECASE):
        return 1
    return 2


def _domain(website: str) -> str:
    if not website:
        return ""
    if not website.startswith(("http://", "https://")):
        website = "https://" + website
    try:
        return urlparse(website).netloc.lower().replace("www.", "")
    except Exception:
        return ""


def _valid_email(email: str, domain: str = "") -> bool:
    low = email.lower()
    if low.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js")):
        return False
    return not any(p in low for p in JUNK_EMAIL_PARTS)


# ── generic site email scraping (used for org-level emails) ──────────────────
def _fetch_text(url: str, timeout: float = 8.0) -> str:
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; ELLY-BD/1.0)"})
            if resp.status_code != 200 or "html" not in resp.headers.get("content-type", "html"):
                return ""
            return resp.text[:400_000]
    except Exception:
        return ""


def scrape_site_emails(website: str) -> List[str]:
    """Public emails on the org's own homepage / contact pages. Domain-matching first."""
    domain = _domain(website)
    if not domain:
        return []
    base = f"https://{domain}"
    found: List[str] = []
    for path in ("", "/contact", "/contact-us", "/about"):
        html = _fetch_text(base + path)
        if not html:
            continue
        html = html.replace("&#64;", "@").replace("[at]", "@").replace("(at)", "@")
        for e in EMAIL_RE.findall(html):
            e = e.lower()
            if _valid_email(e) and e not in found:
                found.append(e)
        if found:
            break
    root = ".".join(domain.split(".")[-2:])
    found.sort(key=lambda e: 0 if e.endswith(root) else 1)
    return found[:5]


def fill_missing_org_emails(orgs: List[Dict[str, Any]], workers: int = 8) -> None:
    """In-place: add a public contact email to orgs that have a website but no email."""
    todo = [o for o in orgs if o.get("website") and not o.get("email")]
    if not todo:
        return

    def work(o: Dict[str, Any]) -> None:
        emails = scrape_site_emails(o["website"])
        if emails:
            o["email"] = emails[0]

    with ThreadPoolExecutor(max_workers=workers) as ex:
        list(ex.map(work, todo))


class ExecutiveFinder:
    """Finds leadership contacts for one organization from public web sources."""

    def __init__(self) -> None:
        self.serper_key = settings.SERPER_API_KEY
        self.tavily_key = settings.TAVILY_API_KEY

    @property
    def is_available(self) -> bool:
        return bool(self.serper_key or self.tavily_key)

    # ── 1. Serper: LinkedIn people ───────────────────────────────────
    def _serper(self, query: str, num: int = 10) -> List[Dict[str, Any]]:
        if not self.serper_key:
            return []
        try:
            resp = httpx.post(
                SERPER_URL,
                headers={"X-API-KEY": self.serper_key, "Content-Type": "application/json"},
                json={"q": query, "num": num},
                timeout=15.0,
            )
            resp.raise_for_status()
            return resp.json().get("organic", [])
        except Exception as e:
            logger.warning("Serper exec search failed: %s", e)
            return []

    def _from_serper(self, org_name: str, city: str) -> List[Dict[str, Any]]:
        # Two passes so owners/C-level are not drowned out by staff at large orgs.
        top = '(CEO OR Founder OR "Co-Founder" OR "Managing Director" OR President OR Owner OR Chairman)'
        second = '(CTO OR CIO OR COO OR "Vice President" OR Director OR "Head of" OR "General Manager")'
        queries = [f'site:linkedin.com/in "{org_name}" {top}', f'site:linkedin.com/in "{org_name}" {second}']
        if city:
            queries.insert(1, f'site:linkedin.com/in "{org_name}" {city} {top}')
        contacts: List[Dict[str, Any]] = []
        for q in queries:
            for item in self._serper(q):
                url = item.get("link", "")
                if "linkedin.com/in/" not in url:
                    continue
                title = re.sub(r"\s*[|\-–—]\s*LinkedIn\s*$", "", item.get("title", ""), flags=re.IGNORECASE)
                snippet = item.get("snippet", "")
                # Must be a *current* role at this org: company named in the headline, or "... at <Org>".
                first_tok = _org_tokens(org_name)[0] if _org_tokens(org_name) else ""
                at_org = re.search(rf"\b(?:at|@)\s+{re.escape(first_tok)}", snippet, re.IGNORECASE) if first_tok else None
                if not (_mentions_org(title, org_name) or at_org):
                    continue
                segs = SEP_RE.split(title)
                name = _clean_name(segs[0])
                if not name:
                    continue
                role = ""
                for seg in segs[1:]:
                    if ROLE_RE.search(seg):
                        role = _clean_role(seg)
                        break
                if not role:
                    m = re.search(rf"((?:{ROLE_KEYWORDS})[^.·|]{{0,40}}?)\s+(?:at|@)\s", snippet, re.IGNORECASE)
                    role = _clean_role(m.group(1)) if m else ""
                if not role or not ROLE_RE.search(role):
                    continue
                contacts.append({
                    "full_name": name,
                    "job_title": role,
                    "linkedin_url": url.split("?")[0],
                    "email": None,
                    "email_status": "not_found",
                    "source": "serper_linkedin",
                    "source_url": url,
                    "confidence": 0.8,
                })
            if sum(1 for c in contacts if _seniority_rank(c["job_title"]) <= 1) >= 4:
                break
        return contacts

    # ── 2 & 3. Text extraction (Tavily snippets / website pages) ─────
    def _extract_from_text(self, text: str, org_name: str, source: str, source_url: str,
                           confidence: float, require_org_near: bool = False) -> List[Dict[str, Any]]:
        """`require_org_near`: for third-party pages, the match must sit within ~150 chars of the org name."""
        if not text:
            return []
        text = re.sub(r"\s+", " ", text)
        low_text = text.lower()
        first_tok = _org_tokens(org_name)[0] if _org_tokens(org_name) else ""
        out: List[Dict[str, Any]] = []
        name_pat = r"([A-Z][a-z]+(?:\s[A-Z]\.?)?(?:\s[A-Z][a-z]+){1,2})"
        patterns = [
            # "Jane Doe, Chief Executive Officer" / "Jane Doe - Founder & CEO" / "Jane Doe (CTO)"
            re.compile(rf"{name_pat}\s*(?:,|-|–|—|\(|:)\s*((?:{ROLE_KEYWORDS})[A-Za-z&,\- ]{{0,40}})", re.IGNORECASE),
            # "CEO Jane Doe" / "Chief Technology Officer: Jane Doe"
            re.compile(rf"((?:{ROLE_KEYWORDS})[A-Za-z&\- ]{{0,20}}?)\s*(?::|-|–|—)?\s+{name_pat}(?=\W|$)"),
        ]
        for i, pat in enumerate(patterns):
            for m in pat.finditer(text):
                raw_name, raw_role = (m.group(1), m.group(2)) if i == 0 else (m.group(2), m.group(1))
                name = _clean_name(raw_name)
                role = _clean_role(raw_role)
                if not name or not ROLE_RE.search(role):
                    continue
                # "CEO - Some Other Institute": trailing non-role text must name this org, else it's someone else's title
                extra = [s for s in re.split(r"\s*[-–—,]\s*", role)[1:] if s.strip()]
                if first_tok and any(not ROLE_RE.search(s) and first_tok not in s.lower() for s in extra):
                    continue
                if require_org_near and first_tok:
                    window = low_text[max(0, m.start() - 150): m.end() + 150]
                    if first_tok not in window:
                        continue
                out.append({
                    "full_name": name, "job_title": role, "linkedin_url": None,
                    "email": None, "email_status": "not_found",
                    "source": source, "source_url": source_url, "confidence": confidence,
                })
        # attach emails whose local part contains the person's first/last name
        emails = [e.lower() for e in EMAIL_RE.findall(text) if _valid_email(e)]
        for c in out:
            first, *_, last = c["full_name"].lower().split()
            for e in emails:
                local = re.sub(r"[^a-z]", "", e.split("@")[0])
                if first in local or (len(local) >= 4 and (last in local)):
                    c["email"], c["email_status"] = e, "publicly_found"
                    c["confidence"] = min(0.95, c["confidence"] + 0.1)
                    break
        return out

    def _from_tavily(self, org_name: str, city: str) -> List[Dict[str, Any]]:
        if not self.tavily_key:
            return []
        try:
            resp = httpx.post(
                TAVILY_URL,
                json={
                    "api_key": self.tavily_key,
                    "query": f'"{org_name}" {city} leadership team CEO founder director'.replace("  ", " "),
                    "max_results": 6,
                    "include_answer": False,
                },
                timeout=20.0,
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])
        except Exception as e:
            logger.warning("Tavily exec search failed: %s", e)
            return []
        contacts: List[Dict[str, Any]] = []
        for r in results:
            content = f"{r.get('title', '')}. {r.get('content', '')}"
            if not _mentions_org(content, org_name):
                continue
            contacts.extend(self._extract_from_text(
                content, org_name, "tavily_web", r.get("url", ""), 0.6, require_org_near=True))
        return contacts

    def _from_website(self, org_name: str, website: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """Returns (contacts, urls that returned a page) so ScrapeGraph is only aimed at live pages."""
        domain = _domain(website)
        if not domain:
            return [], []
        contacts: List[Dict[str, Any]] = []
        ok_urls: List[str] = []
        for path in LEADERSHIP_PATHS[:8]:
            url = f"https://{domain}{path}"
            html = _fetch_text(url)
            if not html:
                continue
            ok_urls.append(url)
            text = re.sub(r"<script[^>]*>.*?</script>|<style[^>]*>.*?</style>", " ", html, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r"<[^>]+>", " | ", text)
            found = self._extract_from_text(text, org_name, "official_website", url, 0.75)
            contacts.extend(found)
            if len(contacts) >= 3:
                break
        return contacts, ok_urls

    # ── 4. ScrapeGraph last resort ───────────────────────────────────
    def _from_scrapegraph(self, org_name: str, url: str) -> List[Dict[str, Any]]:
        if not settings.SCRAPEGRAPH_ENABLED or not url:
            return []
        try:
            from app.services.research.scrapegraph_adapter import ScrapeGraphAdapter
            adapter = ScrapeGraphAdapter()
            if not adapter.is_available():
                return []
            data = adapter.scrape(
                url,
                'List the leadership team / executives / owners named on this page. '
                'Return JSON {"executives":[{"name":"","title":"","email":""}]}. Use "" if unknown. Do not invent people.',
            )
        except Exception as e:
            logger.debug("ScrapeGraph exec extraction failed: %s", e)
            return []
        contacts: List[Dict[str, Any]] = []
        for ex in (data or {}).get("executives", []) if isinstance(data, dict) else []:
            name = _clean_name(str(ex.get("name", "")))
            role = _clean_role(str(ex.get("title", "")))
            if not name or not ROLE_RE.search(role):
                continue
            email = str(ex.get("email", "")).lower()
            contacts.append({
                "full_name": name, "job_title": role, "linkedin_url": None,
                "email": email if email and _valid_email(email) else None,
                "email_status": "publicly_found" if email and _valid_email(email) else "not_found",
                "source": "scrapegraph", "source_url": url, "confidence": 0.6,
            })
        return contacts

    # ── public API ───────────────────────────────────────────────────
    def find_executives(
        self,
        organization_name: str,
        website: str = "",
        city: str = "",
        target_roles: Optional[List[str]] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Return de-duplicated executive contacts, best sources first."""
        if not organization_name:
            return []
        collected: List[Dict[str, Any]] = []
        seen = set()

        def add(items: List[Dict[str, Any]]) -> None:
            for c in items:
                key = c["full_name"].lower()
                if key in seen:
                    # merge extra info into the existing contact
                    for ex in collected:
                        if ex["full_name"].lower() == key:
                            for f in ("linkedin_url", "email"):
                                if not ex.get(f) and c.get(f):
                                    ex[f] = c[f]
                                    if f == "email":
                                        ex["email_status"] = c["email_status"]
                    continue
                seen.add(key)
                collected.append(c)

        ok_urls: List[str] = []

        def website_step() -> List[Dict[str, Any]]:
            found, urls = self._from_website(organization_name, website)
            ok_urls.extend(urls)
            return found

        def enough() -> bool:
            return sum(1 for c in collected if _seniority_rank(c["job_title"]) <= 1) >= min(limit, 3)

        steps = [
            lambda: self._from_serper(organization_name, city),
            lambda: self._from_tavily(organization_name, city),
            website_step,
        ]
        for step in steps:
            try:
                add(step())
            except Exception as e:
                logger.debug("Exec finder step failed for %s: %s", organization_name, e)
            if enough():
                break
        # ScrapeGraph is slow and flaky: only when nothing found and a leadership page actually loaded.
        if not collected and ok_urls:
            add(self._from_scrapegraph(organization_name, ok_urls[0]))

        # Most senior first; drop junior staff when senior people were found.
        collected.sort(key=lambda c: (_seniority_rank(c["job_title"]), -c.get("confidence", 0)))
        if any(_seniority_rank(c["job_title"]) <= 2 for c in collected):
            collected = [c for c in collected if _seniority_rank(c["job_title"]) <= 2]
        return collected[:limit]


_finder: Optional[ExecutiveFinder] = None


def get_executive_finder() -> ExecutiveFinder:
    global _finder
    if _finder is None:
        _finder = ExecutiveFinder()
    return _finder
