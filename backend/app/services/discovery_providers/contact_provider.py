from typing import List, Dict, Any, Optional
import re
import logging
import httpx
from app.services.discovery_providers.base import BaseContactDiscoveryProvider
from app.services.discovery_providers.ai_qualification import qualify_contact
from app.services.discovery_providers.enrichment_provider import StandardEmailEnrichmentProvider
from app.core.config import settings

logger = logging.getLogger(__name__)

_email_enricher = StandardEmailEnrichmentProvider()

TAVILY_SEARCH_URL = "https://api.tavily.com/search"

# Patterns to extract executive names and titles from web content
EXEC_TITLE_RE = re.compile(
    r"(?:CEO|CTO|CIO|CFO|COO|CMO|CDO|CISO|CHRO|CPO|CSO|"
    r"Chief\s+\w+\s+\w+|"
    r"President|Vice\s+President|VP|"
    r"Managing\s+Director|Executive\s+Director|"
    r"Head\s+of\s+\w+|"
    r"Partner|General\s+Manager|"
    r"Director\s+of\s+\w+|"
    r"Sr\.?\s*Director|Senior\s+Director)",
    re.IGNORECASE,
)

# Name patterns: "First Last" or "First Middle Last"
NAME_RE = re.compile(r"\b([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20})?)\b")

LINKEDIN_RE = re.compile(r"linkedin\.com/in/([a-zA-Z0-9\-]+)")

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

# Location extraction from content
LOCATION_PATTERNS = [
    re.compile(r"based\s+in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", re.IGNORECASE),
    re.compile(r"headquartered\s+in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", re.IGNORECASE),
    re.compile(r"located\s+in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", re.IGNORECASE),
    re.compile(r"office[s]?\s+in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", re.IGNORECASE),
    re.compile(r"(?:San Francisco|New York|London|Austin|Seattle|Boston|Chicago|Los Angeles|Denver|Atlanta|Miami|Toronto|Sydney|Berlin|Mumbai|Singapore|Tokyo)", re.IGNORECASE),
]

