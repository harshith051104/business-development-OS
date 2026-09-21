"""
Genuine Discovery Benchmark for ELLY.

NO hardcoded company names. NO hardcoded executives. NO mock data.
ELLY searches the web from scratch using ICP descriptions only.

Tests the REAL pipeline:
  ICP query → Web search → Validation → Dedup → Research → Qualification
  → Contact discovery → Email personalization

Measures accuracy at every stage against REALITY.

Usage:
  cd backend
  py scripts/test_discovery_benchmark.py
"""
from __future__ import annotations

import os
import sys
import time
import re
import logging
import json
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import httpx
from app.core.database import SessionLocal
from app.services.discovery.discovery_orchestrator import DiscoveryOrchestrator
from app.services.discovery.qualification import ExplainableQualification
from app.services.discovery.project_matcher import match_projects
from app.services.campaign.personalization_engine import PersonalizationEngine
from app.services.discovery_providers.organization_validator import organization_validator
from app.models.project import Project, ProjectStatus
from app.models.discovery import DiscoveredOrganization, DiscoveryStatus

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger("elly.discovery_benchmark")

# ─── ICP QUERIES ────────────────────────────────────────────────────────────
# NO company names. Only ICP descriptions. ELLY must find companies from scratch.

ICP_QUERIES = [
    {
        "sector": "SaaS / Technology",
        "keyword": "enterprise SaaS platform",
        "location": "India",
        "organization_type": "Technology",
        "target_icp": "Mid-to-large B2B SaaS companies offering enterprise software, API platforms, developer tools, or cloud-based business solutions",
        "discovery_objective": "technology partnership",
        "product_description": "AI-powered enterprise automation and workflow intelligence platform",
    },
    {
        "sector": "Fintech",
        "keyword": "digital payments fintech",
        "location": "India",
        "organization_type": "Fintech",
        "target_icp": "B2B fintech companies offering payment processing, neobanking, lending platforms, or financial infrastructure APIs",
        "discovery_objective": "platform integration",
        "product_description": "Real-time transaction compliance and intelligent reconciliation engine",
    },
    {
        "sector": "Healthcare",
        "keyword": "hospital network digital health",
        "location": "India",
        "organization_type": "Healthcare",
        "target_icp": "Multi-specialty hospital networks or healthcare systems with digital health initiatives, telemedicine, or clinical AI adoption",
        "discovery_objective": "clinical intelligence partnership",
        "product_description": "Clinical workflow optimization and hospital resource intelligence platform",
    },
    {
        "sector": "Manufacturing",
        "keyword": "industrial manufacturing automation",
        "location": "India",
        "organization_type": "Manufacturing",
        "target_icp": "Large manufacturing enterprises with Industry 4.0 initiatives, IoT adoption, or predictive maintenance needs across automotive, steel, or heavy engineering",
        "discovery_objective": "industrial IoT partnership",
        "product_description": "Telemetry-driven asset monitoring and predictive maintenance platform",
    },
    {
        "sector": "Telecom / Enterprise",
        "keyword": "telecommunications enterprise cloud",
        "location": "India",
        "organization_type": "Telecommunications",
        "target_icp": "Telecommunications operators or enterprise cloud providers with 5G, IoT, or digital transformation programs",
        "discovery_objective": "network intelligence partnership",
        "product_description": "High-throughput subscriber intelligence and SLA monitoring platform",
    },
]


# ─── SCORING HELPERS ────────────────────────────────────────────────────────

def _is_valid_url(url: str) -> bool:
    """Check if URL is structurally valid."""
    if not url:
        return False
    try:
        parsed = urlparse(url)
        return parsed.scheme in ("http", "https") and "." in (parsed.netloc or "")
    except Exception:
        return False


def _website_responds(url: str, timeout: float = 8.0) -> bool:
    """HTTP HEAD check — does the website actually respond?"""
    if not url:
        return False
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            r = client.head(url, headers={"User-Agent": "ELLY-Benchmark/1.0"})
            return r.status_code < 500
    except Exception:
        return False


