"""
Abstract enrichment provider interface.

All enrichment providers (BetterContact, public web, future providers)
implement this interface. The system works without any paid provider.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class ContactEnrichment:
    """Normalized contact enrichment result from any provider."""
    name: str = ""
    role: str = ""
    organization: str = ""
    email: Optional[str] = None
    email_status: str = "not_found"  # publicly_found, publicly_found_unverified, verified_by_enrichment, not_found
    phone: Optional[str] = None
    phone_type: str = "not_available"  # business_phone, personal_phone_not_verified, not_available
    linkedin_url: Optional[str] = None
    linkedin_status: str = "not_found"  # public_profile_reference, verified_profile, not_found
    confidence: int = 0  # 0-100
    source: str = ""
    source_url: str = ""
    source_type: str = ""  # official_website, leadership_page, contact_page, search_result, enrichment_api
    verification_state: str = "not_found"  # publicly_found, publicly_found_unverified, verified_by_enrichment, not_found, partial
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
            "phone_type": self.phone_type,
            "linkedin_url": self.linkedin_url,
            "linkedin_status": self.linkedin_status,
            "confidence": self.confidence,
            "source": self.source,
            "source_url": self.source_url,
            "source_type": self.source_type,
            "verification_state": self.verification_state,
            "provider_used": self.provider_used,
            "error": self.error,
        }


@dataclass
class EnrichmentResult:
    """Result from an enrichment provider."""
    contacts: List[ContactEnrichment] = field(default_factory=list)
    provider: str = ""
    available: bool = False
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "contacts": [c.to_dict() for c in self.contacts],
            "provider": self.provider,
            "available": self.available,
            "error": self.error,
        }


class ContactEnrichmentProvider(ABC):
    """Abstract interface for contact enrichment providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @property
    @abstractmethod
    def is_available(self) -> bool:
        pass

    @abstractmethod
    def find_contact(
        self,
        organization: str,
        person_name: str = "",
        role: str = "",
        domain: str = "",
    ) -> EnrichmentResult:
        """Find professional contact info for a person at an organization."""
        pass

    @abstractmethod
    def enrich_organization_contacts(
        self,
        organization: str,
        contacts: List[Dict[str, str]],
        domain: str = "",
    ) -> EnrichmentResult:
        """Enrich multiple contacts at an organization."""
        pass