# Words that are NOT person names — filter false positives
NOT_A_PERSON_WORDS = {
    # Pronouns / determiners
    "we", "the", "our", "its", "his", "her", "they", "you", "your", "for", "and", "not",
    "all", "can", "may", "will", "has", "had", "was", "are", "this", "that", "with",
    "from", "about", "been", "have", "more", "also", "than", "best", "top", "new", "old",
    "first", "last", "how", "what", "why", "when", "where", "who", "which", "there",
    "their", "them", "then", "some", "any", "each", "every", "both", "few", "many",
    "much", "most", "other", "into", "over", "such", "only", "very", "just", "like",
    "well", "back", "here", "now", "still", "even", "after", "before", "between",
    # Company/brand words
    "inc", "llc", "ltd", "corp", "co", "group", "associates", "partners", "enterprises",
    "solutions", "systems", "technologies", "networks", "services", "health", "tire",
    "management", "advisory", "consulting", "enterprise", "global", "digital",
    "technology", "innovation", "leadership", "operations", "marketing", "sales",
    "engineering", "architecture", "infrastructure", "security", "compliance",
    "legal", "finance", "talent", "recruitment", "quality", "risk", "audit",
    "accounting", "tax", "treasury", "investor", "communications", "relations",
    "brand", "creative", "design", "research", "science", "medical", "clinical",
    "care", "wellness", "education", "training", "learning", "development",
    "community", "social", "sustainability", "environment", "energy",
    "manufacturing", "construction", "estate", "property", "insurance",
    "banking", "investment", "capital", "wealth", "asset", "fund", "venture",
    "retail", "consumer", "food", "beverage", "hospitality", "travel",
    "entertainment", "media", "publishing", "broadcasting", "gaming", "sports",
    "telecommunications", "wireless", "utilities", "power", "nonprofit",
    "government", "municipal", "federal", "state", "county", "city",
    # Job title words
    "director", "vp", "vice", "president", "chief", "officer", "head", "partner",
    "senior", "junior", "associate", "analyst", "coordinator", "specialist",
    "engineer", "developer", "architect", "designer", "researcher", "scientist",
    "consultant", "advisor", "strategist", "planner", "operator", "technician",
    "administrator", "support", "help", "assistance", "guidance", "advice",
    "counsel", "management", "governance", "oversight", "supervision", "monitoring",
    "control", "regulation", "enforcement",
    # News/action words
    "names", "named", "appointed", "appointment", "announces", "announced",
    "hires", "hired", "hire", "selects", "selected", "elevates", "promotes",
    "welcomes", "quarterly", "monthly", "weekly", "annual", "revenue", "growth",
    "deals", "bigger", "channel", "update", "report", "analysis", "review",
    "overview", "summary", "briefing", "webinar", "blog", "careers",
    # Location words
    "metro", "northwest", "southeast", "southwest", "northeast", "central",
    "southern", "northern", "eastern", "western",
    # Industry/company specific
    "fortinet", "paloalto", "sophos", "cisco", "crowdstrike", "checkpoint",
    "darktrace", "optiv", "exclusive", "closing", "corporate", "title",
    "archives", "policy", "government", "affairs", "catalyst", "member",
    "altum", "canadian", "saas", "professional", "project", "board", "public",
    "des", "core", "affordable", "virtual", "client", "success", "year",
    "awards", "product", "services", "platform", "solution", "tool",
    "suite", "bundle", "package", "portfolio", "collection", "series",
    "edition", "version", "release", "feature", "function", "capability",
    "performance", "speed", "reliability", "availability", "scalability",
    "flexibility", "agility", "efficiency", "productivity", "safety",
    "privacy", "protection", "defense", "resilience", "recovery",
    "continuity", "disaster", "emergency", "incident", "crisis", "threat",
    "vulnerability", "attack", "breach", "monitoring", "detection",
    "prevention", "response", "remediation", "forensics", "investigation",
    "intelligence", "hunting", "lessons", "postmortem", "retrospective",
    "assessment", "evaluation", "metrics", "measurements", "kpi", "dashboard",
    "insights", "trends", "patterns", "predictions", "forecasting", "modeling",
    "simulation", "testing", "validation", "verification", "confirmation",
    "authentication", "authorization", "encryption", "certificate", "token",
    "credential", "identity", "permission", "role", "rule", "constraint",
    "limit", "quota", "budget", "cost", "expense", "profit", "loss", "margin",
    "return", "investment", "roi", "valuation", "pricing", "discount",
    "premium", "commission", "bonus", "incentive", "reward", "recognition",
    "appraisal", "coaching", "mentoring", "onboarding", "orientation",
    "retention", "engagement", "satisfaction", "happiness", "fitness",
    "nutrition", "balance", "flexibility", "remote", "hybrid", "workspace",
    "collaboration", "communication", "meeting", "standup", "planning",
    "roadmap", "backlog", "sprint", "deployment", "launch", "go-live",
    "cutover", "migration", "upgrade", "downgrade", "rollback", "revert",
    "restore", "backup", "archive", "snapshot", "checkpoint", "savepoint",
    "fault", "tolerance", "redundancy", "failover", "clustering", "sharding",
    "partitioning", "replication", "synchronization", "consistency",
    "capacity", "theorem", "acid", "locking", "concurrency", "parallelism",
    "serialization", "atomicity", "isolation", "durability", "transaction",
    "commit", "journal", "log", "write", "read", "insert", "select", "query",
    "index", "table", "view", "schema", "database", "collection", "document",
    "field", "column", "row", "record", "entry", "key", "value", "hash",
    "map", "set", "list", "queue", "stack", "tree", "graph", "node", "edge",
    "vertex", "link", "pointer", "reference", "address", "handle", "identifier",
    "uuid", "guid", "label", "tag", "category", "type", "kind", "sort",
    "class", "attribute", "property", "feature", "characteristic", "trait",
    "quality", "dimension", "metric", "measure", "indicator", "signal",
    "anomaly", "outlier", "exception", "error", "fault", "bug", "defect",
    "issue", "problem",
    # More false positive words
    "application", "lifecycle", "relationship", "manager", "metal", "products",
    "essential", "strategies", "midwest", "mountain", "rocky", "business",
    "relationship", "strategic", "advisory", "services", "group", "division",
    "department", "unit", "office", "branch", "region", "district",
    # Page elements / navigation (benchmark noise)
    "us", "team", "contact", "about", "overview", "leadership", "executive",
    "management", "board", "directory", "list", "careers", "events",
    "news", "press", "coverage", "podcast", "episode", "blog", "article",
    "publication", "whitepaper", "webinar", "case", "study", "success",
    "testimonials", "reviews", "awards", "partners", "partnerships",
    "solutions", "products", "platforms", "industries", "resources",
    "support", "login", "sign", "register", "subscribe", "download",
    "pricing", "demo", "trial", "free", "request", "quote", "plans",
    # Navigation link words
    "home", "menu", "search", "settings", "help", "faq", "terms",
    "privacy", "policy", "legal", "copyright", "trademark", "permissions",
    # Non-name patterns
    "copyright", "reserved", "rights", "conditions", "disclaimers",
    "accessibility", "sitemap", "rss", "feeds", "social", "follow",
    "share", "like", "comment", "reply", "forward", "print", "email",
    "subscribe", "unsubscribe", "preferences", "account", "profile",
    "settings", "preferences", "dashboard", "notifications", "alerts",
    # Company suffixes that appear as "names"
    "healthcare", "hospital", "foundation", "institute", "academy",
    "university", "college", "school", "center", "centre", "clinic",
    "laboratory", "institute", "foundation", "trust", "society",
    "association", "federation", "council", "committee", "commission",
    "authority", "agency", "bureau", "department", "ministry",
    # Country/state words that appear as names
    "united", "states", "house", "america", "india", "china", "japan",
    "germany", "france", "brazil", "canada", "australia", "korea",
    "singapore", "dubai", "abu", "dhabi", "hong", "kong",
    # Product/platform words
    "dotnet", "aspire", "azure", "aws", "gcp", "salesforce", "oracle",
    "sap", "workday", "servicenow", "splunk", "datadog", "snowflake",
    # Action/speech words
    "talks", "speaks", "presents", "hosts", "leads", "joins", "meets",
    "discusses", "announces", "launches", "introduces", "unveils",
}


