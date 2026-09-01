"""
Phase 20 tests: BetterContact adapter, Persistent research cache,
LLM qualification, Enhanced deduplication, Provider health, Brief v2.
"""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta, timezone


# ─────────────────────────────────────────────────────────────
# BETTERCONTACT ADAPTER
# ─────────────────────────────────────────────────────────────

class TestBetterContactAdapter:
    def test_unavailable_without_key(self):
        from app.services.enrichment.bettercontact_adapter import BetterContactAdapter
        adapter = BetterContactAdapter(api_key="")
        assert adapter.is_available is False
        result = adapter.find_contact("Test Org", "John Doe", "CTO")
        assert result.available is False
        assert "not configured" in result.error.lower()

    def test_normalize_email_valid(self):
        from app.services.enrichment.bettercontact_adapter import BetterContactAdapter
        adapter = BetterContactAdapter(api_key="test-key")
        assert adapter._normalize_email("test@example.com") == "test@example.com"
        assert adapter._normalize_email("TEST@EXAMPLE.COM") == "test@example.com"
        assert adapter._normalize_email("  user@domain.org  ") == "user@domain.org"

    def test_normalize_email_invalid(self):
        from app.services.enrichment.bettercontact_adapter import BetterContactAdapter
        adapter = BetterContactAdapter(api_key="test-key")
        assert adapter._normalize_email("") is None
        assert adapter._normalize_email("not-an-email") is None
        assert adapter._normalize_email("missing@") is None
        assert adapter._normalize_email("@domain.com") is None

    def test_confidence_computation(self):
        from app.services.enrichment.bettercontact_adapter import BetterContactAdapter
        adapter = BetterContactAdapter(api_key="test-key")
        assert adapter._compute_confidence({"email_verified": True}) == 95
        assert adapter._compute_confidence({"email": "a@b.com", "email_status": "valid"}) == 85
        assert adapter._compute_confidence({"email": "a@b.com"}) == 70
        assert adapter._compute_confidence({"phone": "+1234567890"}) == 50
        assert adapter._compute_confidence({}) == 20

    def test_enrichment_result_to_dict(self):
        from app.services.enrichment.bettercontact_adapter import EnrichmentResult, EnrichedContact
        contact = EnrichedContact(name="John", email="john@test.com", confidence=85)
        result = EnrichmentResult(contacts=[contact], available=True)
        d = result.to_dict()
        assert d["available"] is True
        assert len(d["contacts"]) == 1
        assert d["contacts"][0]["email"] == "john@test.com"

    def test_verify_email_without_key(self):
        from app.services.enrichment.bettercontact_adapter import BetterContactAdapter
        adapter = BetterContactAdapter(api_key="")
        result = adapter.verify_email("test@example.com")
        assert result["status"] == "unknown"
        assert "not configured" in result["error"].lower()


# ─────────────────────────────────────────────────────────────
# PERSISTENT RESEARCH CACHE
# ─────────────────────────────────────────────────────────────

class TestResearchCache:
    def test_is_cache_valid_within_ttl(self):
        from app.services.discovery.research_cache import is_cache_valid
        now = datetime.now(timezone.utc)
        assert is_cache_valid(now, ttl_hours=24) is True

    def test_is_cache_valid_expired(self):
        from app.services.discovery.research_cache import is_cache_valid
        old = datetime.now(timezone.utc) - timedelta(hours=25)
        assert is_cache_valid(old, ttl_hours=24) is False

    def test_is_cache_valid_none_timestamp(self):
        from app.services.discovery.research_cache import is_cache_valid
        assert is_cache_valid(None) is False

    def test_research_version_constant(self):
        from app.services.discovery.research_cache import RESEARCH_VERSION
        assert RESEARCH_VERSION == "phase20-v1"


# ─────────────────────────────────────────────────────────────
# LLM QUALIFICATION
# ─────────────────────────────────────────────────────────────

class TestLLMQualification:
    def test_parse_valid_json(self):
        from app.services.discovery.llm_qualification import _parse_llm_response
        result = _parse_llm_response('{"score": 85, "confidence": 0.9, "reasons": ["test"]}')
        assert result["score"] == 85
        assert result["confidence"] == 0.9

    def test_parse_markdown_json(self):
        from app.services.discovery.llm_qualification import _parse_llm_response
        result = _parse_llm_response('```json\n{"score": 70, "confidence": 0.8}\n```')
        assert result["score"] == 70

    def test_parse_empty_response(self):
        from app.services.discovery.llm_qualification import _parse_llm_response
        result = _parse_llm_response("")
        assert result == {}

    def test_parse_invalid_json(self):
        from app.services.discovery.llm_qualification import _parse_llm_response
        result = _parse_llm_response("not json at all")
        assert result == {}

    def test_build_org_info(self):
        from app.services.discovery.llm_qualification import _build_org_info
        org = {"name": "Test Hospital", "organization_type": "Hospital", "city": "Mumbai"}
        info = _build_org_info(org)
        assert "Test Hospital" in info
        assert "Hospital" in info
        assert "Mumbai" in info


# ─────────────────────────────────────────────────────────────
# ENHANCED DEDUPLICATION
# ─────────────────────────────────────────────────────────────

