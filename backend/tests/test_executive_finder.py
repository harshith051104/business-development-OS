"""Tests for the executive finder's pure parsing / ranking logic (no network)."""
from unittest.mock import patch

from app.services.discovery_providers import executive_finder as ef
from app.services.discovery_providers.executive_finder import ExecutiveFinder


def _finder():
    f = ExecutiveFinder()
    f.serper_key = "x"
    f.tavily_key = "x"
    return f


def test_seniority_rank_orders_roles():
    assert ef._seniority_rank("Founder & CEO") == 0
    assert ef._seniority_rank("Chief Technology Officer") == 0
    assert ef._seniority_rank("Vice President Sales") == 1
    assert ef._seniority_rank("Director of Engineering") == 1
    assert ef._seniority_rank("Associate Director") == 3


def test_partnership_is_not_a_partner_role():
    assert not ef.ROLE_RE.search("partnership with")


def test_clean_name_rejects_non_people():
    assert ef._clean_name("Manchester City Football") is None or ef._clean_name("Our Leadership Team") is None
    assert ef._clean_name("Jane Doe") == "Jane Doe"


def test_valid_email_rejects_placeholders():
    assert not ef._valid_email("alex@company.com")
    assert ef._valid_email("info@acme.in")


def test_text_extraction_drops_other_orgs_title():
    f = _finder()
    text = "Acme Robotics leadership. Rajiv Kumar, CEO - CISS Institute. Jane Doe, Founder & CEO, Acme Robotics."
    out = f._extract_from_text(text, "Acme Robotics", "t", "u", 0.6, require_org_near=True)
    names = {c["full_name"] for c in out}
    assert "Jane Doe" in names
    assert "Rajiv Kumar" not in names


def test_find_executives_sorts_senior_first_and_drops_junior():
    f = _finder()
    senior = {"full_name": "Ann Lee", "job_title": "CEO", "linkedin_url": None, "email": None,
              "email_status": "not_found", "source": "s", "source_url": "u", "confidence": 0.8}
    junior = {**senior, "full_name": "Bob Ray", "job_title": "Associate Director"}
    with patch.object(f, "_from_serper", return_value=[junior, senior]), \
            patch.object(f, "_from_tavily", return_value=[]), \
            patch.object(f, "_from_website", return_value=([], [])), \
            patch.object(f, "_from_scrapegraph") as sg:
        out = f.find_executives("Acme Robotics", "https://acme.com", "Pune")
    assert [c["full_name"] for c in out] == ["Ann Lee"]
    sg.assert_not_called()


def test_scrapegraph_only_runs_on_live_page():
    f = _finder()
    with patch.object(f, "_from_serper", return_value=[]), \
            patch.object(f, "_from_tavily", return_value=[]), \
            patch.object(f, "_from_website", return_value=([], [])), \
            patch.object(f, "_from_scrapegraph") as sg:
        f.find_executives("Acme Robotics", "https://acme.com", "Pune")
    sg.assert_not_called()
    with patch.object(f, "_from_serper", return_value=[]), \
            patch.object(f, "_from_tavily", return_value=[]), \
            patch.object(f, "_from_website", return_value=([], ["https://acme.com/about"])), \
            patch.object(f, "_from_scrapegraph", return_value=[]) as sg:
        f.find_executives("Acme Robotics", "https://acme.com", "Pune")
    sg.assert_called_once_with("Acme Robotics", "https://acme.com/about")


def test_maps_provider_returns_empty_when_scraper_down():
    from app.services.discovery_providers.google_maps_scraper_provider import GoogleMapsScraperProvider
    with patch("app.services.discovery_providers.google_maps_scraper_provider.is_scraper_available", return_value=False):
        assert GoogleMapsScraperProvider().search_organizations(keyword="software", location="Pune") == ([], 0)


def test_maps_provider_registered():
    from app.services.discovery_providers.registry import discovery_registry
    names = [p["name"] for p in discovery_registry.list_available_providers()["organization_providers"]]
    assert "Google Maps Scraper (Local)" in names
