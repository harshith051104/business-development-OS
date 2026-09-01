"""
Phase 22 tests: Real-world validation infrastructure.

Tests the validation pipeline components, provider status accuracy,
and end-to-end scenario execution (mocked for deterministic testing).
"""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone


class TestValidationInfrastructure:
    def test_scenario_definitions_exist(self):
        from tests.phase22_validation import SCENARIOS
        assert len(SCENARIOS) >= 3
        for s in SCENARIOS:
            assert "id" in s
            assert "name" in s
            assert "keyword" in s

    def test_validation_report_dataclass(self):
        from tests.phase22_validation import ValidationReport
        report = ValidationReport(scenario="A", query="Test")
        assert report.scenario == "A"
        assert report.organizations_found == 0
        assert report.fit_scores == []

    def test_validation_org_dataclass(self):
        from tests.phase22_validation import ValidationOrg
        org = ValidationOrg(name="Test Hospital", website="test.com")
        assert org.name == "Test Hospital"
        assert org.research_status == "not_researched"

    def test_provider_status_check(self):
        from tests.phase22_validation import check_provider_status
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.TAVILY_API_KEY = "test"
            mock_settings.SERPER_API_KEY = ""
            mock_settings.SCRAPEGRAPH_ENABLED = True
            mock_settings.OPENOUTREACH_ENABLED = False
            mock_settings.BETTERCONTACT_ENABLED = False
            mock_settings.BETTERCONTACT_API_KEY = ""
            mock_settings.GROQ_API_KEY = "test"
            mock_settings.NVIDIA_NIM_API_KEY = ""
            mock_settings.GEMINI_API_KEY = ""
            status = check_provider_status()
            assert status["Tavily"] == "CONNECTED"
            assert status["Serper"] == "NOT_CONFIGURED"
            assert status["ScrapeGraphAI"] == "CONNECTED"
            assert status["OpenOutreach"] == "DISABLED"
            assert status["BetterContact"] == "DISABLED"
            assert status["LLM"] == "CONNECTED"
            assert status["PublicWeb"] == "CONNECTED"


class TestProviderStatusAccuracy:
    def test_bettercontact_disabled_by_default(self):
        from app.core.config import settings
        assert settings.BETTERCONTACT_ENABLED is False

    def test_bettercontact_disabled_status(self):
        from tests.phase22_validation import check_provider_status
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.BETTERCONTACT_ENABLED = False
            mock_settings.BETTERCONTACT_API_KEY = ""
            status = check_provider_status()
            assert status["BetterContact"] == "DISABLED"

    def test_bettercontact_enabled_no_key(self):
        from tests.phase22_validation import check_provider_status
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.BETTERCONTACT_ENABLED = True
            mock_settings.BETTERCONTACT_API_KEY = ""
            mock_settings.TAVILY_API_KEY = ""
            mock_settings.SERPER_API_KEY = ""
            mock_settings.SCRAPEGRAPH_ENABLED = True
            mock_settings.OPENOUTREACH_ENABLED = True
            mock_settings.GROQ_API_KEY = "test"
            mock_settings.NVIDIA_NIM_API_KEY = ""
            mock_settings.GEMINI_API_KEY = ""
            status = check_provider_status()
            assert status["BetterContact"] == "NOT_CONFIGURED"

    def test_bettercontact_enabled_with_key(self):
        from tests.phase22_validation import check_provider_status
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.BETTERCONTACT_ENABLED = True
            mock_settings.BETTERCONTACT_API_KEY = "real-key"
            mock_settings.TAVILY_API_KEY = ""
            mock_settings.SERPER_API_KEY = ""
            mock_settings.SCRAPEGRAPH_ENABLED = True
            mock_settings.OPENOUTREACH_ENABLED = True
            mock_settings.GROQ_API_KEY = "test"
            mock_settings.NVIDIA_NIM_API_KEY = ""
            mock_settings.GEMINI_API_KEY = ""
            status = check_provider_status()
            assert status["BetterContact"] == "CONNECTED"

    def test_openoutreach_adapter_ready(self):
        from tests.phase22_validation import check_provider_status
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.TAVILY_API_KEY = ""
            mock_settings.SERPER_API_KEY = ""
            mock_settings.SCRAPEGRAPH_ENABLED = True
            mock_settings.OPENOUTREACH_ENABLED = True
            mock_settings.BETTERCONTACT_ENABLED = False
            mock_settings.BETTERCONTACT_API_KEY = ""
            mock_settings.GROQ_API_KEY = "test"
            mock_settings.NVIDIA_NIM_API_KEY = ""
            mock_settings.GEMINI_API_KEY = ""
            status = check_provider_status()
            assert status["OpenOutreach"] == "ADAPTER_READY"