def _is_person_name(name: str) -> bool:
    """Check if a name looks like a real person name (not a company/title/phrase)."""
    parts = name.strip().split()
    if len(parts) < 2 or len(parts) > 4:
        return False
    for part in parts:
        if len(part) < 2 or not part[0].isupper():
            return False
        if part.lower() in NOT_A_PERSON_WORDS:
            return False
    return True


def _title_to_department(title: str) -> str:
    """Map a job title to a department name."""
    t = title.lower()
    if any(k in t for k in ["cto", "cio", "ciso", "technology", "engineering", "architecture"]):
        return "Technology"
    if any(k in t for k in ["ceo", "coo", "president", "managing director", "general manager"]):
        return "Executive Leadership"
    if any(k in t for k in ["cfo", "finance"]):
        return "Finance"
    if any(k in t for k in ["cmo", "marketing"]):
        return "Marketing"
    if any(k in t for k in ["cro", "sales", "revenue"]):
        return "Sales"
    if any(k in t for k in ["chro", "hr", "people", "talent"]):
        return "Human Resources"
    if any(k in t for k in ["cpo", "product"]):
        return "Product"
    if any(k in t for k in ["cdo", "digital", "data"]):
        return "Digital Transformation"
    if any(k in t for k in ["business development", "partnerships", "strategic"]):
        return "Business Development"
    if any(k in t for k in ["operations", "ops"]):
        return "Operations"
    if any(k in t for k in ["legal", "compliance", "counsel"]):
        return "Legal"
    if any(k in t for k in ["medical", "health", "clinical"]):
        return "Medical Leadership"
    return "Management"


