"""
Geocoding router — Nominatim-powered, free, no API key.
Auto-geocodes organizations on save, manual geocode endpoint, map data endpoint.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.organization import Organization
from app.services import nominatim_service

router = APIRouter(prefix="/api/geocoding", tags=["Geocoding"])


class GeocodeAddressRequest(BaseModel):
    address: str


class GeocodeResponse(BaseModel):
    latitude: float
    longitude: float
    display_name: str
    country: str
    state: str
    city: str


@router.post("/geocode", response_model=GeocodeResponse)
async def geocode_address(payload: GeocodeAddressRequest):
    """Convert an address to lat/lng using Nominatim."""
    result = await nominatim_service.geocode(payload.address)
    if not result:
        raise HTTPException(status_code=404, detail="Could not geocode address")
    return GeocodeResponse(**result)


@router.post("/geocode-organization/{org_id}")
async def geocode_organization(
    org_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_business_development),
):
    """Auto-geocode an organization using its address/city/country."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    address_parts = [p for p in [org.address, org.city, org.state, org.country] if p]
    address = ", ".join(address_parts) if address_parts else org.name

    result = await nominatim_service.geocode(address)
    if not result:
        raise HTTPException(status_code=404, detail="Could not geocode organization address")

    org.latitude = result["latitude"]
    org.longitude = result["longitude"]
    org.location_precision = "EXACT"
    org.location_source = "nominatim"
    if not org.country and result.get("country"):
        org.country = result["country"]
    if not org.state and result.get("state"):
        org.state = result["state"]
    if not org.city and result.get("city"):
        org.city = result["city"]
    db.commit()

    return {
        "organization_id": org_id,
        "latitude": org.latitude,
        "longitude": org.longitude,
        "display_name": result["display_name"],
    }


@router.post("/geocode-all")
async def geocode_all_organizations(
    db: Session = Depends(get_db),
    current_user=Depends(require_business_development),
):
    """Batch geocode all organizations missing coordinates."""
    orgs = db.query(Organization).filter(
        Organization.is_deleted == False,
        Organization.latitude.is_(None),
    ).all()

    geocoded = 0
    failed = 0
    for org in orgs:
        address_parts = [p for p in [org.address, org.city, org.state, org.country] if p]
        address = ", ".join(address_parts) if address_parts else org.name
        result = await nominatim_service.geocode(address)
        if result:
            org.latitude = result["latitude"]
            org.longitude = result["longitude"]
            org.location_precision = "EXACT"
            org.location_source = "nominatim"
            if not org.country and result.get("country"):
                org.country = result["country"]
            if not org.city and result.get("city"):
                org.city = result["city"]
            geocoded += 1
        else:
            failed += 1

    db.commit()
    return {"geocoded": geocoded, "failed": failed, "total": len(orgs)}


@router.get("/map-data")
async def get_map_data(
    db: Session = Depends(get_db),
    current_user=Depends(require_business_development),
):
    """Get all organizations with coordinates for map rendering."""
    orgs = db.query(Organization).filter(
        Organization.is_deleted == False,
        Organization.latitude.isnot(None),
        Organization.longitude.isnot(None),
    ).all()

    return [
        {
            "id": org.id,
            "name": org.name,
            "latitude": org.latitude,
            "longitude": org.longitude,
            "organization_type": org.organization_type,
            "city": org.city,
            "country": org.country,
            "address": org.address,
            "status": org.status,
            "priority": org.priority,
            "website": org.website,
            "location_precision": org.location_precision,
            "location_source": org.location_source,
        }
        for org in orgs
    ]
