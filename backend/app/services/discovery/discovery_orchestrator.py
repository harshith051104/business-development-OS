"""
Discovery Orchestrator — coordinates multi-source discovery, research,
qualification, deduplication, and decision-maker discovery.
"""
import logging
from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.discovery import DiscoveredOrganization, DiscoveredContact, DiscoveryStatus
from app.models.organization import Organization
from app.services.discovery_providers.registry import discovery_registry
from app.services.discovery_providers.ai_qualification import qualify_organization, qualify_contact
from app.services.discovery_engine import check_organization_duplicate
from app.services.research.research_engine import research_organization
from app.services.discovery.deduplication import DeduplicationEngine
from app.services.discovery.qualification import ExplainableQualification
from app.services.discovery_providers.organization_validator import organization_validator
from app.services.discovery.decision_maker import discover_decision_makers
from app.services.discovery.brief_generator import generate_research_brief
from app.services.discovery.project_matcher import match_projects

logger = logging.getLogger(__name__)


class DiscoveryOrchestrator:
    """
    Orchestrates the full FIND → RESEARCH → QUALIFY → DECISION MAKER → CRM flow.
    Does NOT replace existing providers — aggregates and enhances them.
    """

    def __init__(self, db: Session):
        self.db = db
        self.dedup = DeduplicationEngine(db)
        self.qualifier = ExplainableQualification()

    def discover(
        self,
        product_description: str = "",
        target_icp: str = "",
        location: str = "",
        organization_type: str = "",
        discovery_objective: str = "",
        keyword: str = "",
        provider: str = "",
        limit: int = 20,
        research: bool = True,
    ) -> Dict[str, Any]:
        """
        Full discovery pipeline: search → normalize → dedup → research → qualify.
        Returns aggregated, deduplicated, qualified results.
        """
        # 1. Multi-source search
        all_results = self._multi_source_search(
            keyword=keyword,
            location=location,
            organization_type=organization_type,
            product_description=product_description,
            target_icp=target_icp,
            discovery_objective=discovery_objective,
            provider=provider,
            limit=limit,
        )

        # 1.5. Maps listings often lack an email: scrape public contact emails from their websites
        try:
            from app.services.discovery_providers.executive_finder import fill_missing_org_emails
            fill_missing_org_emails([r for r in all_results if r.get("source_type") == "maps_scraper"])
        except Exception as e:
            logger.debug("Maps email fill failed: %s", e)

        # 2. Normalize
        normalized = [self._normalize_result(r) for r in all_results]

        # 2.5. Validate through quality gate
        validated = []
        rejected_count = 0
        for org in normalized:
            is_valid, reason, clean_org = organization_validator.validate(org)
            if is_valid:
                clean_org["contacts"] = org.get("contacts", [])
                clean_org["employee_count"] = org.get("employee_count", "")
                validated.append(clean_org)
            else:
                rejected_count += 1
                logger.debug("Quality gate rejected: %s — %s", org.get("name"), reason)

        if rejected_count:
            logger.info("Quality gate: %d/%d results rejected", rejected_count, len(normalized))

        # 3. Deduplicate across sources + check CRM
        deduplicated = self.dedup.deduplicate(validated)

        # 4. Research top results (if enabled)
        if research and settings.SCRAPEGRAPH_ENABLED:
            for i, org in enumerate(deduplicated[:min(limit, 10)]):
                if org.get("website") and not org.get("research_status"):
                    try:
                        research_data = research_organization(org["website"])
                        if research_data.get("research_status") == "completed":
                            org["research"] = research_data
                            org["research_status"] = "completed"
                            self._enrich_from_research(org, research_data)
                        elif research_data.get("research_status") == "timeout":
                            org["research_status"] = "timeout"
                            logger.warning("Research timeout for %s — skipping, continuing batch", org["name"])
                        elif research_data.get("research_status") == "blocked":
                            org["research_status"] = "blocked"
                            logger.warning("Research blocked for %s — skipping, continuing batch", org["name"])
                        else:
                            org["research_status"] = "failed"
                    except Exception as e:
                        org["research_status"] = "failed"
                        logger.warning("Research exception for %s: %s — continuing batch", org["name"], str(e)[:100])

        # 5. Qualify with explainable scoring
        for org in deduplicated:
            qual = self.qualifier.qualify(
                org,
                product_description=product_description,
                target_icp=target_icp,
                discovery_objective=discovery_objective,
            )
            org["qualification"] = qual.model_dump()
            ai_score = org.get("potential_fit_score", 0)
            if ai_score >= 80:
                org["potential_fit"] = "High"
                org["potential_fit_score"] = max(ai_score, qual.score)
            else:
                org["potential_fit"] = qual.tier
                org["potential_fit_score"] = qual.score
            if not org.get("qualification_reason"):
                org["qualification_reason"] = "; ".join(qual.positive_signals[:3])

        # 6. Sort by fit score
        deduplicated.sort(key=lambda x: x.get("potential_fit_score", 0), reverse=True)

        return {
            "organizations": deduplicated[:limit],
            "total_raw": len(all_results),
            "total_deduplicated": len(deduplicated),
            "sources_used": list(set(r.get("source_name", "unknown") for r in all_results)),
        }

    def research_single(self, org_id: int) -> Optional[Dict[str, Any]]:
        """Research a single discovered organization by ID."""
        disc_org = self.db.query(DiscoveredOrganization).filter(
            DiscoveredOrganization.id == org_id
        ).first()
        if not disc_org:
            return None

        url = disc_org.website
        if not url:
            return {"research_status": "failed", "error": "No website URL"}

        research_data = research_organization(url, force_refresh=True)
        if research_data.get("research_status") == "completed":
            # Generate brief
            brief = generate_research_brief(disc_org, research_data)
            # Match projects
            projects = match_projects(self.db, research_data)
            return {
                "research": research_data,
                "brief": brief.model_dump(),
                "matched_projects": [p.model_dump() for p in projects],
            }
        return research_data

    def qualify_single(self, org_id: int) -> Optional[Dict[str, Any]]:
        """Re-qualify a single organization with explainable scoring."""
        disc_org = self.db.query(DiscoveredOrganization).filter(
            DiscoveredOrganization.id == org_id
        ).first()
        if not disc_org:
            return None

        org_dict = {
            "name": disc_org.name,
            "organization_type": disc_org.organization_type,
            "description": disc_org.description or "",
            "city": disc_org.city or "",
            "country": disc_org.country or "",
            "website": disc_org.website or "",
        }
        qual = self.qualifier.qualify(
            org_dict,
            product_description=disc_org.product_description or "",
            target_icp=disc_org.target_icp or "",
            discovery_objective=disc_org.discovery_objective or "",
        )
        return qual.model_dump()

    def discover_decision_makers(self, org_id: int, roles: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Discover decision-makers for a specific organization."""
        disc_org = self.db.query(DiscoveredOrganization).filter(
            DiscoveredOrganization.id == org_id
        ).first()
        if not disc_org:
            return []

        return discover_decision_makers(
            db=self.db,
            organization_name=disc_org.name,
            organization_type=disc_org.organization_type,
            website=disc_org.website,
            target_roles=roles,
            city=disc_org.city or "",
        )

    def get_brief(self, org_id: int) -> Optional[Dict[str, Any]]:
        """Generate a research brief for a discovered organization."""
        disc_org = self.db.query(DiscoveredOrganization).filter(
            DiscoveredOrganization.id == org_id
        ).first()
        if not disc_org:
            return None

        research_data = {}
        if disc_org.website:
            research_data = research_organization(disc_org.website)

        brief = generate_research_brief(disc_org, research_data)
        projects = match_projects(self.db, research_data) if research_data else []
        brief.recommended_showcase_projects = [p.project_name for p in projects]

        return brief.model_dump()

    def _multi_source_search(
        self,
        keyword: str = "",
        location: str = "",
        organization_type: str = "",
        product_description: str = "",
        target_icp: str = "",
        discovery_objective: str = "",
        provider: str = "",
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Search across all configured providers and aggregate results."""
        all_results = []

        if provider and provider != "Multi-Source Discovery (Recommended)":
            # Use specific provider
            try:
                p = discovery_registry.get_org_provider(provider)
                results, _ = p.search_organizations(
                    keyword=keyword or None,
                    location=location or None,
                    organization_type=organization_type or None,
                    product_description=product_description or None,
                    target_icp=target_icp or None,
                    discovery_objective=discovery_objective or None,
                    limit=limit,
                )
                all_results.extend(results)
            except Exception as e:
                logger.warning(f"Provider {provider} failed: {e}")
        else:
            # Try providers in order: AI Agent Lead Researcher (Apollo-Grade) -> Curated Directory -> Tavily -> Serper
            for provider_name in ["AI Agent Lead Researcher (Apollo-Grade)", "Curated Directory", "Tavily Web Search", "Serper Google Search"]:
                try:
                    p = discovery_registry.get_org_provider(provider_name)
                    results, _ = p.search_organizations(
                        keyword=keyword or None,
                        location=location or None,
                        organization_type=organization_type or None,
                        product_description=product_description or None,
                        target_icp=target_icp or None,
                        discovery_objective=discovery_objective or None,
                        limit=limit,
                    )
                    all_results.extend(results)
                    if len(all_results) >= limit:
                        break
                except Exception as e:
                    logger.warning(f"Provider {provider_name} failed: {e}")

        return all_results

    def _normalize_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure consistent field structure across providers."""
        return {
            "name": result.get("name", "Unknown"),
            "organization_type": result.get("organization_type", "Unknown"),
            "description": result.get("description", ""),
            "website": result.get("website", ""),
            "email": result.get("email", ""),
            "phone": result.get("phone", ""),
            "city": result.get("city", ""),
            "state": result.get("state", ""),
            "country": result.get("country", ""),
            "address": result.get("address", ""),
            "industry": result.get("industry", "Unknown"),
            "source_type": result.get("source_type", "search"),
            "source_name": result.get("source_name", "Unknown"),
            "source_url": result.get("source_url", ""),
            "potential_fit_score": result.get("potential_fit_score", 50),
            "qualification_reason": result.get("qualification_reason", ""),
            "contacts": result.get("contacts", []),
            "employee_count": result.get("employee_count", ""),
        }

    def _enrich_from_research(self, org: Dict[str, Any], research: Dict[str, Any]):
        """Enrich org data from research results."""
        if research.get("what_they_do") and not org.get("description"):
            org["description"] = research["what_they_do"]
        if research.get("headquarters") and not org.get("city"):
            org["city"] = research["headquarters"]
        if research.get("industry") and not org.get("industry"):
            org["industry"] = research["industry"]
        if research.get("organization_type") and org.get("organization_type") in ["Unknown", "Other"]:
            org["organization_type"] = research["organization_type"]
