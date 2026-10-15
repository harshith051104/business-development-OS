"""
Deterministic website profiler — httpx + regex, zero LLM calls.

Fetches homepage, robots.txt, sitemap.xml and a few relevant pages
(team / careers / contact) and extracts observable signals:

  tech stack, advertising pixels, schema markup, blog freshness,
  agency credits, hiring roles, contact-form URL.

Rules:
  - Unavailable data is reported as unknown (None + listed in "unknown"),
    never as false. Observed absence on a fetched page is a real finding.
  - The profiler never raises: every failure lands in "errors".
  - "evidence" maps each determined field to the URL that proved it.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin

import httpx

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 8.0
MAX_PAGES = 4  # extra pages beyond homepage/robots/sitemap
BLOG_STALE_AFTER_DAYS = 365

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

TECH_SIGNATURES: Dict[str, str] = {
    "WordPress": r"/wp-content/|wp-json",
    "Shopify": r"cdn\.shopify\.com|Shopify\.theme",
    "Wix": r"wix(?:code|static)\.com|wixpress",
    "Webflow": r"webflow\.com|data-wf-page",
    "Squarespace": r"squarespace\.com|static1\.squarespace",
    "Next.js": r"/_next/static/|__NEXT_DATA__",
    "Nuxt": r"/_nuxt/|__NUXT__",
    "Gatsby": r"/page-data/|gatsby[a-z-]*\.js",
    "React": r"data-reactroot|react(?:-dom)?(?:\.production)?\.min\.js",
    "Vue": r"vue(?:\.min)?\.js|data-v-[0-9a-f]{8}",
    "Angular": r"ng-version|angular(?:\.min)?\.js",
    "Drupal": r"Drupal\.settings|/sites/default/files/",
    "Joomla": r"/media/jui/|Joomla!",
    "Magento": r"Magento_|/static/version\d+frontend/",
    "HubSpot": r"js\.hs-scripts\.com|js\.hsforms\.net",
    "Marketo": r"munchkin\.marketo\.net",
    "Pardot": r"pi\.pardot\.com",
    "Segment": r"cdn\.segment\.com|analytics\.snippet\.com",
    "Mixpanel": r"cdn\.mixpanel\.com|mixpanel\.init",
    "Intercom": r"intercom(?:cdn)?\.com|widget\.intercom",
    "Zendesk": r"zdassets\.com|zendesk\.com",
    "Google Tag Manager": r"googletagmanager\.com/gtm\.js",
    "Cloudflare": r"cdn-cgi/challenge|cloudflareinsights\.com",
    "Vercel": r"_vercel/insights|vercel\.app/_new",
    "Ghost": r"content/themes/ghost|ghost\.org/assets",
}

PIXEL_SIGNATURES: Dict[str, str] = {
    "google_ads": r"googleadservices\.com|googletagmanager\.com/gtm\.js\?id=GTM-|gtag/js\?id=AW-",
    "meta_pixel": r"fbq\(|connect\.facebook\.net|fbevents\.js",
    "linkedin_insight": r"snap\.licdn\.com|linkedin\.com/px/",
    "microsoft_clarity": r"clarity\.ms",
    "hotjar": r"static\.hotjar\.com",
    "twitter_pixel": r"static\.twitter\.com|analytics\.twitter\.com",
    "pinterest_tag": r"s\.pinimg\.com/|ct\.pinterest\.com",
}

AGENCY_RE = re.compile(
    r"(?:powered by|designed by|built by|made by|crafted by|developed by)\s*[:\-]?\s*"
    r"(?:<a[^>]+href=[\"']([^\"']+)[\"'][^>]*>)?\s*([^<]{2,60})",
    re.I,
)
ROLE_RE = re.compile(
    r"\b(?:engineer|developer|designer|analyst|consultant|manager|director|head of|"
    r"vp of|specialist|coordinator|recruiter|nurse|technician|architect|"
    r"sales|marketing|devops|data scientist|product owner)\b",
    re.I,
)
PAGE_HINTS = ("team", "about", "people", "leadership", "careers", "career", "jobs",
              "join", "contact", "work-with")
SITEMAP_RE = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>", re.I)
LASTMOD_PAIR_RE = re.compile(
    r"<url>\s*<loc>\s*([^<\s]+)\s*</loc>(?:\s*<lastmod>\s*([^<\s]+)\s*</lastmod>)?", re.I
)
LDJSON_RE = re.compile(r"<script[^>]*application/ld\+json[^>]*>([\s\S]*?)</script>", re.I)
TAG_RE = re.compile(r"<[^>]+>")


def normalize_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def _get(url: str, timeout: float) -> Tuple[Optional[int], str, List[str]]:
    """Fetch one URL. Returns (status, text, errors). Never raises."""
    try:
        resp = httpx.get(url, headers=_HEADERS, timeout=timeout, follow_redirects=True)
        if resp.status_code >= 400:
            return resp.status_code, "", [f"GET {url} -> HTTP {resp.status_code}"]
        return resp.status_code, resp.text, []
    except Exception as exc:  # network/DNS/TLS/timeout — unavailable, not false
        return None, "", [f"GET {url} -> {type(exc).__name__}: {str(exc)[:80]}"]


def _strip_tags(html: str) -> str:
    text = TAG_RE.sub(" ", html)
    return re.sub(r"\s+", " ", text).strip()


def _detect(signatures: Dict[str, str], html: str) -> List[str]:
    return [name for name, pattern in signatures.items() if re.search(pattern, html, re.I)]


def _extract_schema_types(html: str) -> List[str]:
    types: List[str] = []
    for block in LDJSON_RE.findall(html):
        try:
            data = json.loads(block.strip())
        except (json.JSONDecodeError, ValueError):
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if isinstance(item, dict):
                t = item.get("@type")
                if isinstance(t, list):
                    types.extend(str(x) for x in t)
                elif t:
                    types.append(str(t))
    seen, out = set(), []
    for t in types:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def _extract_agency_credit(html: str) -> Optional[Dict[str, Optional[str]]]:
    m = AGENCY_RE.search(html)
    if not m:
        return None
    url = m.group(1) or None
    label = re.sub(r"\s+", " ", m.group(2)).strip(" .|-")
    if not label:
        return None
    return {"label": label, "url": url}


def _extract_hiring_roles(html: str) -> List[str]:
    candidates = re.findall(r"<(?:h[1-4]|li|a)[^>]*>([\s\S]{4,120}?)</(?:h[1-4]|li|a)>", html, re.I)
    roles: List[str] = []
    for raw in candidates:
        text = _strip_tags(raw)
        if 6 <= len(text) <= 90 and ROLE_RE.search(text) and text not in roles:
            roles.append(text)
        if len(roles) >= 15:
            break
    return roles


def _extract_form_url(html: str, base_url: str) -> Optional[str]:
    for action in re.findall(r"<form[^>]+action=[\"']([^\"']+)[\"']", html, re.I):
        action = action.strip()
        if not action or action.lower() in ("#", "javascript:void(0)"):
            continue
        return urljoin(base_url, action)
    return None


def _parse_date(value: str) -> Optional[datetime]:
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def profile_website(url: str, timeout: float = DEFAULT_TIMEOUT) -> Dict[str, Any]:
    """
    Profile a website deterministically. Never raises.
    Every extracted field is a list/value when determined, None when unknown,
    and every unknown field name appears in the "unknown" list.
    """
    base = normalize_url(url)
    profile: Dict[str, Any] = {
        "website": base or None,
        "profiled_at": datetime.now(timezone.utc).isoformat(),
        "tech_stack": None,
        "ad_pixels": None,
        "schema_types": None,
        "blog_present": None,
        "blog_newest": None,
        "blog_stale": None,
        "agency_credit": None,
        "hiring_roles": None,
        "contact_form_url": None,
        "unknown": [],
        "evidence": {},
        "errors": [],
    }
    if not base:
        profile["unknown"] = [k for k in ("tech_stack", "ad_pixels", "schema_types",
                                          "blog_present", "blog_newest", "blog_stale",
                                          "agency_credit", "hiring_roles", "contact_form_url")]
        profile["errors"].append("no website URL provided")
        return profile

    try:
        return _profile(base, timeout, profile)
    except Exception as exc:  # absolute safety net — profiler must never raise
        profile["errors"].append(f"profiler error: {type(exc).__name__}: {str(exc)[:80]}")
        profile["tech_stack"] = None
        profile["ad_pixels"] = None
        profile["schema_types"] = None
        profile["agency_credit"] = None
        profile["hiring_roles"] = None
        profile["contact_form_url"] = None
        profile["unknown"] = ["tech_stack", "ad_pixels", "schema_types", "blog_present",
                              "blog_newest", "blog_stale", "agency_credit",
                              "hiring_roles", "contact_form_url"]
        return profile


def _profile(base: str, timeout: float, profile: Dict[str, Any]) -> Dict[str, Any]:
    errors: List[str] = []

    # 1. Homepage
    status, html, errs = _get(base, timeout)
    errors.extend(errs)
    homepage_ok = status == 200 and bool(html)
    pages_html: Dict[str, str] = {}
    if homepage_ok:
        pages_html[base] = html
        profile["evidence"].update({
            "tech_stack": base, "ad_pixels": base, "schema_types": base,
            "agency_credit": base, "hiring_roles": base, "contact_form_url": base,
        })
    else:
        profile["unknown"] = ["tech_stack", "ad_pixels", "schema_types",
                              "agency_credit", "hiring_roles", "contact_form_url"]

    # 2. robots.txt → sitemap locations
    robots_url = urljoin(base, "/robots.txt")
    status_r, robots, errs = _get(robots_url, timeout)
    errors.extend(errs)
    sitemap_urls = re.findall(r"(?im)^sitemap:\s*(\S+)", robots or "")
    if not sitemap_urls and (status_r == 200 or robots):
        sitemap_urls = [urljoin(base, "/sitemap.xml")]
    elif not sitemap_urls:
        sitemap_urls = [urljoin(base, "/sitemap.xml")]  # worth one attempt anyway

    # 3. Sitemap → URL list + lastmod dates (blog freshness evidence)
    sitemap_urls_found: List[str] = []
    lastmods: Dict[str, str] = {}
    sitemap_ok = False
    for sm_url in sitemap_urls[:2]:
        status_s, sitemap, errs = _get(sm_url, timeout)
        errors.extend(errs)
        if status_s != 200 or not sitemap:
            continue
        sitemap_ok = True
        profile["evidence"].setdefault("blog_present", sm_url)
        profile["evidence"].setdefault("blog_newest", sm_url)
        profile["evidence"].setdefault("blog_stale", sm_url)
        child_index = "<sitemapindex" in sitemap.lower()
        if child_index:
            children = SITEMAP_RE.findall(sitemap)[:1]
            for child in children:
                status_c, child_xml, errs = _get(child, timeout)
                errors.extend(errs)
                if status_c == 200 and child_xml:
                    sitemap = child_xml
                    break
        for loc, lastmod in LASTMOD_PAIR_RE.findall(sitemap):
            sitemap_urls_found.append(loc)
            if lastmod:
                lastmods[loc] = lastmod
        if sitemap_urls_found:
            break

    # 4. Relevant pages (team / careers / contact), discovered from homepage links
    if homepage_ok:
        hrefs = re.findall(r"href=[\"']([^\"'#]+)[\"']", html, re.I)
        hints = [h for h in hrefs if any(k in h.lower() for k in PAGE_HINTS)]
        extra = 0
        seen = set()
        for href in hints:
            if extra >= MAX_PAGES:
                break
            page_url = urljoin(base, href)
            if page_url in seen or page_url == base:
                continue
            seen.add(page_url)
            status_p, page_html, errs = _get(page_url, timeout)
            errors.extend(errs)
            extra += 1
            if status_p == 200 and page_html:
                pages_html[page_url] = page_html

    # 5. Homepage-derived signals (known when homepage fetched)
    if homepage_ok:
        profile["tech_stack"] = _detect(TECH_SIGNATURES, html)
        profile["ad_pixels"] = _detect(PIXEL_SIGNATURES, html)
        profile["schema_types"] = _extract_schema_types(html)
        profile["agency_credit"] = _extract_agency_credit(html)
        profile["contact_form_url"] = _extract_form_url(html, base)

    # 6. Hiring roles: scan discovered pages (about/team/careers), fallback homepage
    if homepage_ok:
        roles: List[str] = []
        for page_url, page_html in pages_html.items():
            page_roles = _extract_hiring_roles(page_html)
            if page_roles and page_url != base:
                profile["evidence"]["hiring_roles"] = page_url
                roles = page_roles
                break
            roles.extend(r for r in page_roles if r not in roles)
        profile["hiring_roles"] = roles if roles else []
        profile["contact_form_url"] = profile["contact_form_url"] or _first_form(pages_html, base)
        if not profile["evidence"].get("contact_form_url"):
            for page_url, page_html in pages_html.items():
                if page_url != base and _extract_form_url(page_html, base):
                    profile["evidence"]["contact_form_url"] = page_url
                    break

    # 7. Blog freshness from sitemap
    if sitemap_ok:
        blog_locs = [u for u in sitemap_urls_found
                     if re.search(r"/(blog|news|articles|insights|resources)(/|$)", u, re.I)]
        if not blog_locs and homepage_ok:
            blog_locs = [u for u in sitemap_urls_found if "/blog" in u.lower()]
        homepage_blog_link = homepage_ok and re.search(r"href=[\"'][^\"']*(?:/blog|/news|/articles)[^\"']*[\"']", html, re.I)
        profile["blog_present"] = bool(blog_locs) or bool(homepage_blog_link)
        dates = [d for u, d in ((u, lastmods.get(u)) for u in blog_locs) if d]
        parsed = [x for x in (_parse_date(d) for d in dates) if x]
        if parsed:
            newest = max(parsed)
            profile["blog_newest"] = newest.date().isoformat()
            profile["blog_stale"] = newest < datetime.now(timezone.utc) - timedelta(days=BLOG_STALE_AFTER_DAYS)
        else:
            profile["blog_stale"] = None  # dates unknown — not "not stale"
    else:
        profile["unknown"].extend(["blog_present", "blog_newest", "blog_stale"])

    # Observed absence on fetched homepage = real finding (not unknown);
    # homepage failure already put these in "unknown" above.
    for key in ("agency_credit", "contact_form_url"):
        if key not in profile["unknown"] and profile[key] is None:
            profile["evidence"].setdefault(key, base)
    if homepage_ok and profile["tech_stack"] is None:
        profile["tech_stack"] = []

    profile["errors"] = errors
    return profile


def _first_form(pages_html: Dict[str, str], base: str) -> Optional[str]:
    home = pages_html.get(base)
    if home:
        found = _extract_form_url(home, base)
        if found:
            return found
    for page_url, page_html in pages_html.items():
        if page_url == base:
            continue
        found = _extract_form_url(page_html, base)
        if found:
            return found
    return None
