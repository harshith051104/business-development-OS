"""
Google Maps Scraper provider — real local businesses from Google Maps.

Drives a locally-run gosom/google-maps-scraper (MIT) over its REST API
(setup adapted from https://github.com/Mahanaicoach/google-maps-scraper-kit,
see deployment/google-maps-scraper/docker-compose.yml).

Flow: geocode location -> create job -> poll -> download CSV -> map rows to
organization dicts -> validate + qualify. Decision-makers are found afterwards by
the executive finder (Serper/Tavily), not here.

Safety: one job at a time, low default depth, results cached, never raises when
the scraper container is down (returns nothing so the fallback chain continues).
Scraping Maps is against Google's ToS — keep volume modest and treat rows as
leads to verify.
"""
import csv
import io
import json
import logging
import re
import threading
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.services.discovery_providers.ai_qualification import qualify_organization
from app.services.discovery_providers.base import BaseOrganizationDiscoveryProvider
from app.services.discovery_providers.organization_validator import organization_validator

logger = logging.getLogger(__name__)

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_UA = "ELLY-BD-Portal/1.0"
POLL_INTERVAL_SECONDS = 4
CACHE_TTL_SECONDS = 3600
AVAILABILITY_TTL_SECONDS = 30

# Websites on Maps listings that are really social/booking pages, not the org's own site.
NON_ORG_SITE_DOMAINS = (
    "facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com",
    "youtube.com", "tiktok.com", "wa.me", "whatsapp.com", "linktr.ee", "business.site",
    "google.com", "goo.gl", "g.page", "yelp.com", "tripadvisor.com", "justdial.com",
)
JUNK_EMAIL_PARTS = ("sentry", "wixpress", "example.", "@2x", "noreply", "no-reply", "donotreply")
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

# One scraper job at a time: parallel jobs without proxies get the IP throttled by Google.
_job_lock = threading.Lock()
_geocode_cache: Dict[str, Optional[Tuple[str, str]]] = {}
_result_cache: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}
_availability: Dict[str, float] = {"checked_at": 0.0, "up": 0.0}


def _scraper_url() -> str:
    return settings.GMAPS_SCRAPER_URL.rstrip("/")


def is_scraper_available() -> bool:
    """Cheap health check (cached) so an offline container never slows discovery."""
    if not settings.GMAPS_SCRAPER_ENABLED:
        return False
    now = time.time()
    if now - _availability["checked_at"] < AVAILABILITY_TTL_SECONDS:
        return bool(_availability["up"])
    up = False
    try:
        up = httpx.get(f"{_scraper_url()}/api/v1/jobs", timeout=2.0).status_code == 200
    except Exception:
        up = False
    _availability["checked_at"] = now
    _availability["up"] = 1.0 if up else 0.0
    if not up:
        logger.info("Google Maps scraper not reachable at %s — skipping", _scraper_url())
    return up


def _geocode(place: str) -> Optional[Tuple[str, str]]:
    """Place name -> ('lat', 'lon') via Nominatim (free, ~1 req/sec, cached)."""
    key = place.strip().lower()
    if key in _geocode_cache:
        return _geocode_cache[key]
    coords = None
    try:
        resp = httpx.get(
            NOMINATIM_SEARCH_URL,
            params={"format": "json", "limit": 1, "q": place},
            headers={"User-Agent": NOMINATIM_UA},
            timeout=10.0,
        )
        resp.raise_for_status()
        hits = resp.json()
        if hits:
            coords = (str(hits[0]["lat"]), str(hits[0]["lon"]))
        time.sleep(1)  # Nominatim usage policy
    except Exception as e:
        logger.warning("Nominatim geocode failed for %r: %s", place, e)
    _geocode_cache[key] = coords
    return coords


def _clean_website(url: str) -> str:
    """Reduce a listing website to its origin; drop social/booking pages and tracking params."""
    if not url:
        return ""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        parsed = urlparse(url)
    except Exception:
        return ""
    host = parsed.netloc.lower().replace("www.", "")
    if not host or "." not in host:
        return ""
    if any(host == d or host.endswith("." + d) for d in NON_ORG_SITE_DOMAINS):
        return ""
    return f"{parsed.scheme}://{parsed.netloc}"


def _pick_email(raw: str) -> str:
    """The scraper's `emails` cell is comma/JSON-ish — take the first plausible address."""
    for e in EMAIL_RE.findall(raw or ""):
        low = e.lower()
        if low.endswith((".png", ".jpg", ".gif", ".webp", ".svg")):
            continue
        if any(p in low for p in JUNK_EMAIL_PARTS):
            continue
        return low
    return ""


def _parse_address(row: Dict[str, str]) -> Dict[str, str]:
    """`complete_address` is a JSON blob (borough/city/state/postal_code/country)."""
    out = {"city": "", "state": "", "country": ""}
    raw = row.get("complete_address") or ""
    if raw.startswith("{"):
        try:
            data = json.loads(raw)
            out["city"] = data.get("city") or data.get("borough") or ""
            out["state"] = data.get("state") or ""
            out["country"] = data.get("country") or ""
        except Exception:
            pass
    return out


def _to_int(value: str) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


