"""
ELLY BD OS — Real Prospect Research & Qualification
Finds actual companies (not directories), researches them, finds decision-makers.
"""
import httpx, json, sys, re, time
from datetime import datetime, timezone

sys.path.insert(0, ".")

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.organization import Organization, ConnectionStatus, PriorityLevel
from app.models.contact import Contact

SERPER_URL = "https://google.serper.dev/search"
SERPER_KEY = settings.SERPER_API_KEY

def serper_search(query, num=5):
    try:
        r = httpx.post(SERPER_URL, headers={"X-API-KEY": SERPER_KEY, "Content-Type": "application/json"},
                       json={"q": query, "num": num}, timeout=30)
        if r.status_code == 200:
            return r.json().get("organic", [])
    except Exception as e:
        print(f"    Search error: {e}")
    return []

def is_real_company(url, title, snippet):
    """Filter out directories, lists, job boards, articles."""
    skip_domains = [
        "linkedin.com/jobs", "indeed.com", "glassdoor.com", "yelp.com",
        "wikipedia.org", "quora.com", "reddit.com", "forbes.com",
        "techcrunch.com", "reuters.com", "bloomberg.com", "crunchbase.com",
        "owler.com", "gartner.com", "builtin.com", "wellfound.com",
        "topstartups.io", "ycombinator.com", "chamber.com", "bbb.org",
    ]
    url_lower = url.lower()
    for d in skip_domains:
        if d in url_lower:
            return False
    skip_titles = ["jobs in", "hiring", "open roles", "salary", "top ", "best ", "list of", "what are"]
    title_lower = title.lower()
    for s in skip_titles:
        if s in title_lower:
            return False
    return True

def extract_company_name(url, title, snippet):
    """Extract actual company name from URL domain or title."""
    # Try to get from domain
    from urllib.parse import urlparse
    parsed = urlparse(url)
    domain = parsed.netloc.replace("www.", "")
    name = domain.split(".")[0].title()
    if len(name) >= 3:
        return name
    # Fallback to title
    for sep in [" | ", " - ", " — ", " :: ", " – "]:
        if sep in title:
            return title.split(sep)[0].strip()[:100]
    return title.strip()[:100]

def research_company(company_name, website=""):
    """Use Serper to get more info about the company."""
    info = {"description": "", "industry": "", "size": "", "email": "", "phone": ""}
    results = serper_search(f'"{company_name}" company about', num=3)
    for r in results:
        snippet = r.get("snippet", "")
        if snippet and len(snippet) > len(info["description"]):
            info["description"] = snippet[:500]
    # Try to find email/phone
    contact_results = serper_search(f'"{company_name}" contact email phone', num=3)
    for r in contact_results:
        snippet = r.get("snippet", "")
        email_match = re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', snippet)
        if email_match and not info["email"]:
            info["email"] = email_match.group()
        phone_match = re.search(r'[\+]?[\d\s\-\(\)]{10,}', snippet)
        if phone_match and not info["phone"]:
            info["phone"] = phone_match.group().strip()
    return info

def find_decision_maker(company_name):
    """Find CTO/CEO/VP via LinkedIn."""
    contacts = []
    for title_query in ["CTO", "CEO", "VP Engineering", "Head of Technology"]:
        results = serper_search(f'"{company_name}" {title_query} site:linkedin.com/in', num=3)
        for r in results:
            url = r.get("link", "")
            if "linkedin.com/in/" not in url:
                continue
            # Extract name from LinkedIn URL
            slug = url.split("/in/")[-1].split("/")[0].split("?")[0]
            name_parts = slug.replace("-", " ").replace("_", " ").title().split()
            if len(name_parts) >= 2:
                full_name = f"{name_parts[0]} {name_parts[1]}"
                if not any(c["name"] == full_name for c in contacts):
                    contacts.append({
                        "name": full_name,
                        "first": name_parts[0],
                        "last": " ".join(name_parts[1:]),
                        "title": title_query,
                        "linkedin": url,
                    })
                    break
        if len(contacts) >= 1:
            break
    return contacts[:1]

