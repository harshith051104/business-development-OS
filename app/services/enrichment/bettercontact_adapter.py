"""
BetterContact API adapter for email discovery and contact enrichment.

API: https://app.bettercontact.rocks/api/v2/
Requires: BETTERCONTACT_API_KEY

Provides:
  - find_contact(organization, person_name, role)
  - enrich_organization_contacts(organization)
  - verify_email(email)

All responses normalized to a clean schema. No fabricated data.
"""
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

API_BASE = "https://app.bettercontact.rocks/api/v2"
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@dataclass
class EnrichedContact:
    name: str = ""
    role: str = ""
    organization: str = ""
    email: Optional[str] = None
    email_status: str = "not_verified"  # verified, not_verified, not_found
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    confidence: int = 0  # 0-100
    source: str = "bettercontact"
    verification_state: str = "unverified"  # verified, unverified, failed
    provider_used: str = ""
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "role": self.role,
            "organization": self.organization,
            "email": self.email,
            "email_status": self.email_status,
            "phone": self.phone,
            "linkedin_url": self.linkedin_url,
            "confidence": self.confidence,
            "source": self.source,
            "verification_state": self.verification_state,
            "provider_used": self.provider_used,
            "error": self.error,
        }


@dataclass
class EnrichmentResult:
    contacts: List[EnrichedContact] = field(default_factory=list)
    provider: str = "bettercontact"
    available: bool = False
    error: Optional[str] = None
    credits_remaining: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "contacts": [c.to_dict() for c in self.contacts],
            "provider": self.provider,
            "available": self.available,
            "error": self.error,
            "credits_remaining": self.credits_remaining,
        }


class BetterContactAdapter:
    """
    Clean adapter boundary for BetterContact email enrichment API.

    Usage:
        adapter = BetterContactAdapter()
        result = adapter.find_contact(
            organization="Apollo Hospitals",
            person_name="Dr. Reddy",
            role="CTO",
        )
        if result.contacts:
            print(result.contacts[0].email)
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("BETTERCONTACT_API_KEY", "")
        self._available: Optional[bool] = None

    @property
    def is_available(self) -> bool:
        if self._available is None:
            self._available = bool(self.api_key)
        return self._available

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _normalize_email(self, email: str) -> Optional[str]:
        if not email or not isinstance(email, str):
            return None
        email = email.strip().lower()
        return email if EMAIL_REGEX.match(email) else None

    def _compute_confidence(self, result: Dict[str, Any]) -> int:
        """Compute confidence 0-100 based on verification state and source."""
        if result.get("email_verified") or result.get("verified"):
            return 95
        if result.get("email") and result.get("email_status") == "valid":
            return 85
        if result.get("email"):
            return 70
        if result.get("phone") or result.get("linkedin_url"):
            return 50
        return 20

    def _normalize_response(self, raw: Dict[str, Any], name: str, org: str, role: str) -> EnrichedContact:
        """Normalize a raw BetterContact response to EnrichedContact."""
        email = self._normalize_email(raw.get("email", ""))
        email_status = "not_verified"
        verification_state = "unverified"

        if email:
            if raw.get("email_verified") or raw.get("verified"):
                email_status = "verified"
                verification_state = "verified"
            elif raw.get("email_status") == "valid":
                email_status = "verified"
                verification_state = "verified"
            else:
                email_status = "not_verified"
                verification_state = "unverified"

        return EnrichedContact(
            name=name,
            role=role,
            organization=org,
            email=email,
            email_status=email_status,
            phone=raw.get("phone"),
            linkedin_url=raw.get("linkedin_url") or raw.get("linkedin"),
            confidence=self._compute_confidence(raw),
            source="bettercontact",
            verification_state=verification_state,
            provider_used="bettercontact",
            error=raw.get("error"),
        )

    def find_contact(
        self,
        organization: str,
        person_name: str = "",
        role: str = "",
        domain: str = "",
    ) -> EnrichmentResult:
        """
        Find professional email for a contact at an organization.

        Args:
            organization: Organization name
            person_name: Full name of the person
            role: Job title / role
            domain: Organization domain (optional, extracted from name if missing)

        Returns:
            EnrichmentResult with normalized contacts
        """
        if not self.is_available:
            return EnrichmentResult(
                available=False,
                error="BetterContact API key not configured. Set BETTERCONTACT_API_KEY.",
            )

        if not person_name and not organization:
            return EnrichmentResult(
                available=True,
                error="At least one of person_name or organization is required",
            )

        payload = {
            "firstName": person_name.split()[0] if person_name else "",
            "lastName": " ".join(person_name.split()[1:]) if person_name and len(person_name.split()) > 1 else "",
            "organization": organization,
            "role": role,
        }
        if domain:
            payload["domain"] = domain

        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(
                    f"{API_BASE}/enrich",
                    headers=self._headers(),
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()

                contacts = []
                if isinstance(data, list):
                    for item in data:
                        contacts.append(self._normalize_response(item, person_name, organization, role))
                elif isinstance(data, dict):
                    contacts.append(self._normalize_response(data, person_name, organization, role))

                return EnrichmentResult(
                    contacts=contacts,
                    available=True,
                    credits_remaining=data.get("credits_remaining"),
                )
        except httpx.HTTPStatusError as e:
            logger.warning("BetterContact API error: %s", e.response.status_code)
            return EnrichmentResult(
                available=True,
                error=f"BetterContact API error: {e.response.status_code}",
            )
        except httpx.RequestError as e:
            logger.warning("BetterContact network error: %s", e)
            return EnrichmentResult(
                available=True,
                error=f"BetterContact network error: {str(e)}",
            )
        except Exception as e:
            logger.warning("BetterContact unexpected error: %s", e)
            return EnrichmentResult(
                available=True,
                error=f"BetterContact error: {str(e)}",
            )

    def enrich_organization_contacts(
        self,
        organization: str,
        contacts: List[Dict[str, str]],
        domain: str = "",
    ) -> EnrichmentResult:
        """
        Enrich multiple contacts at an organization.

        Args:
            organization: Organization name
            contacts: List of dicts with 'name' and 'role' keys
            domain: Organization domain (optional)

        Returns:
            EnrichmentResult with all enriched contacts
        """
        if not self.is_available:
            return EnrichmentResult(
                available=False,
                error="BetterContact API key not configured.",
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
            available=True,
        )

    def verify_email(self, email: str) -> Dict[str, Any]:
        """
        Verify an email address.

        Returns:
            Dict with email, status (valid/invalid/unknown), confidence
        """
        if not self.is_available:
            return {"email": email, "status": "unknown", "error": "BetterContact not configured"}

        normalized = self._normalize_email(email)
        if not normalized:
            return {"email": email, "status": "invalid", "error": "Invalid email format"}

        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(
                    f"{API_BASE}/verify",
                    headers=self._headers(),
                    json={"email": normalized},
                )
                resp.raise_for_status()
                data = resp.json()
                return {
                    "email": normalized,
                    "status": data.get("status", "unknown"),
                    "confidence": 95 if data.get("status") == "valid" else 30,
                    "provider": "bettercontact",
                }
        except Exception as e:
            logger.warning("BetterContact verify error: %s", e)
            return {"email": normalized, "status": "unknown", "error": str(e)}


# Singleton for convenience
_bettercontact_adapter: Optional[BetterContactAdapter] = None


def get_bettercontact_adapter() -> BetterContactAdapter:
    global _bettercontact_adapter
    if _bettercontact_adapter is None:
        _bettercontact_adapter = BetterContactAdapter()
    return _bettercontact_adapter
