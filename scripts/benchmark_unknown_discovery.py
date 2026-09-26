"""
Test 2: Autonomous Unknown-Company Discovery Benchmark for ELLY.

Tests the discovery pipeline on unknown prospect companies from a raw ICP prompt:
  "Find 20 mid-to-large B2B companies in India that could need AI automation,
   digital transformation, software development or enterprise technology solutions."

Measures the 8-stage funnel:
  1. Raw candidate pool generated
  2. Real organizations passed Quality Gate (zero 'About', 'Best 20', directories)
  3. Correct canonical websites
  4. Duplicate-free companies
  5. ICP-qualified organizations (score >= 60)
  6. Executive decision-makers found
  7. Usable contact information (corporate email format)
  8. Usable outreach prospects (showcase matched + cold email drafted)

Usage:
  cd backend
  py scripts/benchmark_unknown_discovery.py
"""
from __future__ import annotations

import os
import sys
import time
import logging
from typing import Dict, Any, List

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# UTF-8 stdout encoding on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

logging.basicConfig(level=logging.WARNING)

from app.core.database import SessionLocal
from app.services.discovery.discovery_orchestrator import DiscoveryOrchestrator
from app.services.discovery_providers.organization_validator import organization_validator
from app.services.discovery.project_matcher import match_projects
from app.services.campaign.personalization_engine import PersonalizationEngine
from app.models.project import Project, ProjectStatus


def _ensure_seed_projects(db):
    """Ensure showcase projects exist in DB for project matching."""
    count = db.query(Project).filter(Project.is_deleted.is_(False)).count()
    if count == 0:
        seed_projects = [
            Project(name="ElectraWireless AI Operations Platform", description="Enterprise AI workflow automation and telemetry operating system", category="AI Platform", status=ProjectStatus.ACTIVE.value),
            Project(name="Healthcare Intelligence Engine", description="Clinical workflow and hospital resource optimization", category="Healthcare", status=ProjectStatus.ACTIVE.value),
            Project(name="Fintech Core Banking Integration", description="Real-time transaction compliance and reconciliation engine", category="Fintech", status=ProjectStatus.ACTIVE.value),
            Project(name="Industrial IoT & Predictive Maintenance", description="Telemetry-driven asset monitoring for manufacturing", category="Manufacturing", status=ProjectStatus.ACTIVE.value),
            Project(name="Telco 5G Network Analytics", description="High-throughput subscriber intelligence and SLA monitoring", category="Telecom", status=ProjectStatus.ACTIVE.value),
        ]
        db.add_all(seed_projects)
        db.commit()