def main():
    print("=" * 70)
    print("ELLY BD OS — Prospect Research & Qualification")
    print("=" * 70)

    db = SessionLocal()

    # Clean old bad entries (directory pages)
    old_orgs = db.query(Organization).filter(Organization.is_deleted == False).all()
    deleted = 0
    for o in old_orgs:
        if not o.website or any(d in (o.website or "").lower() for d in ["ycombinator", "builtin", "wellfound", "linkedin.com/jobs", "topstartups", "chamber", "datacentermap"]):
            db.delete(o)
            deleted += 1
    if deleted:
        db.commit()
        print(f"Cleaned {deleted} directory/list entries")

    # Target searches for REAL companies
    searches = [
        ("Stripe fintech company San Francisco", "FinTech"),
        ("Datadog SaaS company New York", "SaaS"),
        ("Caterpillar manufacturing company Chicago", "Manufacturing"),
        ("Palantir technology company Denver", "AI/Data"),
        ("CrowdStrike cybersecurity Austin", "Cybersecurity"),
        ("Snowflake cloud company Boston", "Cloud/Data"),
        ("HubSpot marketing software Boston", "SaaS"),
        ("UiPath automation company New York", "Automation"),
        ("Cloudflare cloud security San Francisco", "Security"),
        ("Shopify e-commerce platform Toronto", "E-Commerce"),
        ("Figma design software San Francisco", "Design SaaS"),
        ("Notion productivity software San Francisco", "Productivity"),
        ("Canva design platform Sydney", "Design SaaS"),
        ("Revolut fintech company London", "FinTech"),
        ("N26 banking company Berlin", "FinTech"),
    ]

    saved = 0
    for query, industry in searches:
        if saved >= 15:
            break
        print(f"\nSearching: {query}")
        results = serper_search(query, num=5)
        for r in results:
            url = r.get("link", "")
            title = r.get("title", "")
            snippet = r.get("snippet", "")
            if not is_real_company(url, title, snippet):
                continue
            company = extract_company_name(url, title, snippet)
            if len(company) < 3:
                continue
            # Check if already exists
            existing = db.query(Organization).filter(
                Organization.name == company, Organization.is_deleted == False
            ).first()
            if existing:
                print(f"  [EXISTS] {company}")
                continue
            # Research
            print(f"  [RESEARCHING] {company}...")
            info = research_company(company, url)
            # Create org
            org = Organization(
                name=company,
                organization_type="Technology Company",
                industry=industry,
                city=query.split()[-1] if query.split()[-1].isalpha() else "Unknown",
                country="US",
                website=url,
                email=info.get("email", ""),
                phone=info.get("phone", ""),
                description=info.get("description", snippet[:500]),
                status=ConnectionStatus.NEW.value,
                priority=PriorityLevel.HIGH.value,
                notes=f"Researched via Discovery. Industry: {industry}",
            )
            db.add(org)
            db.flush()
            # Find decision maker
            dm = find_decision_maker(company)
            for c in dm:
                contact = Contact(
                    first_name=c["first"],
                    last_name=c["last"],
                    designation=c["title"],
                    organization_id=org.id,
                    is_decision_maker=True,
                    is_primary_contact=True,
                    linkedin_url=c.get("linkedin", ""),
                    notes=f"Found via LinkedIn: {c['title']}",
                )
                db.add(contact)
                print(f"    -> Contact: {c['name']} ({c['title']})")
            db.commit()
            saved += 1
            print(f"  [SAVED] {company} (ID={org.id})")
            if saved >= 15:
                break
            time.sleep(1)  # Rate limit

    # Final count
    total_orgs = db.query(Organization).filter(Organization.is_deleted == False).count()
    total_contacts = db.query(Contact).filter(Contact.is_deleted == False).count()
    db.close()

    print(f"\n{'=' * 70}")
    print(f"DONE: {saved} companies researched and saved")
    print(f"Database: {total_orgs} orgs, {total_contacts} contacts")
    print(f"{'=' * 70}")

if __name__ == "__main__":
    main()
