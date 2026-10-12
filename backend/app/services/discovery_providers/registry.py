import logging
from typing import Dict, Any, List, Optional, Tuple
from app.services.discovery_providers.base import (
    BaseOrganizationDiscoveryProvider,
    BaseContactDiscoveryProvider,
    BaseEmailEnrichmentProvider,
)
from app.services.discovery_providers.directory_provider import DirectoryDiscoveryProvider
from app.services.discovery_providers.contact_provider import ExecutiveContactDiscoveryProvider
from app.services.discovery_providers.enrichment_provider import StandardEmailEnrichmentProvider
from app.services.discovery_providers.tavily_provider import TavilySearchProvider
from app.services.discovery_providers.serper_provider import SerperSearchProvider
from app.services.discovery_providers.ai_agent_researcher import AIAgentLeadResearcher
from app.services.discovery_providers.google_maps_scraper_provider import GoogleMapsScraperProvider
from app.services.discovery_providers.investor_discovery_provider import InvestorDiscoveryProvider

logger = logging.getLogger(__name__)


class FallbackOrgProvider(BaseOrganizationDiscoveryProvider):
    """
    Tries providers in priority order: AI Agent Lead Researcher (Apollo-Grade) → Curated Directory → Tavily → Serper.
    Falls back to next provider on empty results or errors.
    """

    def __init__(self, providers: List[BaseOrganizationDiscoveryProvider]):
        self._providers = providers

    @property
    def provider_name(self) -> str:
        return "Multi-Source Discovery"

    @property
    def provider_type(self) -> str:
        return "multi_source"

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
        for provider in self._providers:
            try:
                results, total = provider.search_organizations(
                    keyword=keyword,
                    location=location,
                    organization_type=organization_type,
                    product_description=product_description,
                    target_icp=target_icp,
                    discovery_objective=discovery_objective,
                    limit=limit,
                    offset=offset,
                )
                if results:
                    logger.info(f"FallbackOrgProvider: {provider.provider_name} returned {total} results")
                    return results, total
                logger.info(f"FallbackOrgProvider: {provider.provider_name} returned 0 results, trying next")
            except Exception as e:
                logger.warning(f"FallbackOrgProvider: {provider.provider_name} failed: {e}")
        return [], 0

    def get_organization_details(self, external_id: str) -> Optional[Dict[str, Any]]:
        for provider in self._providers:
            try:
                result = provider.get_organization_details(external_id)
                if result:
                    return result
            except Exception:
                continue
        return None


class ProviderRegistry:
    """
    Registry for Discovery & Enrichment Providers.
    Encapsulates server-side provider instantiation, security, and rate limiting controls.
    """

    def __init__(self):
        self._org_providers: Dict[str, BaseOrganizationDiscoveryProvider] = {}
        self._contact_providers: Dict[str, BaseContactDiscoveryProvider] = {}
        self._enrichment_providers: Dict[str, BaseEmailEnrichmentProvider] = {}

        # Default standard registrations
        ai_agent = AIAgentLeadResearcher()
        default_dir = DirectoryDiscoveryProvider()
        default_contact = ExecutiveContactDiscoveryProvider()
        default_enrichment = StandardEmailEnrichmentProvider()

        # Web search providers
        tavily = TavilySearchProvider()
        serper = SerperSearchProvider()

        # Local Google Maps scraper: slow (1-3 min per search, one job at a time), so it is
        # NOT in the default chain; pick "Google Maps Scraper (Local)" explicitly in the UI.
        maps_scraper = GoogleMapsScraperProvider()

        # Investor/VC/angel search for the Funding module: a different target
        # audience than client discovery, so never in the default chain either.
        investor_search = InvestorDiscoveryProvider()

        # Primary priority: AI Agent Lead Researcher (Apollo-grade) first!
        fallback = FallbackOrgProvider([ai_agent, default_dir, tavily, serper])

        self.register_org_provider("Multi-Source Discovery (Recommended)", fallback)
        self.register_org_provider("Google Maps Scraper (Local)", maps_scraper)
        self.register_org_provider("Investor & VC Discovery", investor_search)
        self.register_org_provider("AI Agent Lead Researcher (Apollo-Grade)", ai_agent)
        self.register_org_provider("Tavily Web Search", tavily)
        self.register_org_provider("Serper Google Search", serper)
        self.register_org_provider("Curated Directory", default_dir)
        self.register_contact_provider("Executive Decision-Maker Discovery Provider", default_contact)
        self.register_enrichment_provider("Standard Enterprise Email Enrichment", default_enrichment)

    def register_org_provider(self, name: str, provider: BaseOrganizationDiscoveryProvider):
        self._org_providers[name] = provider

    def register_contact_provider(self, name: str, provider: BaseContactDiscoveryProvider):
        self._contact_providers[name] = provider

    def register_enrichment_provider(self, name: str, provider: BaseEmailEnrichmentProvider):
        self._enrichment_providers[name] = provider

    def get_org_provider(self, name: Optional[str] = None) -> BaseOrganizationDiscoveryProvider:
        if name and name in self._org_providers:
            return self._org_providers[name]
        # Return first registered provider as default
        return next(iter(self._org_providers.values()))

    def get_contact_provider(self, name: Optional[str] = None) -> BaseContactDiscoveryProvider:
        if name and name in self._contact_providers:
            return self._contact_providers[name]
        return next(iter(self._contact_providers.values()))

    def get_enrichment_provider(self, name: Optional[str] = None) -> BaseEmailEnrichmentProvider:
        if name and name in self._enrichment_providers:
            return self._enrichment_providers[name]
        return next(iter(self._enrichment_providers.values()))

    def list_available_providers(self) -> Dict[str, List[Dict[str, Any]]]:
        return {
            "organization_providers": [
                {"name": name, "type": prov.provider_type}
                for name, prov in self._org_providers.items()
            ],
            "contact_providers": [
                {"name": name}
                for name in self._contact_providers.keys()
            ],
            "enrichment_providers": [
                {"name": name}
                for name in self._enrichment_providers.keys()
            ],
        }


# Global singleton registry
discovery_registry = ProviderRegistry()
