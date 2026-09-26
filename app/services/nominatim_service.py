"""
Nominatim geocoding service — free, no API key required.
Uses OpenStreetMap's Nominatim API with 1 req/sec rate limit.
"""
import httpx
import asyncio
import logging
import time
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org"
USER_AGENT = "ELLY-BD-Portal/1.0"

# Simple in-memory cache to respect rate limits
_last_request_time = 0.0


async def _rate_limited_get(url: str, params: dict) -> dict:
    """GET with 1-second rate limit for Nominatim compliance."""
    global _last_request_time
    elapsed = time.time() - _last_request_time
    if elapsed < 1.0:
        await asyncio.sleep(1.0 - elapsed)
    _last_request_time = time.time()

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, params=params, headers={"User-Agent": USER_AGENT})
        resp.raise_for_status()
        return resp.json()


async def geocode(address: str) -> Optional[Dict[str, Any]]:
    """Convert address to lat/lng + structured location data."""
    if not address or not address.strip():
        return None
    try:
        data = await _rate_limited_get(
            f"{NOMINATIM_URL}/search",
            {"q": address, "format": "json", "limit": 1, "addressdetails": 1},
        )
        if not data:
            return None
        r = data[0]
        addr = r.get("address", {})
        return {
            "latitude": float(r["lat"]),
            "longitude": float(r["lon"]),
            "display_name": r.get("display_name", ""),
            "country": addr.get("country", ""),
            "state": addr.get("state", ""),
            "city": addr.get("city", addr.get("town", addr.get("village", ""))),
        }
    except Exception as e:
        logger.warning(f"Nominatim geocode failed for '{address}': {e}")
        return None


async def reverse_geocode(lat: float, lng: float) -> Optional[Dict[str, Any]]:
    """Convert lat/lng to address."""
    try:
        data = await _rate_limited_get(
            f"{NOMINATIM_URL}/reverse",
            {"lat": lat, "lon": lng, "format": "json", "addressdetails": 1},
        )
        if not data:
            return None
        addr = data.get("address", {})
        return {
            "display_name": data.get("display_name", ""),
            "country": addr.get("country", ""),
            "state": addr.get("state", ""),
            "city": addr.get("city", addr.get("town", addr.get("village", ""))),
            "address": data.get("display_name", ""),
        }
    except Exception as e:
        logger.warning(f"Nominatim reverse geocode failed for ({lat},{lng}): {e}")
        return None


async def search_organizations_by_location(
    query: str, location: str = "", limit: int = 20
) -> List[Dict[str, Any]]:
    """Search for organizations using Nominatim + structured query."""
    search_q = f"{query} {location}".strip() if location else query
    try:
        data = await _rate_limited_get(
            f"{NOMINATIM_URL}/search",
            {"q": search_q, "format": "json", "limit": limit, "addressdetails": 1},
        )
        results = []
        for r in data:
            addr = r.get("address", {})
            results.append({
                "name": r.get("display_name", "").split(",")[0],
                "latitude": float(r["lat"]),
                "longitude": float(r["lon"]),
                "country": addr.get("country", ""),
                "state": addr.get("state", ""),
                "city": addr.get("city", addr.get("town", addr.get("village", ""))),
                "type": r.get("type", ""),
                "osm_id": r.get("osm_id"),
            })
        return results
    except Exception as e:
        logger.warning(f"Nominatim search failed for '{search_q}': {e}")
        return []
