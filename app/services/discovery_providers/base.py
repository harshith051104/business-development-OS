from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Tuple


class BaseOrganizationDiscoveryProvider(ABC):
    """
    Abstract provider interface for B2B Organization Discovery.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @property
    @abstractmethod
    def provider_type(self) -> str:
        """e.g. 'directory', 'search_engine', 'api'"""
        pass

    @abstractmethod
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
        """
        Searches target organizations based on criteria and returns (results, total_count).
        """
        pass

    @abstractmethod
    def get_organization_details(self, external_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves deep details for a single organization."""
        pass


class BaseContactDiscoveryProvider(ABC):
    """
    Abstract provider interface for Executive Decision-Maker Discovery.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @abstractmethod
    def search_decision_makers(
        self,
        organization_name: str,
        organization_type: Optional[str] = None,
        website: Optional[str] = None,
        target_roles: Optional[List[str]] = None,
        product_description: Optional[str] = None,
        discovery_objective: Optional[str] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Finds key leadership / business decision-makers matching the target roles.
        """
        pass


class BaseEmailEnrichmentProvider(ABC):
    """
    Abstract provider interface for optional Business Email & Profile Enrichment.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @abstractmethod
    def enrich_contact(
        self,
        full_name: str,
        organization_name: str,
        website: Optional[str] = None,
        job_title: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Looks up business contact email/profile info safely without mass-harvesting.
        Returns dict with: email, email_status, linkedin_url, phone, verified.
        """
        pass