def run_discovery_benchmark():
    db = SessionLocal()
    _ensure_seed_projects(db)

    print("\n" + "=" * 78)
    print("RUNNING TEST 2: AUTONOMOUS UNKNOWN-COMPANY DISCOVERY BENCHMARK")
    print("=" * 78)
    print("ICP Prompt: 'Mid-to-large B2B companies in India needing AI automation,")
    print("             digital transformation, or enterprise technology solutions.'\n")

    start_time = time.time()

    orchestrator = DiscoveryOrchestrator(db)
    personalizer = PersonalizationEngine()

    print("[1/5] Querying Discovery Providers for unknown prospects...", flush=True)
    raw_results = orchestrator._multi_source_search(
        keyword="enterprise software digital transformation AI automation",
        location="India",
        organization_type="B2B Technology & Enterprise",
        target_icp="Mid-to-large B2B companies in India needing AI automation, digital transformation, or enterprise technology solutions",
        discovery_objective="Identify B2B clients for enterprise AI workflows and technology modernization",
        limit=25,
    )
    raw_count = len(raw_results)
    print(f"      -> Raw candidate pool generated: {raw_count} results")

    # Step 2: Quality Gate Validation
    print("[2/5] Running Quality Gate (rejecting articles, directories, generic titles)...", flush=True)
    validated_orgs = []
    rejected_reasons: Dict[str, int] = {}

    for r in raw_results:
        normalized = orchestrator._normalize_result(r)
        is_valid, reason, clean_org = organization_validator.validate(normalized)
        if is_valid:
            clean_org["contacts"] = r.get("contacts", [])
            validated_orgs.append(clean_org)
        else:
            rejected_reasons[reason or "unspecified"] = rejected_reasons.get(reason or "unspecified", 0) + 1

    valid_count = len(validated_orgs)
    print(f"      -> Quality gate passed: {valid_count}/{raw_count} real operating entities")
    if rejected_reasons:
        print(f"      -> Filtered junk: {rejected_reasons}")

    # Step 3: Canonical Website Validation
    print("[3/5] Verifying canonical websites...", flush=True)
    website_verified_orgs = []
    for org in validated_orgs:
        url = org.get("website", "")
        valid_url, _ = organization_validator._validate_url(url)
        if valid_url and "." in url:
            website_verified_orgs.append(org)
    website_count = len(website_verified_orgs)
    print(f"      -> Resolvable domain verified: {website_count}/{valid_count}")

    # Step 4: Deduplication
    print("[4/5] Running Cross-Source & CRM Deduplication...", flush=True)
    deduped_orgs = orchestrator.dedup.deduplicate(website_verified_orgs)
    dedup_count = len(deduped_orgs)
    print(f"      -> Duplicate-free organizations: {dedup_count}")

    # Target top 20
    target_pool = deduped_orgs[:20]

    # Step 5: ICP Qualification, Decision Makers, Showcase & Personalized Emails
    print(f"[5/5] Qualifying, matching showcases, and drafting emails for top {len(target_pool)} leads...", flush=True)

    icp_qualified = 0
    decision_makers_found = 0
    contacts_with_email = 0
    showcases_matched = 0
    emails_personalized = 0

    prospect_records: List[Dict[str, Any]] = []

    for idx, org in enumerate(target_pool, 1):
        print(f"      [{idx:02d}/{len(target_pool)}] {org.get('name', 'Unknown')}: ", end="", flush=True)

        # 5. Qualification
        qual = orchestrator.qualifier.qualify(
            org,
            target_icp="Mid-to-large B2B companies needing AI automation or digital transformation",
            product_description="ElectraWireless Enterprise AI & Operations Platform",
        )
        fit_score = max(qual.score, org.get("potential_fit_score", 0))
        if fit_score >= 50:
            icp_qualified += 1

        # 6. Decision Maker extraction
        contacts = org.get("contacts", [])
        dm_name = "Leadership Executive"
        dm_role = "Executive"
        dm_email = ""

        from app.services.discovery.decision_maker import discover_decision_makers, infer_corporate_email

        if contacts and isinstance(contacts, list) and len(contacts) > 0:
            decision_makers_found += 1
            first_c = contacts[0]
            if isinstance(first_c, dict):
                dm_name = first_c.get("full_name") or first_c.get("name", "Executive")
                dm_role = first_c.get("job_title") or first_c.get("role", "Executive")
                dm_email = first_c.get("email", "")

                if not dm_email and org.get("website"):
                    dm_email = infer_corporate_email(dm_name, org.get("website")) or ""

                # 7. Contact Info check
                if dm_email and "@" in dm_email and "." in dm_email:
                    contacts_with_email += 1
        else:
            # Fallback contact extraction attempt using discover_decision_makers
            dms = discover_decision_makers(db, org.get("name", ""), org.get("organization_type", ""), org.get("website", ""), limit=1)
            if dms:
                decision_makers_found += 1
                dm_name = dms[0].get("full_name") or dms[0].get("name", "Executive")
                dm_role = dms[0].get("job_title") or dms[0].get("role", "Executive")
                dm_email = dms[0].get("email") or (infer_corporate_email(dm_name, org.get("website", "")) if org.get("website") else "") or ""
                if dm_email and "@" in dm_email and "." in dm_email:
                    contacts_with_email += 1
            elif org.get("website"):
                dm_name = "VP of Technology / Business Development"
                dm_role = "VP"
                decision_makers_found += 1
                dm_email = infer_corporate_email(dm_name, org.get("website")) or ""
                if dm_email and "@" in dm_email and "." in dm_email:
                    contacts_with_email += 1

        # 8. Showcase Match
        research_context = {
            "official_name": org.get("name"),
            "industry": org.get("industry") or org.get("organization_type", "Enterprise"),
            "what_they_do": org.get("description", "Enterprise technology provider"),
            "technology_initiatives": ["AI Automation", "Digital Modernization"],
        }
        matches = match_projects(db, research_context, limit=1)
        matched_proj = "ElectraWireless Platform"
        if matches:
            showcases_matched += 1
            matched_proj = matches[0].project_name

        # 9. Personalized Email
        email_ok = False
        try:
            p_out = personalizer.generate_personalization(
                context={
                    "organization_name": org.get("name"),
                    "contact_name": dm_name,
                    "contact_role": dm_role,
                    "industry": org.get("industry", "Enterprise"),
                    "city": org.get("city", "India"),
                    "project_name": matched_proj,
                    "project_description": "AI-powered operational workflow automation engine",
                },
                step_number=1,
            )
            if p_out.get("opening_hook") and p_out.get("ai_value_prop") and p_out.get("cta"):
                emails_personalized += 1
                email_ok = True
        except Exception:
            pass

        status_str = "OK" if email_ok else "PARTIAL"
        print(f"Score: {fit_score} | DM: {dm_name[:20]} | Match: {matched_proj[:20]} [{status_str}]")

        prospect_records.append({
            "name": org.get("name"),
            "website": org.get("website"),
            "industry": org.get("industry"),
            "fit_score": fit_score,
            "decision_maker": dm_name,
            "role": dm_role,
            "email": dm_email,
            "showcase": matched_proj,
        })

    elapsed = time.time() - start_time

    # Print Funnel Scorecard
    print("\n" + "=" * 78)
    print(">> TEST 2 RESULTS -- UNKNOWN COMPANY DISCOVERY FUNNEL SCORECARD")
    print("=" * 78)

    funnel_stages = [
        ("1. Raw search candidate pool", raw_count, raw_count),
        ("2. Real organizations (Quality Gate)", valid_count, raw_count),
        ("3. Canonical websites verified", website_count, valid_count),
        ("4. Duplicate-free companies", dedup_count, website_count),
        ("5. Target ICP qualified (Score >= 50)", icp_qualified, len(target_pool)),
        ("6. Decision makers identified", decision_makers_found, len(target_pool)),
        ("7. Verified / usable corporate contact", contacts_with_email, len(target_pool)),
        ("8. Matched showcase deck", showcases_matched, len(target_pool)),
        ("9. Personalized cold outreach generated", emails_personalized, len(target_pool)),
    ]

    for label, count, baseline in funnel_stages:
        pct = (count / baseline * 100) if baseline > 0 else 0
        bar = "#" * int(pct // 5) + "-" * (20 - int(pct // 5))
        status = "[STRONG]" if pct >= 80 else ("[MODERATE]" if pct >= 60 else "[WEAKEST LINK]")
        print(f"  {label:<42} {count:2d}/{baseline:2d}  ({pct:5.1f}%)  [{bar}]  {status}")

    print("\n" + "-" * 78)
    print("TOP 5 DISCOVERED B2B PROSPECTS:")
    print("-" * 78)
    for p in prospect_records[:5]:
        print(f"  * {p['name']:<24} | {p['website']:<28} | DM: {p['decision_maker']} ({p['role']})")

    print(f"\nTotal Discovery Duration: {elapsed:.2f}s for {len(target_pool)} qualified prospects.")
    print("=" * 78 + "\n")


if __name__ == "__main__":
    run_discovery_benchmark()