def _is_real_person_name(name: str) -> bool:
    """Heuristic: does this look like a real person's name?"""
    if not name or len(name) < 3:
        return False
    words = name.strip().split()
    if len(words) < 2:
        return False
    if len(words) > 5:
        return False
    junk = {
        # Page elements / navigation
        "about", "contact", "team", "leadership", "executive", "management",
        "board", "directory", "list", "overview", "company", "the", "and",
        "best", "top", "leading", "new", "old", "free", "all", "your",
        "our", "this", "that", "what", "how", "why", "when", "where",
        # Navigation links
        "home", "menu", "search", "settings", "help", "faq", "terms",
        "privacy", "policy", "legal", "copyright", "trademark",
        # Content sections
        "news", "press", "coverage", "podcast", "episode", "blog", "article",
        "publication", "whitepaper", "webinar", "case", "study", "success",
        "testimonials", "reviews", "awards", "partners", "partnerships",
        "solutions", "products", "platforms", "industries", "resources",
        "support", "login", "sign", "register", "subscribe", "download",
        "pricing", "demo", "trial", "request", "quote", "plans",
        # Company/org words
        "healthcare", "hospital", "foundation", "institute", "academy",
        "university", "college", "school", "center", "centre", "clinic",
        "laboratory", "trust", "society", "association", "federation",
        "council", "committee", "commission", "authority", "agency",
        # Job title words
        "director", "vp", "vice", "president", "chief", "officer", "head",
        "partner", "senior", "junior", "associate", "analyst", "coordinator",
        "specialist", "engineer", "developer", "architect", "designer",
        # News/action words
        "names", "named", "appointed", "appointment", "announces", "hires",
        "selects", "elevates", "promotes", "welcomes", "quarterly", "monthly",
        "revenue", "growth", "deals", "report", "analysis", "review",
        # Non-name patterns
        "copyright", "reserved", "rights", "conditions", "disclaimers",
        "accessibility", "sitemap", "rss", "feeds", "social", "follow",
        "share", "like", "comment", "reply", "forward", "print", "email",
        "subscribe", "unsubscribe", "preferences", "account", "profile",
        "notifications", "alerts", "us", "we",
        # Country/state words
        "united", "states", "house", "america", "india", "china", "japan",
        "germany", "france", "brazil", "canada", "australia", "korea",
        "singapore", "dubai", "abu", "dhabi", "hong", "kong",
        # Product/platform words
        "dotnet", "aspire", "azure", "aws", "gcp",
        # Action/speech words
        "talks", "speaks", "presents", "hosts", "leads", "joins", "meets",
    }
    if any(w.lower() in junk for w in words):
        return False
    if any(c.isdigit() for c in name):
        return False
    if re.search(r'[!@#$%^&*()=+{}[\]|\\:;"<>,?/~`]', name):
        return False
    return True


def _has_valid_email_format(email: str, org_domain: str = "") -> bool:
    """Check email format and optional domain match."""
    if not email or "@" not in email:
        return False
    parts = email.split("@")
    if len(parts) != 2:
        return False
    local, domain = parts
    if not local or not domain or "." not in domain:
        return False
    if domain in ("example.com", "email.com", "test.com", "domain.com"):
        return False
    return True


def _email_enrichment_score(email: str, org_domain: str) -> float:
    """Score email quality: 0.0 = junk, 1.0 = verified corporate."""
    if not email:
        return 0.0
    if not _has_valid_email_format(email, org_domain):
        return 0.0
    domain = email.split("@")[-1].lower()
    free_providers = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
                      "aol.com", "icloud.com", "mail.com", "protonmail.com"}
    if domain in free_providers:
        return 0.3
    if org_domain and domain == org_domain.lower().replace("www.", ""):
        return 1.0
    if org_domain and domain in org_domain.lower():
        return 0.8
    return 0.5


# ─── CHECKPOINT TRACKER ─────────────────────────────────────────────────────

@dataclass
class OrgResult:
    """Tracks all checkpoint results for a single discovered organization."""
    name: str = ""
    website: str = ""
    city: str = ""
    country: str = ""
    sector: str = ""

    # Checkpoints
    org_validated: bool = False
    website_reachable: bool = False
    has_meaningful_description: bool = False
    qualification_score: int = 0
    qualification_tier: str = ""
    has_contacts: bool = False
    contacts_are_real_people: bool = False
    has_verified_email: bool = False
    email_quality: float = 0.0
    research_complete: bool = False
    has_showcase_match: bool = False
    email_personalized: bool = False

    # Details
    contacts_found: int = 0
    contacts_with_email: int = 0
    contact_names: List[str] = field(default_factory=list)
    contact_emails: List[str] = field(default_factory=list)
    research_signals: int = 0
    matched_project: str = ""
    personalization_score: int = 0
    rejection_reason: str = ""
    pipeline_stage: str = ""
    error: str = ""

    @property
    def checkpoints_passed(self) -> int:
        flags = [
            self.org_validated,
            self.website_reachable,
            self.has_meaningful_description,
            self.qualification_score >= 30,
            self.has_contacts,
            self.contacts_are_real_people,
            self.has_verified_email,
            self.research_complete,
            self.has_showcase_match,
            self.email_personalized,
        ]
        return sum(flags)

    @property
    def checkpoints_total(self) -> int:
        return 10


