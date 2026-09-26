"""
Phase 19 tests: Research Engine, Discovery Orchestrator, Qualification,
Deduplication, Decision-Maker Discovery, Brief Generation, Project Matching.
"""
import pytest
from unittest.mock import patch, MagicMock


# ─────────────────────────────────────────────────────────────
# RESEARCH ENGINE
# ─────────────────────────────────────────────────────────────

class TestResearchEngine:
    def test_cache_key_normalization(self):
        from app.services.research.research_engine import _get_cache_key
        assert _get_cache_key("https://www.example.com/path") == "example.com"
        assert _get_cache_key("http://Example.COM") == "example.com"
        assert _get_cache_key("https://sub.domain.org/page?q=1") == "sub.domain.org"

    def test_cache_miss(self):
        from app.services.research.research_engine import _check_cache
        result = _check_cache("https://nonexistent-domain-12345.com")
        assert result is None

    def test_clear_cache(self):
        from app.services.research.research_engine import _research_cache, clear_research_cache
        _research_cache["test"] = ({}, 0)
        clear_research_cache()
        assert len(_research_cache) == 0

    def test_normalize_research(self):
        from app.services.research.research_engine import _normalize_research
        raw = {
            "official_name": "Test Hospital",
            "what_they_do": "A leading hospital",
            "industry": "Healthcare",
            "organization_type": "Hospital",
            "headquarters": "Mumbai",
            "locations": ["Mumbai", "Delhi"],
            "services": ["Cardiology", "Oncology"],
            "ai_adoption": "Uses AI for diagnostics",
            "digital_transformation": "Full digitization",
            "technology_initiatives": ["Cloud migration"],
            "recent_expansion": "New facility in Bangalore",
        }
        result = _normalize_research(raw, "https://test.com")
        assert result["organization_name"] == "Test Hospital"
        assert result["research_status"] == "completed"
        assert len(result["signals"]) >= 3
        assert result["services"] == ["Cardiology", "Oncology"]

    def test_normalize_research_string_lists(self):
        from app.services.research.research_engine import _normalize_research
        raw = {
            "services": "Cardiology, Oncology, Neurology",
            "locations": "Mumbai, Delhi",
            "technology_initiatives": "Cloud, AI",
        }
        result = _normalize_research(raw, "https://test.com")
        assert result["services"] == ["Cardiology", "Oncology", "Neurology"]
        assert result["locations"] == ["Mumbai", "Delhi"]


# ─────────────────────────────────────────────────────────────
# EXPLAINABLE QUALIFICATION
# ─────────────────────────────────────────────────────────────

class TestExplainableQualification:
    def setup_method(self):
        from app.services.discovery.qualification import ExplainableQualification
        self.qualifier = ExplainableQualification()

    def test_high_fit_hospital(self):
        org = {
            "name": "Apollo Hospitals",
            "organization_type": "Hospital Group",
            "description": "Multi-location hospital network with digital transformation",
            "city": "Hyderabad",
            "country": "India",
            "research_status": "completed",
            "research": {
                "digital_transformation": "Full digitization",
                "ai_adoption": "AI diagnostics",
                "technology_initiatives": ["Cloud", "EHR"],
            },
        }
        result = self.qualifier.qualify(org, target_icp="large hospital groups")
        assert result.score >= 70
        assert result.tier in ("High", "Medium")
        assert len(result.factors) == 7
        assert len(result.positive_signals) > 0

    def test_low_fit_small_clinic(self):
        org = {
            "name": "Small Clinic",
            "organization_type": "Clinic",
            "description": "",
            "city": "",
            "country": "",
        }
        result = self.qualifier.qualify(org)
        assert result.score < 60
        assert result.tier == "Low"

    def test_factors_sum_to_100_weight(self):
        org = {"name": "Test", "organization_type": "Hospital"}
        result = self.qualifier.qualify(org)
        total_weight = sum(f.weight for f in result.factors)
        assert total_weight == 100

    def test_score_capped_at_100(self):
        org = {
            "name": "Perfect Match",
            "organization_type": "Hospital Group",
            "description": "Large multi-location network with digital transformation and AI",
            "city": "Mumbai",
            "country": "India",
            "research_status": "completed",
            "research": {
                "digital_transformation": "Yes",
                "ai_adoption": "Yes",
                "technology_initiatives": ["Cloud", "EHR", "Telemedicine"],
            },
        }
        result = self.qualifier.qualify(org, target_icp="hospital group digital transformation")
        assert result.score <= 100

    def test_missing_info_detected(self):
        org = {"name": "Unknown Org"}
        result = self.qualifier.qualify(org)
        assert len(result.missing_information) > 0


# ─────────────────────────────────────────────────────────────
# DEDUPLICATION
# ─────────────────────────────────────────────────────────────

