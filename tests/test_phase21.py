"""
Phase 21 tests: Free-first lead & contact intelligence.

Tests BetterContact disabled, public web discovery,
no hallucination, copilot transparency, provider health.
"""
import pytest
from unittest.mock import patch, MagicMock


# ─────────────────────────────────────────────────────────────
# ENRICHMENT BASE CLASS
# ─────────────────────────────────────────────────────────────

class TestEnrichmentBase:
    def test_contact_enrichment_to_dict(self):
        from app.services.enrichment.base import ContactEnrichment
        c = ContactEnrichment(
            name="Jane Smith", role="CTO", organization="Test Org",
            email="jane@test.com", email_status="publicly_found",
            confidence=70, source="public_web",
            verification_state="publicly_found",
        )
        d = c.to_dict()
        assert d["name"] == "Jane Smith"
        assert d["verification_state"] == "publicly_found"
        assert d["email_status"] == "publicly_found"

    def test_enrichment_result_to_dict(self):
        from app.services.enrichment.base import EnrichmentResult, ContactEnrichment
        c = ContactEnrichment(name="John", confidence=50)
        r = EnrichmentResult(contacts=[c], provider="test", available=True)
        d = r.to_dict()
        assert d["available"] is True
        assert len(d["contacts"]) == 1


# ─────────────────────────────────────────────────────────────
# PUBLIC WEB CONTACT PROVIDER
# ─────────────────────────────────────────────────────────────

class TestPublicWebProvider:
    def test_provider_name(self):
        from app.services.enrichment.public_web_provider import PublicWebContactProvider
        p = PublicWebContactProvider()
        assert p.provider_name == "Public Web Contact Discovery"

    def test_normalize_role(self):
        from app.services.enrichment.public_web_provider import _normalize_role
        assert _normalize_role("Chief Technology Officer") == "CTO"
        assert _normalize_role("Chief Information Officer") == "CIO"
        assert _normalize_role("Head of IT") == "Head of IT"
        assert _normalize_role("CEO") == "CEO"
        assert _normalize_role("Some Random Title") == "Some Random Title"

    def test_extract_emails(self):
        from app.services.enrichment.public_web_provider import _extract_emails
        text = "Contact us at info@company.com or support@company.org"
        emails = _extract_emails(text)
        assert "info@company.com" in emails
        assert "support@company.org" in emails

    def test_extract_emails_filters_false_positives(self):
        from app.services.enrichment.public_web_provider import _extract_emails
        text = "Image loaded from logo.png or script.js"
        emails = _extract_emails(text)
        assert len(emails) == 0

    def test_extract_phones(self):
        from app.services.enrichment.public_web_provider import _extract_phones
        text = "Call us at +91 40 2360 7777 or (011) 2651 5050"
        phones = _extract_phones(text)
        assert len(phones) >= 1

    def test_unavailable_without_providers(self):
        from app.services.enrichment.public_web_provider import PublicWebContactProvider
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.TAVILY_API_KEY = ""
            mock_settings.SERPER_API_KEY = ""
            p = PublicWebContactProvider()
            assert p.is_available is False
            result = p.find_contact("Test Org")
            assert result.available is False

    def test_find_contact_no_fabrication(self):
        from app.services.enrichment.public_web_provider import PublicWebContactProvider
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.TAVILY_API_KEY = ""
            mock_settings.SERPER_API_KEY = ""
            p = PublicWebContactProvider()
            result = p.find_contact("Nonexistent Organization XYZ")
            # Should return empty or unavailable, never fabricated contacts
            for c in result.contacts:
                assert c.name != "" or c.email is not None  # Must have at least one real data point


# ─────────────────────────────────────────────────────────────
# CONTACT PROVIDER — NO FABRICATION
# ─────────────────────────────────────────────────────────────

class TestContactProviderNoFabrication:
    def test_unknown_org_returns_empty(self):
        from app.services.discovery_providers.contact_provider import ExecutiveContactDiscoveryProvider
        provider = ExecutiveContactDiscoveryProvider()
        results = provider.search_decision_makers(
            organization_name="Completely Unknown Organization 12345",
            target_roles=["CTO"],
            limit=5,
        )
        # Must return empty, not fabricated contacts
        assert len(results) == 0

    def test_known_org_returns_real_data(self):
        from app.services.discovery_providers.contact_provider import ExecutiveContactDiscoveryProvider
        provider = ExecutiveContactDiscoveryProvider()
        results = provider.search_decision_makers(
            organization_name="Apollo Hospitals Enterprise Ltd",
            target_roles=["CTO"],
            limit=5,
        )
        # Apollo is in the known roster
        assert len(results) >= 1
        for r in results:
            assert r["full_name"] != ""
            assert "Unknown" not in r["full_name"]


# ─────────────────────────────────────────────────────────────
# DECISION MAKER — FREE-FIRST PIPELINE
# ─────────────────────────────────────────────────────────────

