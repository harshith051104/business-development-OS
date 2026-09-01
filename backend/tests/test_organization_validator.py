"""
Tests for Organization Validator — Lead Quality Gate.
Tests rejection of garbage and acceptance of real orgs.
"""
import pytest
from app.services.discovery_providers.organization_validator import OrganizationValidator, organization_validator


@pytest.fixture
def v():
    return OrganizationValidator()


# ── REJECTION TESTS ─────────────────────────────────────────

REJECT_CASES = [
    # Generic single words
    ("About", "https://example.com/about", "generic_word"),
    ("Website", "https://example.com", "generic_word"),
    ("Home", "https://example.com", "generic_word"),
    ("Homepage", "https://example.com", "generic_word"),
    ("Contact", "https://example.com/contact", "generic_word"),
    ("Blog", "https://example.com/blog", "generic_word"),
    ("News", "https://example.com/news", "generic_word"),
    ("Search", "https://example.com", "generic_word"),
    ("Login", "https://example.com/login", "generic_word"),
    ("Dashboard", "https://example.com/dashboard", "generic_word"),
    ("Webmasters", "https://example.com", "generic_word"),
    ("Links-2", "https://example.com/links", "generic_word"),
    ("Support", "https://example.com/support", "generic_word"),
    ("Careers", "https://example.com/careers", "generic_word"),
    ("Privacy", "https://example.com/privacy", "generic_word"),

    # Article/listicle patterns
    ("20 Best Cybersecurity Companies", "https://example.com/list", "article_title"),
    ("Top 10 Software Companies in India", "https://example.com/top10", "article_title"),
    ("Best Hospitals in Delhi", "https://example.com/hospitals", "article_title"),
    ("The Complete Guide to SaaS", "https://example.com/guide", "article_title"),
    ("How to Choose a CRM", "https://example.com/howto", "article_title"),
    ("What is Digital Transformation", "https://example.com/what-is", "article_title"),
    ("Ultimate Guide to Cloud Computing", "https://example.com/guide", "article_title"),
    ("5 Leading AI Companies to Know", "https://example.com/list", "article_title"),
    ("Market Report 2024", "https://example.com/report", "article_title"),
    ("Industry Analysis: Healthcare", "https://example.com/analysis", "article_title"),

    # Junk domains
    ("Stripe", "https://wikipedia.org/wiki/Stripe", "junk_domain"),
    ("Stripe", "https://reddit.com/r/stripe", "junk_domain"),
    ("Stripe", "https://youtube.com/watch?v=stripe", "junk_domain"),
    ("Stripe", "https://medium.com/@stripe", "junk_domain"),
    ("Stripe", "https://forbes.com/companies/stripe", "junk_domain"),
    ("Stripe", "https://crunchbase.com/organization/stripe", "junk_domain"),
    ("Stripe", "https://glassdoor.com/Reviews/Stripe", "junk_domain"),
    ("Stripe", "https://github.com/stripe", "junk_domain"),

    # Junk URL paths
    ("Acme Corp", "https://acme.com/blog/top-10", "junk_url_path"),
    ("Acme Corp", "https://acme.com/news/acquisition", "junk_url_path"),
    ("Acme Corp", "https://acme.com/article/overview", "junk_url_path"),
    ("Acme Corp", "https://acme.com/template/saas", "junk_url_path"),
    ("Acme Corp", "https://acme.com/review/best-of", "junk_url_path"),
    ("Acme Corp", "https://acme.com/category/tech", "junk_url_path"),
    ("Acme Corp", "https://acme.com/download/free", "junk_url_path"),
    ("Acme Corp", "https://acme.com/tag/startup", "junk_url_path"),

    # Generic category names (not org names)
    ("Cybersecurity", "https://example.com", "generic_category"),
    ("Software", "https://example.com", "generic_category"),
    ("Healthcare", "https://example.com", "generic_category"),
    ("Fintech", "https://example.com", "generic_category"),
    ("SaaS", "https://example.com", "generic_category"),
    ("Manufacturing", "https://example.com", "generic_category"),
    ("Consulting", "https://example.com", "generic_category"),

    # Navigation text descriptions (descriptions starting with nav words)
    ("Acme Corp", "https://acme.com", "navigation_text"),

    # Empty/too short names
    ("", "https://example.com", "empty_name"),
    ("A", "https://example.com", "empty_name"),
    ("12", "https://example.com", "generic_word"),
]