class TestDeduplication:
    def test_name_similarity(self):
        from app.services.discovery.deduplication import _name_similarity
        assert _name_similarity("Apollo Hospitals", "apollo hospitals") == 1.0
        assert _name_similarity("Apollo Hospitals Ltd", "Apollo Hospitals") > 0.5
        assert _name_similarity("Fortis Healthcare", "Apollo Hospitals") < 0.3

    def test_normalize_name(self):
        from app.services.discovery.deduplication import _normalize_name
        assert _normalize_name("Apollo Hospitals Ltd.") == "apollo hospitals"
        assert _normalize_name("FORTIS HEALTHCARE INC.") == "fortis healthcare"

    def test_extract_domain(self):
        from app.services.discovery.deduplication import _extract_domain
        assert _extract_domain("https://www.apollohospitals.com/path") == "apollohospitals.com"
        assert _extract_domain("http://example.com") == "example.com"
        assert _extract_domain("") == ""

    def test_batch_dedup(self):
        from app.services.discovery.deduplication import DeduplicationEngine
        leads = [
            {"name": "Apollo Hospitals", "website": "https://apollohospitals.com"},
            {"name": "apollo hospitals", "website": "https://www.apollohospitals.com"},
            {"name": "Fortis Healthcare", "website": "https://fortis.com"},
        ]
        engine = DeduplicationEngine.__new__(DeduplicationEngine)
        unique = engine._dedup_within_batch(leads)
        assert len(unique) == 2


# ─────────────────────────────────────────────────────────────
# DECISION-MAKER DISCOVERY
# ─────────────────────────────────────────────────────────────

class TestDecisionMaker:
    def test_dm_score(self):
        from app.services.discovery.decision_maker import _calc_dm_score
        assert _calc_dm_score("Chief Technology Officer") >= 90
        assert _calc_dm_score("CEO") >= 95
        assert _calc_dm_score("Head of Partnerships") >= 85
        assert _calc_dm_score("Analyst") < 60


# ─────────────────────────────────────────────────────────────
# BRIEF GENERATOR
# ─────────────────────────────────────────────────────────────

class TestBriefGenerator:
    def test_generate_brief(self):
        from app.services.discovery.brief_generator import generate_research_brief
        from unittest.mock import MagicMock
        disc_org = MagicMock()
        disc_org.name = "Test Hospital"
        disc_org.organization_type = "Hospital"
        disc_org.city = "Mumbai"
        disc_org.country = "India"
        disc_org.potential_fit_score = 85
        disc_org.description = "Leading hospital"
        disc_org.discovery_objective = "technology partnership"
        disc_org.website = "https://test.com"

        research = {
            "what_they_do": "Leading healthcare provider",
            "signals": [
                {"type": "digital_transformation", "description": "Digital transformation initiative"},
                {"type": "ai_adoption", "description": "AI diagnostics"},
            ],
            "sources": [{"url": "https://test.com"}],
            "technology_initiatives": ["Cloud"],
        }

        brief = generate_research_brief(disc_org, research)
        assert brief["organization_name"] == "Test Hospital"
        assert brief["fit_score"] == 85
        assert brief["priority"] == "HIGH"
        assert len(brief["technology_signals"]) > 0
        assert len(brief["sources"]) > 0


# ─────────────────────────────────────────────────────────────
# PROJECT MATCHER
# ─────────────────────────────────────────────────────────────

class TestProjectMatcher:
    def test_build_research_text(self):
        from app.services.discovery.project_matcher import _build_research_text
        research = {
            "what_they_do": "Hospital network",
            "digital_transformation": "Full digitization",
            "ai_adoption": "AI diagnostics",
            "technology_initiatives": ["Cloud migration"],
        }
        text = _build_research_text(research)
        assert "hospital" in text
        assert "ai" in text
        assert "cloud" in text


# ─────────────────────────────────────────────────────────────
# RESEARCH SCHEMAS
# ─────────────────────────────────────────────────────────────

class TestResearchSchemas:
    def test_qualification_result(self):
        from app.services.research.research_schemas import QualificationResult, QualificationFactor
        result = QualificationResult(
            score=85,
            tier="High",
            confidence=0.9,
            factors=[QualificationFactor(factor="test", weight=20, score=18, reason="test reason")],
            positive_signals=["signal 1"],
            negative_signals=[],
            missing_information=[],
        )
        assert result.score == 85
        assert result.tier == "High"
        assert len(result.factors) == 1

    def test_research_brief(self):
        from app.services.research.research_schemas import ResearchBrief
        brief = ResearchBrief(
            organization_name="Test",
            fit_score=80,
            priority="HIGH",
        )
        assert brief.organization_name == "Test"

    def test_project_match(self):
        from app.services.research.research_schemas import ProjectMatch
        match = ProjectMatch(
            project_name="Test Project",
            project_id=1,
            relevance_score=85,
            match_reason="test",
            category="Healthcare",
        )
        assert match.relevance_score == 85


# ─────────────────────────────────────────────────────────────
# ANALYTICS
# ─────────────────────────────────────────────────────────────

class TestDiscoveryAnalytics:
    def test_get_analytics(self):
        from app.services.discovery.analytics import get_discovery_analytics
        from unittest.mock import MagicMock
        db = MagicMock()
        db.query.return_value.filter.return_value.count.return_value = 0
        db.query.return_value.filter.return_value.all.return_value = []
        db.query.return_value.filter.return_value.scalar.return_value = 0
        db.query.return_value.group_by.return_value.all.return_value = []

        result = get_discovery_analytics(db)
        assert "leads_discovered" in result
        assert "source_performance" in result
        assert "conversion_rate" in result