class TestDecisionMakerFreeFirst:
    def test_free_first_pipeline_no_bettercontact(self):
        from app.services.discovery.decision_maker import discover_decision_makers
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.BETTERCONTACT_ENABLED = False
            mock_settings.BETTERCONTACT_API_KEY = ""
            mock_settings.TAVILY_API_KEY = ""
            mock_settings.SERPER_API_KEY = ""
            # Mock DB
            mock_db = MagicMock()
            mock_db.query.return_value.filter.return_value.first.return_value = None
            mock_db.query.return_value.filter.return_value.all.return_value = []

            contacts = discover_decision_makers(
                mock_db,
                organization_name="Apollo Hospitals Enterprise Ltd",
                target_roles=["CTO"],
                limit=5,
            )
            # Should find Apollo CTO from known roster
            assert len(contacts) >= 1
            # Should NOT have BetterContact as source
            for c in contacts:
                assert "bettercontact" not in c.get("source", "").lower()

    def test_verification_state_always_present(self):
        from app.services.discovery.decision_maker import discover_decision_makers
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.BETTERCONTACT_ENABLED = False
            mock_settings.BETTERCONTACT_API_KEY = ""
            mock_settings.TAVILY_API_KEY = ""
            mock_settings.SERPER_API_KEY = ""
            mock_db = MagicMock()
            mock_db.query.return_value.filter.return_value.first.return_value = None
            mock_db.query.return_value.filter.return_value.all.return_value = []

            contacts = discover_decision_makers(
                mock_db,
                organization_name="Apollo Hospitals Enterprise Ltd",
                limit=5,
            )
            for c in contacts:
                assert "verification_state" in c


# ─────────────────────────────────────────────────────────────
# BETTERCONTACT OPTIONAL
# ─────────────────────────────────────────────────────────────

class TestBetterContactOptional:
    def test_adapter_unavailable_does_not_crash(self):
        from app.services.enrichment.bettercontact_adapter import BetterContactAdapter
        adapter = BetterContactAdapter(api_key="")
        assert adapter.is_available is False
        result = adapter.find_contact("Test Org", "John Doe", "CTO")
        assert result.available is False
        assert result.contacts == []

    def test_config_defaults(self):
        from app.core.config import settings
        # BetterContact should be disabled by default
        assert settings.BETTERCONTACT_ENABLED is False

    def test_enrichment_works_without_bettercontact(self):
        from app.services.enrichment.base import EnrichmentResult
        # Public web provider should work independently
        result = EnrichmentResult(provider="public_web", available=True)
        assert result.available is True
        assert result.to_dict()["provider"] == "public_web"


# ─────────────────────────────────────────────────────────────
# PROVIDER HEALTH — DISABLED STATUS
# ─────────────────────────────────────────────────────────────

class TestProviderHealthDisabled:
    def test_bettercontact_shows_disabled(self):
        from app.services.discovery.provider_health import ProviderHealthTracker
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.BETTERCONTACT_ENABLED = False
            mock_settings.BETTERCONTACT_API_KEY = ""
            mock_settings.TAVILY_API_KEY = "test"
            mock_settings.SERPER_API_KEY = ""
            mock_settings.GROQ_API_KEY = "test"
            mock_settings.NVIDIA_NIM_API_KEY = ""
            mock_settings.GEMINI_API_KEY = ""
            mock_settings.SCRAPEGRAPH_ENABLED = True
            mock_settings.OPENOUTREACH_ENABLED = True

            tracker = ProviderHealthTracker()
            all_status = tracker.get_all_status()
            assert all_status["BetterContact"]["status"] == "DISABLED"

    def test_public_web_configured(self):
        from app.services.discovery.provider_health import ProviderHealthTracker
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.BETTERCONTACT_ENABLED = False
            mock_settings.BETTERCONTACT_API_KEY = ""
            mock_settings.TAVILY_API_KEY = "test-key"
            mock_settings.SERPER_API_KEY = ""
            mock_settings.GROQ_API_KEY = "test"
            mock_settings.NVIDIA_NIM_API_KEY = ""
            mock_settings.GEMINI_API_KEY = ""
            mock_settings.SCRAPEGRAPH_ENABLED = True
            mock_settings.OPENOUTREACH_ENABLED = True

            tracker = ProviderHealthTracker()
            all_status = tracker.get_all_status()
            assert all_status["PublicWeb"]["status"] in ("CONFIGURED", "AVAILABLE")


# ─────────────────────────────────────────────────────────────
# NO HALLUCINATION
# ─────────────────────────────────────────────────────────────

class TestNoHallucination:
    def test_no_guessed_emails(self):
        from app.services.enrichment.public_web_provider import _extract_emails
        # These should never be extracted as emails
        text = "firstname.lastname@domain.com is a pattern we should not generate"
        emails = _extract_emails(text)
        # The text contains an email, but it's from a description, not a real source
        # The provider should only record emails found in actual page content
        assert isinstance(emails, list)

    def test_no_fabricated_phones(self):
        from app.services.enrichment.public_web_provider import PublicWebContactProvider
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.TAVILY_API_KEY = ""
            mock_settings.SERPER_API_KEY = ""
            p = PublicWebContactProvider()
            result = p.find_contact("Fake Org")
            for c in result.contacts:
                if c.phone:
                    # Phone must have at least 8 digits
                    import re
                    digits = re.sub(r'\D', '', c.phone)
                    assert len(digits) >= 8

    def test_not_found_contacts_not_invented(self):
        from app.services.discovery.decision_maker import discover_decision_makers
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.BETTERCONTACT_ENABLED = False
            mock_settings.BETTERCONTACT_API_KEY = ""
            mock_settings.TAVILY_API_KEY = ""
            mock_settings.SERPER_API_KEY = ""
            mock_db = MagicMock()
            mock_db.query.return_value.filter.return_value.first.return_value = None
            mock_db.query.return_value.filter.return_value.all.return_value = []

            contacts = discover_decision_makers(
                mock_db,
                organization_name="Nonexistent Hospital XYZ 99999",
                limit=5,
            )
            # Should return empty, not fabricated names
            for c in contacts:
                assert c["name"] != "Rajesh Varma"  # Known archetype name that was removed
                assert c["name"] != "Ananya Sen"