@pytest.mark.parametrize("name,url,expected_reason", REJECT_CASES)
def test_rejects_garbage(v, name, url, expected_reason):
    """Validator rejects non-organization results."""
    # Use description that will trigger the expected rejection reason
    if expected_reason == "navigation_text":
        desc = "Click here to navigate"
    elif expected_reason == "empty_name":
        desc = "Some description"
    else:
        desc = "Some description"
    org = {"name": name, "website": url, "description": desc}
    is_valid, reason, _ = v.validate(org)
    assert not is_valid, f"Should reject '{name}' — got reason: {reason}"
    assert expected_reason in reason, f"Expected '{expected_reason}' in reason, got: {reason}"


# ── ACCEPTANCE TESTS ────────────────────────────────────────

ACCEPT_CASES = [
    # Real company names
    ("Stripe Inc", "https://stripe.com", "Payments company"),
    ("CrowdStrike", "https://crowdstrike.com", "Cybersecurity company"),
    ("Snowflake", "https://snowflake.com", "Cloud data platform"),
    ("HubSpot", "https://hubspot.com", "CRM platform"),
    ("Caterpillar Inc", "https://caterpillar.com", "Manufacturing"),
    ("Palantir Technologies", "https://palantir.com", "Data analytics"),
    ("UiPath", "https://uipath.com", "Automation platform"),
    ("Infosys Limited", "https://infosys.com", "IT services"),
    ("Tata Consultancy Services", "https://tcs.com", "IT services"),
    ("Wipro", "https://wipro.com", "IT services"),

    # Orgs without websites (still valid)
    ("Acme Corporation", "", "A company"),
    ("Global Tech Solutions", "", "Technology"),

    # Orgs with subdomains
    ("CloudNine SaaS", "https://app.cloudninesaas.com", "SaaS"),
    ("DataFlow Inc", "https://www.dataflow.io", "Data platform"),

    # Orgs with different TLDs
    ("Berlin AI GmbH", "https://berlin-ai.de", "German AI company"),
    ("Tokyo Tech Co", "https://tokyotech.co.jp", "Japanese tech"),
    ("Sydney Health AU", "https://sydneyhealth.com.au", "Australian health"),
]


@pytest.mark.parametrize("name,url,desc", ACCEPT_CASES)
def test_accepts_real_orgs(v, name, url, desc):
    """Validator accepts real organization results."""
    org = {"name": name, "website": url, "description": desc}
    is_valid, reason, normalized = v.validate(org)
    assert is_valid, f"Should accept '{name}' — rejected: {reason}"
    assert normalized["name"] == name or normalized["name"] == "The " + name


# ── NORMALIZATION TESTS ─────────────────────────────────────

def test_normalizes_name(v):
    """Name is cleaned and normalized."""
    org = {"name": "The Stripe Inc", "website": "https://stripe.com", "description": "Payments"}
    _, _, norm = v.validate(org)
    assert norm["name"] == "Stripe Inc"


def test_normalizes_website(v):
    """Website URL is normalized."""
    org = {"name": "Acme Corp", "website": "https://acme.com/", "description": "Stuff"}
    _, _, norm = v.validate(org)
    assert norm["website"] == "https://acme.com"


def test_normalizes_location(v):
    """Location fields are title-cased."""
    org = {"name": "Acme Corp", "website": "https://acme.com", "description": "Stuff",
           "city": "new york", "country": "us"}
    _, _, norm = v.validate(org)
    assert norm["city"] == "New York"
    assert norm["country"] == "Us"


# ── EDGE CASES ──────────────────────────────────────────────

def test_no_description(v):
    """Missing description is OK."""
    org = {"name": "Acme Corp", "website": "https://acme.com"}
    is_valid, _, _ = v.validate(org)
    assert is_valid


def test_no_website(v):
    """Missing website is OK."""
    org = {"name": "Acme Corp", "website": "", "description": "A company"}
    is_valid, _, _ = v.validate(org)
    assert is_valid


def test_numeric_name_rejected(v):
    """Numeric names are rejected."""
    org = {"name": "12345", "website": "https://example.com", "description": "Stuff"}
    is_valid, reason, _ = v.validate(org)
    assert not is_valid
    assert "generic_word" in reason or "numeric_name" in reason


def test_special_chars_only_rejected(v):
    """Names with only special characters are rejected."""
    org = {"name": "!@#$%", "website": "https://example.com", "description": "Stuff"}
    is_valid, reason, _ = v.validate(org)
    assert not is_valid
    assert "no_alphanumeric" in reason