class GoogleMapsScraperProvider(BaseOrganizationDiscoveryProvider):
    """Finds real businesses on Google Maps via the local gosom scraper."""

    @property
    def provider_name(self) -> str:
        return "Google Maps Scraper (Local)"

    @property
    def provider_type(self) -> str:
        return "maps_scraper"

    # ── scraper REST helpers ──────────────────────────────────────────
    def _run_job(self, keywords: List[str], lat: str, lon: str, depth: int) -> List[Dict[str, str]]:
        base = _scraper_url()
        max_time = settings.GMAPS_SCRAPER_MAX_TIME_SECONDS
        body: Dict[str, Any] = {
            "name": "elly-discovery",
            "keywords": keywords,
            "lang": "en",
            "zoom": 15,
            "lat": lat,
            "lon": lon,
            "fast_mode": False,
            "radius": 10000,
            "depth": depth,
            "email": settings.GMAPS_SCRAPER_EXTRACT_EMAILS,
            "max_time": max_time,
        }
        if settings.GMAPS_SCRAPER_PROXIES:
            body["proxies"] = settings.GMAPS_SCRAPER_PROXIES

        with httpx.Client(timeout=30.0) as client:
            resp = client.post(f"{base}/api/v1/jobs", json=body)
            resp.raise_for_status()
            job_id = resp.json().get("id")
            if not job_id:
                raise RuntimeError("scraper returned no job id")
            try:
                deadline = time.time() + max_time + 180  # scraper starts queued jobs on ~60s ticks, then runs up to max_time
                while time.time() < deadline:
                    status = client.get(f"{base}/api/v1/jobs/{job_id}").json().get("Status")
                    if status == "ok":
                        raw = client.get(f"{base}/api/v1/jobs/{job_id}/download").content
                        return list(csv.DictReader(io.StringIO(raw.decode("utf-8", "replace"))))
                    if status == "failed":
                        raise RuntimeError("scraper job failed (possibly rate-limited by Google)")
                    time.sleep(POLL_INTERVAL_SECONDS)
                raise RuntimeError("scraper job timed out")
            finally:
                try:
                    client.delete(f"{base}/api/v1/jobs/{job_id}")  # free disk
                except Exception:
                    pass

    def _fetch_rows(self, keywords: List[str], location: str, depth: int) -> List[Dict[str, str]]:
        cache_key = f"{'|'.join(keywords)}::{location.lower()}::{depth}"
        cached = _result_cache.get(cache_key)
        if cached and time.time() - cached[0] < CACHE_TTL_SECONDS:
            return cached[1]

        coords = _geocode(location)
        if not coords:
            logger.warning("Maps scraper: could not geocode %r", location)
            return []

        if not _job_lock.acquire(timeout=settings.GMAPS_SCRAPER_MAX_TIME_SECONDS):
            logger.warning("Maps scraper busy — skipping")
            return []
        try:
            rows = self._run_job(keywords, coords[0], coords[1], depth)
        finally:
            _job_lock.release()
        _result_cache[cache_key] = (time.time(), rows)
        return rows

    # ── mapping ───────────────────────────────────────────────────────
    def _row_to_org(self, row: Dict[str, str], location: str) -> Optional[Dict[str, Any]]:
        name = (row.get("title") or "").strip()
        if not name:
            return None
        status = (row.get("status") or "").lower()
        if "closed" in status and "permanently" in status:
            return None

        addr = _parse_address(row)
        rating = row.get("review_rating") or ""
        reviews = _to_int(row.get("review_count") or "0")
        category = (row.get("category") or "").strip()
        description = f"{category} — Google Maps listing" if category else "Google Maps listing"
        if rating and reviews:
            description += f", rated {rating} ({reviews} reviews)"

        org = {
            "name": name,
            "organization_type": category or "Local Business",
            "industry": category or "Unknown",
            "website": _clean_website(row.get("website") or ""),
            "description": description,
            "email": _pick_email(row.get("emails") or ""),
            "phone": (row.get("phone") or "").strip(),
            "address": (row.get("address") or "").strip(),
            "city": addr["city"],
            "state": addr["state"],
            "country": addr["country"] or "",
            "latitude": row.get("latitude") or "",
            "longitude": row.get("longitude") or "",
            "source_type": "maps_scraper",
            "source_name": "Google Maps Scraper (Local)",
            "source_url": row.get("link") or "",
            "google_place_id": row.get("place_id") or row.get("cid") or "",
        }
        is_valid, reason, normalized = organization_validator.validate(org)
        if not is_valid:
            logger.debug("Maps scraper rejected: %s — %s", name, reason)
            return None
        return normalized

    # ── provider interface ────────────────────────────────────────────
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
        if not is_scraper_available():
            return [], 0
        location = (location or "").strip()
        if not location:
            # Maps search is inherently geographic — without a place there is nothing to scrape.
            return [], 0

        term = " ".join(
            p.strip() for p in (organization_type, keyword)
            if p and p.strip() and p.strip() != "All"
        ) or (target_icp or "").strip()
        if not term:
            return [], 0
        keywords = [f"{term} in {location}"]

        try:
            rows = self._fetch_rows(keywords, location, settings.GMAPS_SCRAPER_DEPTH)
        except Exception as e:
            logger.error("Google Maps scraper search failed: %s", e)
            return [], 0

        orgs: List[Dict[str, Any]] = []
        seen = set()
        for row in rows:
            org = self._row_to_org(row, location)
            if not org:
                continue
            key = (org["name"].lower(), org.get("phone") or org.get("website") or org.get("address"))
            if key in seen:
                continue
            seen.add(key)
            orgs.append(org)

        total = len(orgs)
        page = orgs[offset: offset + limit]
        qualified = []
        for raw_org in page:
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