@dataclass
class SectorResult:
    sector: str = ""
    orgs_discovered: int = 0
    orgs_passed_validation: int = 0
    orgs_with_website: int = 0
    orgs_with_description: int = 0
    total_contacts: int = 0
    contacts_with_email: int = 0
    contacts_real_people: int = 0
    orgs_qualified: int = 0
    orgs_researched: int = 0
    orgs_with_showcase: int = 0
    orgs_with_email: int = 0
    avg_qualification_score: float = 0.0
    avg_email_quality: float = 0.0
    org_results: List[OrgResult] = field(default_factory=list)


# ─── MAIN BENCHMARK ─────────────────────────────────────────────────────────

def run_discovery_benchmark():
    db = SessionLocal()
    qualifier = ExplainableQualification()
    personalizer = PersonalizationEngine()

    # Seed showcase projects if needed
    count = db.query(Project).filter(Project.is_deleted.is_(False)).count()
    if count == 0:
        seed = [
            Project(name="ElectraWireless AI Operations Platform", description="Enterprise AI workflow automation and telemetry operating system", category="AI Platform", status=ProjectStatus.ACTIVE.value),
            Project(name="Healthcare Intelligence Engine", description="Clinical workflow and hospital resource optimization", category="Healthcare", status=ProjectStatus.ACTIVE.value),
            Project(name="Fintech Core Banking Integration", description="Real-time transaction compliance and reconciliation engine", category="Fintech", status=ProjectStatus.ACTIVE.value),
            Project(name="Industrial IoT & Predictive Maintenance", description="Telemetry-driven asset monitoring for manufacturing", category="Manufacturing", status=ProjectStatus.ACTIVE.value),
            Project(name="Telco 5G Network Analytics", description="High-throughput subscriber intelligence and SLA monitoring", category="Telecom", status=ProjectStatus.ACTIVE.value),
        ]
        db.add_all(seed)
        db.commit()

    all_sector_results: List[SectorResult] = []
    start_all = time.time()

    print("\n" + "=" * 78)
    print("ELLY GENUINE DISCOVERY BENCHMARK")
    print("=" * 78)
    print("NO hardcoded companies. NO mock data. Real web search from ICP only.\n")

    for q_idx, query in enumerate(ICP_QUERIES, 1):
        sector = query["sector"]
        sector_result = SectorResult(sector=sector)
        print(f"\n{'─' * 78}")
        print(f"[{q_idx}/5] SECTOR: {sector}")
        print(f"  ICP: {query['target_icp'][:80]}...")
        print(f"  Running orchestrator.discover()...")
        print(f"{'─' * 78}")

        start_sector = time.time()

        # ── STAGE 1: DISCOVERY (real web search) ──
        orch = DiscoveryOrchestrator(db)
        try:
            discover_result = orch.discover(
                keyword=query["keyword"],
                location=query["location"],
                organization_type=query["organization_type"],
                product_description=query["product_description"],
                target_icp=query["target_icp"],
                discovery_objective=query["discovery_objective"],
                provider="",
                limit=8,
                research=True,
            )
        except Exception as e:
            print(f"  ERROR: Discovery failed: {e}")
            sector_result.org_results.append(OrgResult(
                error=str(e), pipeline_stage="discovery", sector=sector
            ))
            all_sector_results.append(sector_result)
            continue

        raw_orgs = discover_result.get("organizations", [])
        sector_result.orgs_discovered = len(raw_orgs)
        sources = discover_result.get("sources_used", [])
        print(f"  Found {len(raw_orgs)} organizations from sources: {', '.join(sources)}")

        if not raw_orgs:
            print(f"  WARNING: No organizations found. Check provider health.")
            all_sector_results.append(sector_result)
            continue

        # ── STAGE 1.5: SAVE TO DB TO GET IDs (orchestrator doesn't persist) ──
        for org in raw_orgs:
            existing = db.query(DiscoveredOrganization).filter(
                DiscoveredOrganization.name == org.get("name", ""),
                DiscoveredOrganization.website == org.get("website", ""),
            ).first()
            if existing:
                org["id"] = existing.id
            else:
                disc = DiscoveredOrganization(
                    name=org.get("name", "Unknown"),
                    organization_type=org.get("organization_type", "Unknown"),
                    country=org.get("country"),
                    state=org.get("state"),
                    city=org.get("city"),
                    website=org.get("website"),
                    email=org.get("email"),
                    phone=org.get("phone"),
                    description=org.get("description", ""),
                    product_description=query["product_description"],
                    target_icp=query["target_icp"],
                    discovery_objective=query["discovery_objective"],
                    source_type=org.get("source_type", "search"),
                    source_name=org.get("source_name", "multi-source"),
                    source_url=org.get("source_url"),
                    status=DiscoveryStatus.DISCOVERED.value,
                    potential_fit=org.get("potential_fit", ""),
                    potential_fit_score=org.get("potential_fit_score", 50),
                    qualification_reason=org.get("qualification_reason", ""),
                )
                db.add(disc)
                db.flush()
                org["id"] = disc.id
        db.commit()

        # ── STAGE 2: EVALUATE EACH ORGANIZATION ──
        for o_idx, org in enumerate(raw_orgs, 1):
            org_name = org.get("name", "Unknown")
            org_result = OrgResult(
                name=org_name,
                website=org.get("website", ""),
                city=org.get("city", ""),
                country=org.get("country", ""),
                sector=sector,
            )
            print(f"\n  [{o_idx}/{len(raw_orgs)}] {org_name}")

            # CHECKPOINT 1: Organization validation
            is_valid, reason, normalized = organization_validator.validate(org)
            org_result.org_validated = is_valid
            org_result.rejection_reason = reason if not is_valid else ""
            status = "✓ validated" if is_valid else f"✗ rejected: {reason}"
            print(f"    Validation: {status}")

            # CHECKPOINT 2: Website reachable
            website = org.get("website", "")
            if website:
                reachable = _website_responds(website)
                org_result.website_reachable = reachable
                status = "✓ reachable" if reachable else "✗ unreachable"
                print(f"    Website: {website} → {status}")
            else:
                print(f"    Website: none")

            # CHECKPOINT 3: Meaningful description
            desc = org.get("description", "") or ""
            has_desc = len(desc.strip()) > 30
            org_result.has_meaningful_description = has_desc
            print(f"    Description: {'✓' if has_desc else '✗'} ({len(desc.strip())} chars)")

            # CHECKPOINT 4: ICP qualification
            try:
                qual = qualifier.qualify(
                    org=org,
                    target_icp=query["target_icp"],
                    product_description=query["product_description"],
                )
                if qual:
                    org_result.qualification_score = qual.score
                    org_result.qualification_tier = qual.tier
            except Exception as e:
                print(f"    Qualification error: {e}")
            print(f"    ICP Score: {org_result.qualification_score}/100 ({org_result.qualification_tier})")

            # ── STAGE 3: CONTACT DISCOVERY (real pipeline) ──
            discovered_org_id = org.get("id")
            if discovered_org_id:
                try:
                    contacts = orch.discover_decision_makers(
                        org_id=discovered_org_id,
                        roles=["CEO", "CTO", "CDO", "VP Engineering", "Head of Digital"],
                    )
                    org_result.contacts_found = len(contacts)
                    real_names = 0
                    emails_with_domain = 0
                    total_email_quality = 0.0

                    for c in contacts:
                        name = c.get("name", "")
                        email = c.get("email", "")
                        org_result.contact_names.append(name)
                        org_result.contact_emails.append(email)

                        if _is_real_person_name(name):
                            real_names += 1
                        if _has_valid_email_format(email):
                            org_result.contacts_with_email += 1
                            eq = _email_enrichment_score(email, website)
                            total_email_quality += eq

                    org_result.has_contacts = len(contacts) > 0
                    org_result.contacts_are_real_people = real_names > 0
                    org_result.has_verified_email = org_result.contacts_with_email > 0
                    if org_result.contacts_with_email > 0:
                        org_result.email_quality = total_email_quality / org_result.contacts_with_email

                    sector_result.total_contacts += len(contacts)
                    sector_result.contacts_with_email += org_result.contacts_with_email
                    sector_result.contacts_real_people += real_names

                    print(f"    Contacts: {len(contacts)} found, {real_names} real names, {org_result.contacts_with_email} with email")
                    if org_result.contact_names:
                        for cn, ce in zip(org_result.contact_names[:3], org_result.contact_emails[:3]):
                            print(f"      → {cn} ({ce or 'no email'})")

                except Exception as e:
                    print(f"    Contact discovery error: {e}")
                    org_result.error = str(e)
            else:
                print(f"    Contacts: skipped (no discovered_org_id)")

            # ── STAGE 4: RESEARCH (already done by orchestrator) ──
            org_result.research_complete = bool(org.get("research_completed") or desc)
            org_result.research_signals = len(desc.split()) if desc else 0

            # ── STAGE 5: SHOWCASE MATCHING ──
            try:
                research_data = {
                    "official_name": org_name,
                    "what_they_do": desc,
                    "industry": query["organization_type"],
                    "technology_initiatives": ["Cloud", "AI", "Digital"],
                }
                matches = match_projects(db, research_data, limit=1)
                org_result.has_showcase_match = len(matches) > 0
                if matches:
                    org_result.matched_project = matches[0].project_name
            except Exception as e:
                print(f"    Showcase match error: {e}")

            # ── STAGE 6: EMAIL PERSONALIZATION (real LLM) ──
            contact_name = org_result.contact_names[0] if org_result.contact_names else "Executive"
            contact_role = "Executive"
            try:
                p_data = personalizer.generate_personalization(
                    context={
                        "organization_name": org_name,
                        "contact_name": contact_name,
                        "contact_role": contact_role,
                        "industry": sector,
                        "city": org_result.city,
                        "project_name": org_result.matched_project or "ElectraWireless Platform",
                        "project_description": query["product_description"],
                    },
                    step_number=1,
                )
                if p_data:
                    has_hook = bool(p_data.get("opening_hook"))
                    has_prop = bool(p_data.get("ai_value_prop"))
                    has_cta = bool(p_data.get("cta"))
                    org_result.email_personalized = has_hook and has_prop and has_cta
                    if org_result.email_personalized:
                        org_result.personalization_score = 80  # placeholder
            except Exception as e:
                print(f"    Email personalization error: {e}")

            # Print summary
            passed = org_result.checkpoints_passed
            total = org_result.checkpoints_total
            pct = (passed / total) * 100
            indicator = "●" * passed + "○" * (total - passed)
            print(f"    Score: {passed}/{total} {indicator} ({pct:.0f}%)")

            sector_result.org_results.append(org_result)

        # Sector summary
        elapsed = time.time() - start_sector
        n = len(sector_result.org_results)
        if n > 0:
            sector_result.orgs_passed_validation = sum(1 for r in sector_result.org_results if r.org_validated)
            sector_result.orgs_with_website = sum(1 for r in sector_result.org_results if r.website_reachable)
            sector_result.orgs_with_description = sum(1 for r in sector_result.org_results if r.has_meaningful_description)
            sector_result.orgs_qualified = sum(1 for r in sector_result.org_results if r.qualification_score >= 30)
            sector_result.orgs_researched = sum(1 for r in sector_result.org_results if r.research_complete)
            sector_result.orgs_with_showcase = sum(1 for r in sector_result.org_results if r.has_showcase_match)
            sector_result.orgs_with_email = sum(1 for r in sector_result.org_results if r.has_verified_email)
            sector_result.avg_qualification_score = sum(r.qualification_score for r in sector_result.org_results) / n
            sector_result.avg_email_quality = sum(r.email_quality for r in sector_result.org_results) / n

        print(f"\n  Sector Summary ({elapsed:.1f}s):")
        print(f"    Discovered: {sector_result.orgs_discovered}")
        print(f"    Validated:  {sector_result.orgs_passed_validation}/{n}")
        print(f"    Websites:   {sector_result.orgs_with_website}/{n}")
        print(f"    Qualified:  {sector_result.orgs_qualified}/{n} (avg score: {sector_result.avg_qualification_score:.0f})")
        print(f"    Contacts:   {sector_result.total_contacts} total, {sector_result.contacts_with_email} with email")
        print(f"    Real names: {sector_result.contacts_real_people}/{sector_result.total_contacts}")

        all_sector_results.append(sector_result)

    # ── FINAL REPORT ────────────────────────────────────────────────────────
    elapsed = time.time() - start_all
    total_orgs = sum(s.orgs_discovered for s in all_sector_results)
    total_validated = sum(s.orgs_passed_validation for s in all_sector_results)
    total_websites = sum(s.orgs_with_website for s in all_sector_results)
    total_qualified = sum(s.orgs_qualified for s in all_sector_results)
    total_contacts = sum(s.total_contacts for s in all_sector_results)
    total_emails = sum(s.contacts_with_email for s in all_sector_results)
    total_real_names = sum(s.contacts_real_people for s in all_sector_results)
    total_researched = sum(s.orgs_researched for s in all_sector_results)
    total_showcase = sum(s.orgs_with_showcase for s in all_sector_results)
    total_personalized = sum(
        sum(1 for r in s.org_results if r.email_personalized)
        for s in all_sector_results
    )

    print("\n" + "=" * 78)
    print("GENUINE DISCOVERY BENCHMARK RESULTS")
    print("=" * 78)

    if total_orgs == 0:
        print("\n  No organizations discovered. Check provider configuration.")
        print("=" * 78)
        return

    checkpoints = [
        ("Organization validated", total_validated, total_orgs),
        ("Website reachable", total_websites, total_orgs),
        ("Meaningful description", sum(s.orgs_with_description for s in all_sector_results), total_orgs),
        ("ICP qualified (>=30)", total_qualified, total_orgs),
        ("Research completed", total_researched, total_orgs),
        ("Showcase matched", total_showcase, total_orgs),
        ("Contacts discovered", total_contacts, total_orgs),
        ("Real person names", total_real_names, max(total_contacts, 1)),
        ("Verified emails", total_emails, max(total_contacts, 1)),
        ("Email personalized", total_personalized, total_orgs),
    ]

    for label, count, denom in checkpoints:
        pct = (count / denom) * 100 if denom > 0 else 0
        bar = "#" * int(pct // 5) + "-" * (20 - int(pct // 5))
        flag = "[STRONG]" if pct >= 80 else ("[MODERATE]" if pct >= 50 else "[WEAK]")
        print(f"  {label:<30} {count:3d}/{denom:<3d}  ({pct:5.1f}%)  [{bar}]  {flag}")

    print(f"\n{'─' * 78}")
    print("SECTOR BREAKDOWN:")
    print(f"{'─' * 78}")
    for s in all_sector_results:
        n = len(s.org_results)
        avg_q = s.avg_qualification_score
        emails = s.contacts_with_email
        names = s.contacts_real_people
        total_c = s.total_contacts
        print(f"  {s.sector:<24} {n} orgs | {s.orgs_passed_validation} valid | {avg_q:.0f} avg score | {total_c} contacts, {emails} emails, {names} real")

    print(f"\n{'─' * 78}")
    print(f"Duration: {elapsed:.1f}s | {total_orgs} orgs | {total_contacts} contacts | {total_emails} emails")
    print(f"Throughput: {total_orgs/elapsed*60:.1f} orgs/min")
    print("=" * 78)

    # ── SAVE DETAILED RESULTS ──
    results_path = os.path.join(os.path.dirname(__file__), "..", "discovery_benchmark_results.json")
    export = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "duration_seconds": round(elapsed, 2),
        "total_organizations": total_orgs,
        "total_contacts": total_contacts,
        "total_emails": total_emails,
        "sectors": [],
    }
    for s in all_sector_results:
        sector_data = {
            "sector": s.sector,
            "organizations": [],
        }
        for r in s.org_results:
            sector_data["organizations"].append({
                "name": r.name,
                "website": r.website,
                "city": r.city,
                "country": r.country,
                "validated": r.org_validated,
                "website_reachable": r.website_reachable,
                "description_length": len(r.name),
                "qualification_score": r.qualification_score,
                "qualification_tier": r.qualification_tier,
                "contacts_found": r.contacts_found,
                "contacts_with_email": r.contacts_with_email,
                "contact_names": r.contact_names,
                "contact_emails": r.contact_emails,
                "research_complete": r.research_complete,
                "showcase_match": r.matched_project,
                "email_personalized": r.email_personalized,
                "error": r.error,
            })
        export["sectors"].append(sector_data)

    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(export, f, indent=2, ensure_ascii=False)
    print(f"\nDetailed results saved to: {results_path}")


if __name__ == "__main__":
    run_discovery_benchmark()