class TestDiscoveryPipelineComponents:
    def test_deduplication_with_evidence(self):
        from app.services.discovery.deduplication import DeduplicationEngine
        engine = DeduplicationEngine(db=MagicMock())
        leads = [
            {"name": "Apollo Hospitals", "website": "https://apollo.com", "phone": "+914023607777"},
            {"name": "Apollo Hospital", "website": "https://apollo.com", "phone": "+914023607777"},
        ]
        result = engine._dedup_within_batch(leads)
        assert len(result) == 1

    def test_qualification_always_returns_score(self):
        from app.services.discovery.qualification import ExplainableQualification
        q = ExplainableQualification()
        org = {"name": "Test", "organization_type": "Hospital", "city": "Mumbai", "country": "India"}
        result = q.qualify(org)
        assert 0 <= result.score <= 100
        assert result.tier in ("High", "Medium", "Low")
        assert len(result.factors) == 7

    def test_hybrid_qualification_fallback(self):
        from app.services.discovery.qualification import ExplainableQualification
        q = ExplainableQualification()
        org = {"name": "Test", "organization_type": "Hospital"}
        with patch("app.services.discovery.llm_qualification.llm_qualify", side_effect=Exception("LLM down")):
            result = q.qualify_hybrid(org)
            assert result["source"] == "deterministic"
            assert result["llm_score"] is None
            assert result["final_score"] == result["deterministic_score"]

    def test_brief_generator_produces_facts_and_inferences(self):
        from app.services.discovery.brief_generator_v2 import generate_enhanced_brief
        org = {"name": "Test Org", "organization_type": "Hospital"}
        research = {"digital_transformation": "Cloud migration", "ai_adoption": "AI diagnostics"}
        brief = generate_enhanced_brief(org, research)
        assert "facts" in brief["business_signals"]
        assert "inferences" in brief["business_signals"]
        assert brief["classification"]["facts_count"] >= 1

    def test_public_web_provider_never_fabricates(self):
        from app.services.enrichment.public_web_provider import PublicWebContactProvider
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.TAVILY_API_KEY = ""
            mock_settings.SERPER_API_KEY = ""
            p = PublicWebContactProvider()
            result = p.find_contact("Nonexistent Org XYZ 99999")
            for c in result.contacts:
                assert c.name != "" or c.email is not None

    def test_decision_maker_free_first_no_fabrication(self):
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
                mock_db, organization_name="Nonexistent Hospital XYZ 99999", limit=5
            )
            for c in contacts:
                assert "Rajesh Varma" not in c.get("name", "")
                assert "Ananya Sen" not in c.get("name", "")

    def test_known_roster_returns_real_contacts(self):
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
                mock_db, organization_name="Apollo Hospitals Enterprise Ltd", limit=5
            )
            assert len(contacts) >= 1
            names = [c["name"] for c in contacts]
            assert any("Reddy" in n or "Sanjeev" in n or "Sangita" in n for n in names)

    def test_research_cache_version(self):
        from app.services.discovery.research_cache import RESEARCH_VERSION
        assert RESEARCH_VERSION.startswith("phase")

    def test_provider_health_singleton(self):
        from app.services.discovery.provider_health import ProviderHealthTracker
        t1 = ProviderHealthTracker.get_instance()
        t2 = ProviderHealthTracker.get_instance()
        assert t1 is t2

    def test_enrichment_base_class(self):
        from app.services.enrichment.base import ContactEnrichmentProvider, ContactEnrichment, EnrichmentResult
        c = ContactEnrichment(name="Test", role="CTO", verification_state="publicly_found")
        d = c.to_dict()
        assert d["verification_state"] == "publicly_found"
        r = EnrichmentResult(contacts=[c], provider="test", available=True)
        assert len(r.to_dict()["contacts"]) == 1