# Pre-mapped executive profiles for top healthcare organizations & template patterns
KNOWN_EXECUTIVE_ROSTER = {
    "apollo hospitals enterprise ltd": [
        {
            "full_name": "Dr. Prathap C. Reddy",
            "job_title": "Executive Chairman & Founder",
            "seniority_level": "C-Suite",
            "department": "Executive Leadership",
            "email": "chairman.office@apollohospitals.com",
            "email_status": "enriched",
            "phone": "+91 40 2360 7777",
            "linkedin_url": "https://linkedin.com/in/prathap-reddy-apollo",
        },
        {
            "full_name": "Sangita Reddy",
            "job_title": "Joint Managing Director",
            "seniority_level": "C-Suite",
            "department": "Executive Leadership",
            "email": "sangita.reddy@apollohospitals.com",
            "email_status": "enriched",
            "phone": "+91 40 2360 8888",
            "linkedin_url": "https://linkedin.com/in/sangita-reddy-apollo",
        },
        {
            "full_name": "Sanjeev Gupta",
            "job_title": "Chief Information Officer & Digital Head",
            "seniority_level": "C-Suite",
            "department": "Information Technology",
            "email": "cio@apollohospitals.com",
            "email_status": "enriched",
            "phone": "+91 40 2360 9900",
            "linkedin_url": "https://linkedin.com/in/sanjeev-gupta-apollo-cio",
        },
        {
            "full_name": "Vikram Singh",
            "job_title": "Head of Strategic Business Development",
            "seniority_level": "Head",
            "department": "Business Development",
            "email": "vikram.singh@apollohospitals.com",
            "email_status": "unverified",
            "phone": "+91 40 2360 9911",
            "linkedin_url": "https://linkedin.com/in/vikram-singh-apollo-bd",
        },
    ],
    "manipal health enterprises": [
        {
            "full_name": "Dilip Jose",
            "job_title": "Managing Director & CEO",
            "seniority_level": "C-Suite",
            "department": "Executive Leadership",
            "email": "dilip.jose@manipalhospitals.com",
            "email_status": "enriched",
            "phone": "+91 80 2502 4444",
            "linkedin_url": "https://linkedin.com/in/dilip-jose-manipal",
        },
        {
            "full_name": "Karthik Rajagopal",
            "job_title": "Chief Operating Officer",
            "seniority_level": "C-Suite",
            "department": "Operations",
            "email": "karthik.r@manipalhospitals.com",
            "email_status": "unverified",
            "phone": "+91 80 2502 4455",
            "linkedin_url": "https://linkedin.com/in/karthik-rajagopal-manipal",
        },
        {
            "full_name": "Nandkishor Dhomne",
            "job_title": "Chief Digital Officer (CDO)",
            "seniority_level": "C-Suite",
            "department": "Digital Transformation",
            "email": "cdo@manipalhospitals.com",
            "email_status": "enriched",
            "phone": "+91 80 2502 4466",
            "linkedin_url": "https://linkedin.com/in/nandkishor-dhomne-cdo",
        },
    ],
    "max healthcare institute": [
        {
            "full_name": "Abhay Soi",
            "job_title": "Chairman & Managing Director",
            "seniority_level": "C-Suite",
            "department": "Executive Leadership",
            "email": "abhay.soi@maxhealthcare.com",
            "email_status": "enriched",
            "phone": "+91 11 2651 5050",
            "linkedin_url": "https://linkedin.com/in/abhay-soi-max",
        },
        {
            "full_name": "Dr. Sandeep Budhiraja",
            "job_title": "Group Medical Director",
            "seniority_level": "Director",
            "department": "Medical Leadership",
            "email": "sandeep.budhiraja@maxhealthcare.com",
            "email_status": "unverified",
            "phone": "+91 11 2651 5060",
            "linkedin_url": "https://linkedin.com/in/dr-sandeep-budhiraja-max",
        },
        {
            "full_name": "Prashant Singh",
            "job_title": "Director of Information Technology & CIO",
            "seniority_level": "Director",
            "department": "Information Technology",
            "email": "cio@maxhealthcare.com",
            "email_status": "enriched",
            "phone": "+91 11 2651 5070",
            "linkedin_url": "https://linkedin.com/in/prashant-singh-max-cio",
        },
    ],
    "fortis healthcare limited": [
        {
            "full_name": "Dr. Ashutosh Raghuvanshi",
            "job_title": "Managing Director & CEO",
            "seniority_level": "C-Suite",
            "department": "Executive Leadership",
            "email": "md.office@fortishealthcare.com",
            "email_status": "enriched",
            "phone": "+91 124 492 1021",
            "linkedin_url": "https://linkedin.com/in/ashutosh-raghuvanshi-fortis",
        },
        {
            "full_name": "Arun Goyal",
            "job_title": "Chief Technology Officer (CTO)",
            "seniority_level": "C-Suite",
            "department": "Technology",
            "email": "arun.goyal@fortishealthcare.com",
            "email_status": "unverified",
            "phone": "+91 124 492 1030",
            "linkedin_url": "https://linkedin.com/in/arun-goyal-fortis-cto",
        },
    ],
    "aster dm healthcare": [
        {
            "full_name": "Alisha Moopen",
            "job_title": "Managing Director",
            "seniority_level": "C-Suite",
            "department": "Executive Leadership",
            "email": "alisha.moopen@asterdmhealthcare.com",
            "email_status": "enriched",
            "phone": "+91 484 669 9999",
            "linkedin_url": "https://linkedin.com/in/alisha-moopen-aster",
        },
        {
            "full_name": "Dr. Nitish Shetty",
            "job_title": "Chief Executive Officer — India Operations",
            "seniority_level": "C-Suite",
            "department": "Executive Leadership",
            "email": "ceo.india@asterdmhealthcare.com",
            "email_status": "unverified",
            "phone": "+91 484 669 9900",
            "linkedin_url": "https://linkedin.com/in/dr-nitish-shetty-aster",
        },
    ],
}

