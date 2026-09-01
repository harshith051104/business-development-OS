r"""
Phase 22 — Real-World Lead Discovery Validation Runner.

Executes real discovery scenarios against live providers (when configured).
Produces a structured validation report.

Usage:
    cd backend
    .venv\Scripts\python.exe -m tests.phase22_validation
"""
from __future__ import annotations

import json
import logging
import sys
import time
from pathlib import Path

# Ensure backend root is on sys.path
_backend_root = str(Path(__file__).resolve().parent.parent)
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class ValidationOrg:
    name: str = ""
    website: str = ""
    city: str = ""
    country: str = ""
    org_type: str = ""
    source: str = ""
    source_url: str = ""
    research_status: str = "not_researched"
    fit_score: int = 0
    fit_tier: str = ""
    crm_status: str = "NEW_LEAD"
    dedup_evidence: List[str] = field(default_factory=list)
    signals: Dict[str, Any] = field(default_factory=dict)
    decision_makers: List[Dict[str, Any]] = field(default_factory=list)
    brief: Optional[Dict[str, Any]] = None
    project_match: Optional[str] = None
    errors: List[str] = field(default_factory=list)


@dataclass
class ValidationReport:
    scenario: str = ""
    query: str = ""
    timestamp: str = ""
    duration_seconds: float = 0
    organizations_found: int = 0
    valid_organizations: int = 0
    duplicates: int = 0
    organizations_researched: int = 0
    decision_makers_found: int = 0
    emails_publicly_available: int = 0
    emails_verified: int = 0
    fit_scores: List[int] = field(default_factory=list)
    avg_fit_score: float = 0
    median_fit_score: float = 0
    project_matches: List[str] = field(default_factory=list)
    provider_status: Dict[str, str] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    organizations: List[ValidationOrg] = field(default_factory=list)


SCENARIOS = [
    {
        "id": "A",
        "name": "Large hospitals in Hyderabad",
        "keyword": "hospital",
        "location": "Hyderabad",
        "organization_type": "Hospital",
        "target_icp": "Large healthcare organizations, hospital groups, 1000+ beds, digital transformation",
        "discovery_objective": "Identify technology partnership opportunities",
        "limit": 10,
    },
    {
        "id": "B",
        "name": "Hospital groups in India",
        "keyword": "hospital group",
        "location": "India",
        "organization_type": "Hospital Group",
        "target_icp": "Multi-location hospital groups, enterprise healthcare, digital transformation",
        "discovery_objective": "Technology partnership for healthcare intelligence",
        "limit": 10,
    },
    {
        "id": "C",
        "name": "Hospitals with digital transformation",
        "keyword": "hospital digital transformation AI",
        "location": "India",
        "organization_type": "Hospital",
        "target_icp": "Hospitals with active digital transformation or AI initiatives",
        "discovery_objective": "Find organizations investing in healthcare technology",
        "limit": 10,
    },
]


def check_provider_status() -> Dict[str, str]:
    """Check real provider availability."""
    from app.core.config import settings
    status = {}

    status["Tavily"] = "CONNECTED" if settings.TAVILY_API_KEY else "NOT_CONFIGURED"
    status["Serper"] = "CONNECTED" if settings.SERPER_API_KEY else "NOT_CONFIGURED"
    status["ScrapeGraphAI"] = "CONNECTED" if settings.SCRAPEGRAPH_ENABLED else "DISABLED"
    status["OpenOutreach"] = "ADAPTER_READY" if settings.OPENOUTREACH_ENABLED else "DISABLED"
    status["BetterContact"] = "DISABLED" if not settings.BETTERCONTACT_ENABLED else (
        "CONNECTED" if settings.BETTERCONTACT_API_KEY else "NOT_CONFIGURED"
    )
    status["LLM"] = "CONNECTED" if (settings.GROQ_API_KEY or settings.NVIDIA_NIM_API_KEY or settings.GEMINI_API_KEY) else "NOT_CONFIGURED"
    status["PublicWeb"] = "CONNECTED" if (settings.TAVILY_API_KEY or settings.SERPER_API_KEY) else "NOT_CONFIGURED"
    return status


