"""Google Maps API service for geocoding, places, and map rendering."""
import httpx
from typing import Optional, Dict, Any, List
from app.core.config import settings

GOOGLE_MAPS_BASE = "https://maps.googleapis.com/maps/api"


async def geocode_address(address: str) -> Optional[Dict[str, Any]]:
    """Convert address to lat/lng coordinates."""
    if not settings.GOOGLE_MAPS_API_KEY:
        return None
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{GOOGLE_MAPS_BASE}/geocode/json",
            params={"address": address, "key": settings.GOOGLE_MAPS_API_KEY},
        )
        data = resp.json()
        if data.get("status") == "OK" and data.get("results"):
            result = data["results"][0]
            loc = result["geometry"]["location"]
            return {
                "lat": loc["lat"],
                "lng": loc["lng"],
                "formatted_address": result.get("formatted_address", address),
            }
    return None


async def reverse_geocode(lat: float, lng: float) -> Optional[str]:
    """Convert lat/lng to address string."""
    if not settings.GOOGLE_MAPS_API_KEY:
        return None
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{GOOGLE_MAPS_BASE}/geocode/json",
            params={"latlng": f"{lat},{lng}", "key": settings.GOOGLE_MAPS_API_KEY},
        )
        data = resp.json()
        if data.get("status") == "OK" and data.get("results"):
            return data["results"][0].get("formatted_address")
    return None


async def search_places(query: str, location: Optional[str] = None, radius: int = 50000) -> List[Dict[str, Any]]:
    """Search for places using Google Places API (New)."""
    if not settings.GOOGLE_MAPS_API_KEY:
        return []
    params: Dict[str, Any] = {
        "input": query,
        "key": settings.GOOGLE_MAPS_API_KEY,
    }
    if location:
        params["location"] = location
        params["radius"] = radius
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{GOOGLE_MAPS_BASE}/place/autocomplete/json",
            params=params,
        )
        data = resp.json()
        if data.get("status") == "OK":
            return [
                {
                    "place_id": p.get("place_id"),
                    "description": p.get("description", ""),
                    "structured_formatting": p.get("structured_formatting", {}),
                }
                for p in data.get("predictions", [])
            ]
    return []


async def get_place_details(place_id: str) -> Optional[Dict[str, Any]]:
    """Get detailed info for a specific place."""
    if not settings.GOOGLE_MAPS_API_KEY:
        return None
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{GOOGLE_MAPS_BASE}/place/details/json",
            params={
                "place_id": place_id,
                "fields": "name,formatted_address,geometry,website,formatted_phone_number,business_status",
                "key": settings.GOOGLE_MAPS_API_KEY,
            },
        )
        data = resp.json()
        if data.get("status") == "OK":
            result = data.get("result", {})
            loc = result.get("geometry", {}).get("location", {})
            return {
                "name": result.get("name"),
                "address": result.get("formatted_address"),
                "lat": loc.get("lat"),
                "lng": loc.get("lng"),
                "website": result.get("website"),
                "phone": result.get("formatted_phone_number"),
                "is_open": result.get("business_status") == "OPERATIONAL",
            }
    return None


async def get_distance_matrix(origins: List[str], destinations: List[str]) -> Optional[Dict[str, Any]]:
    """Calculate distances between origin/destination pairs."""
    if not settings.GOOGLE_MAPS_API_KEY:
        return None
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{GOOGLE_MAPS_BASE}/distancematrix/json",
            params={
                "origins": "|".join(origins),
                "destinations": "|".join(destinations),
                "key": settings.GOOGLE_MAPS_API_KEY,
            },
        )
        data = resp.json()
        if data.get("status") == "OK":
            return data.get("rows", [])
    return None


def get_map_embed_url(lat: float, lng: float, zoom: int = 12) -> str:
    """Generate Google Maps embed URL for display."""
    return f"https://www.google.com/maps/embed/v1/place?key={settings.GOOGLE_MAPS_API_KEY}&q={lat},{lng}&zoom={zoom}"


def get_static_map_url(lat: float, lng: float, zoom: int = 12, width: int = 400, height: int = 300) -> str:
    """Generate Google Static Maps URL."""
    return f"https://maps.googleapis.com/maps/api/staticmap?center={lat},{lng}&zoom={zoom}&size={width}x{height}&markers=color:red%7C{lat},{lng}&key={settings.GOOGLE_MAPS_API_KEY}"