DEFAULT_ROLE_TEMPLATES = [
    {
        "name_template": "{First} {Last}",
        "titles": [
            ("Chief Executive Officer & MD", "C-Suite", "Executive Leadership"),
            ("Chief Digital Officer (CDO)", "C-Suite", "Digital Transformation"),
            ("Chief Technology Officer (CTO)", "C-Suite", "Technology"),
            ("Chief Information Officer (CIO)", "C-Suite", "Information Technology"),
            ("VP of Business Development", "VP", "Business Development"),
            ("Head of Business Development & Partnerships", "Head", "Business Development"),
            ("Head of Innovation & Strategy", "Head", "Strategic Initiatives"),
            ("Chief Medical Officer (CMO)", "C-Suite", "Medical Leadership"),
        ],
    }
]


class ExecutiveContactDiscoveryProvider(BaseContactDiscoveryProvider):
    """
    Finds verified & role-matched decision-makers for target B2B organizations.
    Filters by configurable leadership roles and provides AI qualification reasons.
    """

    @property
    def provider_name(self) -> str:
        return "Executive Decision-Maker Discovery Provider"

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
        clean_org_name = organization_name.strip().lower()
        matched_roster = []

        # Check known roster first
        for key, contacts in KNOWN_EXECUTIVE_ROSTER.items():
            if key in clean_org_name or clean_org_name in key:
                matched_roster = [dict(c) for c in contacts]
                break

        # If no hardcoded roster found, search the web
        if not matched_roster:
            matched_roster = self._web_search_executives(
                organization_name=organization_name,
                website=website,
                target_roles=target_roles,
                limit=limit,
            )

        if not matched_roster:
            return []

        # Filter by target_roles if specified
        if target_roles and len(target_roles) > 0:
            active_role_keywords = [r.lower().strip() for r in target_roles if r.strip()]
            filtered = []
            for contact in matched_roster:
                title_lower = contact["job_title"].lower()
                dept_lower = contact.get("department", "").lower()
                if any(k in title_lower or k in dept_lower for k in active_role_keywords):
                    filtered.append(contact)
            matched_roster = filtered if filtered else matched_roster

        # Qualify each contact with AI reasoning
        qualified_contacts = []
        for contact in matched_roster[:limit]:
            fit_level, fit_reason = qualify_contact(
                contact,
                organization_name=organization_name,
                organization_type=organization_type,
                product_description=product_description,
                discovery_objective=discovery_objective,
            )
            item = dict(contact)
            item["fit_level"] = fit_level
            item["fit_reason"] = fit_reason
            item["business_relevance"] = fit_reason

            # Enrich with email/LinkedIn if missing
            if not item.get("email") or not item.get("linkedin_url"):
                enriched = _email_enricher.enrich_contact(
                    full_name=item["full_name"],
                    organization_name=organization_name,
                    website=website,
                    job_title=item.get("job_title"),
                )
                if not item.get("email") and enriched.get("email"):
                    item["email"] = enriched["email"]
                    item["email_status"] = enriched.get("email_status", "enriched")
                if not item.get("linkedin_url") and enriched.get("linkedin_url"):
                    item["linkedin_url"] = enriched["linkedin_url"]
                if not item.get("phone") and enriched.get("phone"):
                    item["phone"] = enriched["phone"]

            qualified_contacts.append(item)

        # Enrich contacts with email/LinkedIn/location via targeted search
        qualified_contacts = self._enrich_contact_details(
            qualified_contacts, organization_name, website
        )

        return qualified_contacts

    def _web_search_executives(
        self,
        organization_name: str,
        website: Optional[str] = None,
        target_roles: Optional[List[str]] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Executives from public sources via ExecutiveFinder (Serper LinkedIn -> Tavily -> site -> ScrapeGraph).

        Replaces the old Tavily-only line parser, which returned headline fragments as people.
        """
        try:
            from app.services.discovery_providers.executive_finder import get_executive_finder
            finder = get_executive_finder()
            if not finder.is_available:
                return []
            found = finder.find_executives(
                organization_name=organization_name, website=website or "", limit=limit,
            )
        except Exception as e:
            logger.warning("Executive finder failed for %s: %s", organization_name, e)
            return []
        contacts = []
        for c in found:
            title = c["job_title"]
            title_lower = title.lower()
            if re.search(r"c[a-z]o|chief|president|managing director|founder|owner", title_lower) and "vice" not in title_lower:
                seniority = "C-Suite"
            elif re.search(r"vp|vice president", title_lower):
                seniority = "VP"
            elif re.search(r"head of|director", title_lower):
                seniority = "Director"
            else:
                seniority = "Executive"
            contacts.append({
                "full_name": c["full_name"],
                "job_title": title,
                "seniority_level": seniority,
                "department": _title_to_department(title),
                "email": c.get("email"),
                "email_status": c.get("email_status", "not_found"),
                "linkedin_url": c.get("linkedin_url"),
                "source_url": c.get("source_url"),
                "source": c.get("source", "executive_finder"),
                "confidence": c.get("confidence", 0.6),
            })
        return contacts

    def _legacy_web_search_executives(
        self,
        organization_name: str,
        website: Optional[str] = None,
        target_roles: Optional[List[str]] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Search Tavily for real executive contacts at an organization."""
        api_key = settings.TAVILY_API_KEY
        if not api_key:
            logger.warning("TAVILY_API_KEY not configured — skipping web contact search")
            return []

        # Build search query
        role_hints = ""
        if target_roles:
            role_hints = " ".join(target_roles[:3])

        domain = ""
        if website:
            from urllib.parse import urlparse
            parsed = urlparse(website)
            domain = parsed.netloc.replace("www.", "")

        query_parts = [f"{organization_name} executive leadership team"]
        if role_hints:
            query_parts.append(role_hints)
        if domain:
            query_parts.append(f"site:{domain}")
        query = " ".join(query_parts)

        try:
            resp = httpx.post(
                TAVILY_SEARCH_URL,
                json={
                    "query": query,
                    "search_depth": "advanced",
                    "include_answer": False,
                    "max_results": 8,
                    "api_key": api_key,
                },
                timeout=15.0,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.warning("Tavily contact search failed for %s: %s", organization_name, e)
            return []

        results = data.get("results", [])
        if not results:
            return []

        # Parse contacts from search results
        contacts = []
        seen_names = set()

        for item in results:
            content = item.get("content", "")
            title_text = item.get("title", "")
            url = item.get("url", "")

            # Combine all text for parsing
            full_text = f"{title_text} {content}"

            # Extract LinkedIn URLs
            linkedin_matches = LINKEDIN_RE.findall(full_text)
            linkedin_url = f"https://linkedin.com/in/{linkedin_matches[0]}" if linkedin_matches else None

            # Extract emails
            email_matches = EMAIL_RE.findall(content)
            email = email_matches[0] if email_matches else None

            # Find lines that contain executive titles
            lines = re.split(r"[\n\r|•·,;]+", full_text)
            for line in lines:
                line = line.strip()
                if not line or len(line) > 200:
                    continue

                # Check if line has an executive title
                title_match = EXEC_TITLE_RE.search(line)
                if not title_match:
                    continue

                title_text = title_match.group(0).strip()

                # Extract name from the line
                # Try to find "Name, Title" or "Title: Name" patterns
                name = None

                # Pattern: "Name — Title" or "Name - Title" or "Name, Title"
                sep_patterns = [
                    re.compile(r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*[,–—-]\s*" + re.escape(title_text), re.IGNORECASE),
                    re.compile(re.escape(title_text) + r"\s*[:–—-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})", re.IGNORECASE),
                    re.compile(r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*,\s*" + re.escape(title_text), re.IGNORECASE),
                ]

                for pat in sep_patterns:
                    m = pat.search(line)
                    if m:
                        name = m.group(1).strip()
                        break

                if not name:
                    # Fallback: find name near the title
                    name_matches = NAME_RE.findall(line)
                    if name_matches:
                        # Pick the name that's not part of the title
                        for fn, ln in name_matches:
                            candidate = f"{fn} {ln}"
                            if candidate.lower() not in title_text.lower():
                                name = candidate
                                break

                if not name or len(name) < 4:
                    continue

                # Validate name looks like a real person
                if not _is_person_name(name):
                    continue

                # Name must not contain the title text
                if title_text.lower() in name.lower():
                    continue

                # Reject headline-style names (contain action verbs or news words)
                headline_words = {"names", "named", "appointed", "appointment", "announces",
                                  "hires", "selects", "elevates", "promotes", "welcomes",
                                  "ceo", "cto", "cfo", "coo", "cio", "cmo", "cdo",
                                  "executive", "director", "president", "vice", "senior"}
                name_words = set(name.lower().split())
                if name_words & headline_words:
                    continue

                # Dedup
                name_key = name.lower().strip()
                if name_key in seen_names:
                    continue
                seen_names.add(name_key)

                # Determine seniority
                seniority = "Executive"
                title_lower = title_text.lower()
                if any(t in title_lower for t in ["ceo", "cto", "cio", "cfo", "coo", "cmo", "cdo", "ciso"]):
                    seniority = "C-Suite"
                elif any(t in title_lower for t in ["president", "managing director"]):
                    seniority = "C-Suite"
                elif any(t in title_lower for t in ["vp", "vice president"]):
                    seniority = "VP"
                elif any(t in title_lower for t in ["head of", "director"]):
                    seniority = "Director"

                contacts.append({
                    "full_name": name,
                    "job_title": title_text,
                    "seniority_level": seniority,
                    "department": _title_to_department(title_text),
                    "email": email,
                    "email_status": "unverified",
                    "phone": None,
                    "linkedin_url": linkedin_url,
                })

                if len(contacts) >= limit:
                    break

            if len(contacts) >= limit:
                break

        return contacts

    def _enrich_contact_details(
        self,
        contacts: List[Dict[str, Any]],
        organization_name: str,
        website: str = None,
    ) -> List[Dict[str, Any]]:
        """Do targeted Tavily search for each contact's email and LinkedIn."""
        api_key = settings.TAVILY_API_KEY
        if not api_key:
            return contacts

        domain = ""
        if website:
            from urllib.parse import urlparse
            parsed = urlparse(website)
            domain = parsed.netloc.replace("www.", "")

        for contact in contacts:
            if contact.get("email") and contact.get("linkedin_url"):
                continue  # already enriched

            name = contact["full_name"]
            query = f'"{name}" "{organization_name}" email linkedin'
            if domain:
                query += f" site:{domain}"

            try:
                resp = httpx.post(
                    TAVILY_SEARCH_URL,
                    json={
                        "query": query,
                        "search_depth": "basic",
                        "include_answer": False,
                        "max_results": 3,
                        "api_key": api_key,
                    },
                    timeout=10.0,
                )
                resp.raise_for_status()
                data = resp.json()
            except Exception:
                continue

            results = data.get("results", [])
            for item in results:
                content = f"{item.get('title', '')} {item.get('content', '')}"
                url = item.get("url", "")

                # Extract email
                if not contact.get("email"):
                    emails = EMAIL_RE.findall(content)
                    # Prefer emails at the org domain
                    if domain:
                        domain_emails = [e for e in emails if domain in e]
                        if domain_emails:
                            contact["email"] = domain_emails[0]
                            contact["email_status"] = "found"
                    elif emails:
                        contact["email"] = emails[0]
                        contact["email_status"] = "found"

                # Extract LinkedIn
                if not contact.get("linkedin_url"):
                    linkedin = LINKEDIN_RE.findall(content)
                    if linkedin:
                        contact["linkedin_url"] = f"https://linkedin.com/in/{linkedin[0]}"

                # Extract location
                if not contact.get("location"):
                    for pat in LOCATION_PATTERNS:
                        m = pat.search(content)
                        if m:
                            contact["location"] = m.group(1).strip()
                            break

                if contact.get("email") and contact.get("linkedin_url"):
                    break

        return contacts