def run_scenario(scenario: Dict[str, Any], db=None) -> ValidationReport:
    """Run a single validation scenario."""
    report = ValidationReport(
        scenario=scenario["id"],
        query=scenario["name"],
        timestamp=datetime.now(timezone.utc).isoformat(),
    )

    start_time = time.time()

    try:
        # Use the discovery orchestrator
        from app.services.discovery.discovery_orchestrator import DiscoveryOrchestrator
        from app.services.discovery.deduplication import DeduplicationEngine
        from app.services.discovery.qualification import ExplainableQualification

        if db is None:
            from app.core.database import SessionLocal
            db = SessionLocal()

        orch = DiscoveryOrchestrator(db)

        # Run discovery
        result = orch.discover(
            keyword=scenario.get("keyword", ""),
            location=scenario.get("location", ""),
            organization_type=scenario.get("organization_type", ""),
            target_icp=scenario.get("target_icp", ""),
            discovery_objective=scenario.get("discovery_objective", ""),
            limit=scenario.get("limit", 10),
            research=True,
        )

        report.duration_seconds = round(time.time() - start_time, 2)
        orgs_list = result.get("organizations", result.get("results", []))
        report.organizations_found = result.get("total_deduplicated", len(orgs_list))

        for org_data in orgs_list:
            org = ValidationOrg(
                name=org_data.get("name", ""),
                website=org_data.get("website", ""),
                city=org_data.get("city", ""),
                country=org_data.get("country", ""),
                org_type=org_data.get("organization_type", ""),
                source=org_data.get("source_name", ""),
                source_url=org_data.get("source_url", ""),
                research_status=org_data.get("research_status", "not_researched"),
                fit_score=org_data.get("potential_fit_score", 0),
                fit_tier=org_data.get("potential_fit", ""),
                crm_status=org_data.get("crm_status", "NEW_LEAD"),
                dedup_evidence=org_data.get("dedup_evidence", []),
            )

            # Extract research signals
            research = org_data.get("research", {})
            if isinstance(research, dict):
                org.signals = {
                    k: v for k, v in research.items()
                    if v and k in [
                        "digital_transformation", "ai_adoption", "telemedicine",
                        "automation", "technology_initiatives", "approximate_scale",
                        "services", "summary",
                    ]
                }

            # Check for decision makers
            if org_data.get("decision_makers"):
                org.decision_makers = org_data["decision_makers"]
                report.decision_makers_found += len(org_data["decision_makers"])
                for dm in org.decision_makers:
                    if dm.get("email"):
                        report.emails_publicly_available += 1
                    if dm.get("verification_state") == "verified_by_enrichment":
                        report.emails_verified += 1

            if org.fit_score:
                report.fit_scores.append(org.fit_score)

            if org.research_status == "completed":
                report.organizations_researched += 1

            if org.crm_status == "NEW_LEAD":
                report.valid_organizations += 1
            else:
                report.duplicates += 1

            report.organizations.append(org)

        # Calculate stats
        if report.fit_scores:
            report.avg_fit_score = round(sum(report.fit_scores) / len(report.fit_scores), 1)
            sorted_scores = sorted(report.fit_scores)
            mid = len(sorted_scores) // 2
            report.median_fit_score = sorted_scores[mid]

    except Exception as e:
        report.errors.append(f"Scenario failed: {str(e)}")
        report.duration_seconds = round(time.time() - start_time, 2)
        logger.exception("Scenario %s failed", scenario["id"])

    report.provider_status = check_provider_status()
    return report


def run_all_scenarios(db=None) -> List[ValidationReport]:
    """Run all validation scenarios."""
    reports = []
    for scenario in SCENARIOS:
        logger.info("Running scenario %s: %s", scenario["id"], scenario["name"])
        report = run_scenario(scenario, db)
        reports.append(report)
    return reports