class TestEnhancedDeduplication:
    def test_normalize_domain(self):
        from app.services.discovery.deduplication import _normalize_domain
        assert _normalize_domain("https://www.example.com/path") == "example.com"
        assert _normalize_domain("http://m.example.com") == "example.com"
        assert _normalize_domain("app.example.com") == "example.com"

    def test_normalize_phone(self):
        from app.services.discovery.deduplication import _normalize_phone
        assert _normalize_phone("+91 98001 12345") == "919800112345"
        assert _normalize_phone("(123) 456-7890") == "1234567890"
        assert _normalize_phone("") == ""

    def test_check_alias_match(self):
        from app.services.discovery.deduplication import _check_alias_match
        assert _check_alias_match("Apollo Hospitals", "Apollo Hospital") is True
        assert _check_alias_match("Fortis Healthcare", "Fortis Hospitals") is True
        assert _check_alias_match("AIIMS", "All India Institute of Medical Sciences") is True
        assert _check_alias_match("Random Org", "Different Org") is False

    def test_name_similarity(self):
        from app.services.discovery.deduplication import _name_similarity
        assert _name_similarity("Apollo Hospitals India", "Apollo Hospitals India") == 1.0
        assert _name_similarity("Fortis Healthcare", "Fortis Healthcare Services") > 0.5
        assert _name_similarity("Completely Different", "Another Org Name") == 0.0

    def test_dedup_within_batch(self):
        from app.services.discovery.deduplication import DeduplicationEngine
        engine = DeduplicationEngine(db=MagicMock())
        leads = [
            {"name": "Apollo Hospitals", "website": "https://apollo.com"},
            {"name": "Apollo Hospital", "website": "https://apollo.com"},
            {"name": "Fortis Healthcare", "website": "https://fortis.com"},
        ]
        unique = engine._dedup_within_batch(leads)
        assert len(unique) == 2  # Apollo Hospital is a duplicate


# ─────────────────────────────────────────────────────────────
# PROVIDER HEALTH
# ─────────────────────────────────────────────────────────────

class TestProviderHealth:
    def test_singleton(self):
        from app.services.discovery.provider_health import ProviderHealthTracker
        t1 = ProviderHealthTracker.get_instance()
        t2 = ProviderHealthTracker.get_instance()
        assert t1 is t2

    def test_record_success(self):
        from app.services.discovery.provider_health import ProviderHealthTracker
        tracker = ProviderHealthTracker()
        tracker.record_success("Tavily", latency_ms=150.0)
        status = tracker.get_status("Tavily")
        assert status["status"] == "AVAILABLE"
        assert status["latency_ms"] == 150.0

    def test_record_failure(self):
        from app.services.discovery.provider_health import ProviderHealthTracker
        tracker = ProviderHealthTracker()
        tracker.record_failure("Serper", "API key invalid")
        status = tracker.get_status("Serper")
        assert status["status"] == "UNAVAILABLE"
        assert status["last_error"] == "API key invalid"

    def test_get_all_status(self):
        from app.services.discovery.provider_health import ProviderHealthTracker
        tracker = ProviderHealthTracker()
        all_status = tracker.get_all_status()
        assert "Tavily" in all_status
        assert "Serper" in all_status
        assert "BetterContact" in all_status
        assert "LLM" in all_status


# ─────────────────────────────────────────────────────────────
# BRIEF V2
# ─────────────────────────────────────────────────────────────

class TestBriefGeneratorV2:
    def test_classify_claims(self):
        from app.services.discovery.brief_generator_v2 import _classify_claims
        research = {
            "digital_transformation": "Cloud migration",
            "ai_adoption": "AI diagnostics",
        }
        classified = _classify_claims(research, research)
        assert len(classified["facts"]) >= 2
        assert len(classified["inferences"]) >= 1

    def test_generate_enhanced_brief(self):
        from app.services.discovery.brief_generator_v2 import generate_enhanced_brief
        org = {"name": "Test Hospital", "organization_type": "Hospital", "city": "Mumbai", "country": "India"}
        research = {"digital_transformation": "Cloud migration", "ai_adoption": "AI diagnostics"}
        qualification = {"score": 85, "tier": "High", "confidence": 0.9, "positive_signals": ["Strong digital signals"]}

        brief = generate_enhanced_brief(org, research, qualification)
        assert brief["organization"]["name"] == "Test Hospital"
        assert "facts" in brief["business_signals"]
        assert "inferences" in brief["business_signals"]
        assert brief["classification"]["facts_count"] >= 1

    def test_brief_distinguishes_fact_from_inference(self):
        from app.services.discovery.brief_generator_v2 import generate_enhanced_brief
        org = {"name": "Test Org"}
        research = {"digital_transformation": "Cloud migration"}
        brief = generate_enhanced_brief(org, research)
        # All business signal claims should be classified
        assert isinstance(brief["business_signals"]["facts"], list)
        assert isinstance(brief["business_signals"]["inferences"], list)

    def test_source_provenance(self):
        from app.services.discovery.brief_generator_v2 import generate_enhanced_brief
        org = {"name": "Test Org"}
        sources = [{"source_url": "https://example.com", "source_type": "company_website", "provider": "tavily"}]
        brief = generate_enhanced_brief(org, sources=sources)
        assert len(brief["source_provenance"]) == 1
        assert brief["source_provenance"][0]["source_url"] == "https://example.com"


# ─────────────────────────────────────────────────────────────
# ENRICHMENT RESULT
# ─────────────────────────────────────────────────────────────

class TestEnrichmentResult:
    def test_enriched_contact_to_dict(self):
        from app.services.enrichment.bettercontact_adapter import EnrichedContact
        contact = EnrichedContact(
            name="Dr. Smith",
            role="CTO",
            organization="Test Hospital",
            email="smith@test.com",
            email_status="verified",
            confidence=95,
            verification_state="verified",
        )
        d = contact.to_dict()
        assert d["name"] == "Dr. Smith"
        assert d["verification_state"] == "verified"
        assert d["confidence"] == 95

    def test_enrichment_result_contacts_empty(self):
        from app.services.enrichment.bettercontact_adapter import EnrichmentResult
        result = EnrichmentResult(contacts=[], available=True)
        assert len(result.to_dict()["contacts"]) == 0