def generate_report(reports: List[ValidationReport]) -> str:
    """Generate a human-readable validation report."""
    lines = []
    lines.append("=" * 70)
    lines.append("PHASE 22 — REAL-WORLD LEAD DISCOVERY VALIDATION REPORT")
    lines.append("=" * 70)
    lines.append(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    lines.append("")

    # Provider Status
    lines.append("## PROVIDER STATUS")
    lines.append("-" * 40)
    if reports:
        for name, status in reports[0].provider_status.items():
            lines.append(f"  {name}: {status}")
    lines.append("")

    # Scenario Results
    for report in reports:
        lines.append(f"## SCENARIO {report.scenario}: {report.query}")
        lines.append("-" * 40)
        lines.append(f"  Duration: {report.duration_seconds}s")
        lines.append(f"  Organizations found: {report.organizations_found}")
        lines.append(f"  Valid organizations: {report.valid_organizations}")
        lines.append(f"  Duplicates: {report.duplicates}")
        lines.append(f"  Researched: {report.organizations_researched}")
        lines.append(f"  Decision makers found: {report.decision_makers_found}")
        lines.append(f"  Emails publicly available: {report.emails_publicly_available}")
        lines.append(f"  Emails verified: {report.emails_verified}")
        if report.fit_scores:
            lines.append(f"  Avg fit score: {report.avg_fit_score}")
            lines.append(f"  Median fit score: {report.median_fit_score}")
        if report.errors:
            lines.append(f"  Errors: {', '.join(report.errors)}")
        lines.append("")

        # Organization details
        for i, org in enumerate(report.organizations[:5], 1):
            lines.append(f"  {i}. {org.name}")
            lines.append(f"     Website: {org.website or 'N/A'}")
            lines.append(f"     Location: {org.city or '?'}, {org.country or '?'}")
            lines.append(f"     Type: {org.org_type or 'Unknown'}")
            lines.append(f"     Source: {org.source}")
            lines.append(f"     Research: {org.research_status}")
            lines.append(f"     Fit: {org.fit_score}/100 ({org.fit_tier})")
            lines.append(f"     CRM: {org.crm_status}")
            if org.dedup_evidence:
                lines.append(f"     Dedup evidence: {'; '.join(org.dedup_evidence)}")
            if org.signals:
                sigs = [k for k, v in org.signals.items() if v]
                lines.append(f"     Signals: {', '.join(sigs[:5])}")
            if org.decision_makers:
                for dm in org.decision_makers[:2]:
                    lines.append(f"     DM: {dm.get('name', '?')} — {dm.get('role', '?')} [{dm.get('verification_state', '?')}]")
            lines.append("")

    # Summary
    total_orgs = sum(r.organizations_found for r in reports)
    total_valid = sum(r.valid_organizations for r in reports)
    total_dupes = sum(r.duplicates for r in reports)
    total_researched = sum(r.organizations_researched for r in reports)
    total_dms = sum(r.decision_makers_found for r in reports)
    total_emails = sum(r.emails_publicly_available for r in reports)
    all_scores = []
    for r in reports:
        all_scores.extend(r.fit_scores)

    lines.append("=" * 70)
    lines.append("SUMMARY")
    lines.append("=" * 70)
    lines.append(f"  Total organizations found: {total_orgs}")
    lines.append(f"  Valid organizations: {total_valid}")
    lines.append(f"  Duplicates detected: {total_dupes}")
    lines.append(f"  Researched: {total_researched}")
    lines.append(f"  Decision makers found: {total_dms}")
    lines.append(f"  Emails publicly available: {total_emails}")
    if all_scores:
        lines.append(f"  Average fit score: {round(sum(all_scores) / len(all_scores), 1)}")
    lines.append("")
    lines.append("NOTE: This report uses LIVE provider data when configured.")
    lines.append("Results depend on API key availability and provider status.")
    lines.append("=" * 70)

    return "\n".join(lines)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    reports = run_all_scenarios()
    report_text = generate_report(reports)
    print(report_text)

    # Save to file
    with open("phase22_validation_report.txt", "w") as f:
        f.write(report_text)
    print(f"\nReport saved to phase22_validation_report.txt")
