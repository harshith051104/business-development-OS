"""
Explainable ICP qualification engine — hybrid architecture.

Deterministic score (7 factors, weights sum to 100)
+ LLM reasoning
+ Source evidence
= Final qualification

The LLM never arbitrarily invents the final score.
Deterministic score is always available as fallback.
"""
from typing import Dict, Any, Optional, List
from app.services.research.research_schemas import QualificationResult, QualificationFactor


class ExplainableQualification:
    """Produces explainable fit scores with contributing factors."""

    # Factor weights (must sum to 100)
    WEIGHTS = {
        "enterprise_size": 15,
        "org_type_fit": 20,
        "digital_transformation": 20,
        "technology_leadership": 15,
        "icp_alignment": 15,
        "objective_alignment": 10,
        "location_relevance": 5,
    }

    def qualify(
        self,
        org: Dict[str, Any],
        product_description: str = "",
        target_icp: str = "",
        discovery_objective: str = "",
    ) -> QualificationResult:
        factors = []
        positive = []
        negative = []
        missing = []

        # 1. Enterprise size
        size_score, size_reason = self._score_enterprise_size(org)
        factors.append(QualificationFactor(
            factor="enterprise_size",
            weight=self.WEIGHTS["enterprise_size"],
            score=size_score,
            reason=size_reason,
        ))
        if size_score >= 12:
            positive.append(size_reason)
        elif size_score <= 5:
            missing.append("Organization scale information unavailable")

        # 2. Org type fit
        type_score, type_reason = self._score_org_type(org)
        factors.append(QualificationFactor(
            factor="org_type_fit",
            weight=self.WEIGHTS["org_type_fit"],
            score=type_score,
            reason=type_reason,
        ))
        if type_score >= 15:
            positive.append(type_reason)

        # 3. Digital transformation signals
        dt_score, dt_reason = self._score_digital_transformation(org)
        factors.append(QualificationFactor(
            factor="digital_transformation",
            weight=self.WEIGHTS["digital_transformation"],
            score=dt_score,
            reason=dt_reason,
        ))
        if dt_score >= 15:
            positive.append(dt_reason)
        elif dt_score <= 5:
            negative.append("No public digital transformation evidence")

        # 4. Technology leadership
        tl_score, tl_reason = self._score_technology_leadership(org)
        factors.append(QualificationFactor(
            factor="technology_leadership",
            weight=self.WEIGHTS["technology_leadership"],
            score=tl_score,
            reason=tl_reason,
        ))
        if tl_score >= 12:
            positive.append(tl_reason)

        # 5. ICP alignment
        icp_score, icp_reason = self._score_icp_alignment(org, target_icp)
        factors.append(QualificationFactor(
            factor="icp_alignment",
            weight=self.WEIGHTS["icp_alignment"],
            score=icp_score,
            reason=icp_reason,
        ))
        if icp_score >= 12:
            positive.append(icp_reason)

        # 6. Objective alignment
        obj_score, obj_reason = self._score_objective_alignment(org, discovery_objective, product_description)
        factors.append(QualificationFactor(
            factor="objective_alignment",
            weight=self.WEIGHTS["objective_alignment"],
            score=obj_score,
            reason=obj_reason,
        ))
        if obj_score >= 8:
            positive.append(obj_reason)

        # 7. Location relevance
        loc_score, loc_reason = self._score_location_relevance(org)
        factors.append(QualificationFactor(
            factor="location_relevance",
            weight=self.WEIGHTS["location_relevance"],
            score=loc_score,
            reason=loc_reason,
        ))

        total_score = sum(f.score for f in factors)
        total_score = max(0, min(100, total_score))

        if total_score >= 80:
            tier = "High"
        elif total_score >= 55:
            tier = "Medium"
        else:
            tier = "Low"

        confidence = 0.7
        if org.get("research_status") == "completed":
            confidence = 0.9
        if org.get("website"):
            confidence = min(confidence + 0.05, 0.95)

        return QualificationResult(
            score=total_score,
            tier=tier,
            confidence=confidence,
            factors=factors,
            positive_signals=positive[:5],
            negative_signals=negative[:3],
            missing_information=missing[:3],
        )

    def qualify_hybrid(
        self,
        org: Dict[str, Any],
        research: Optional[Dict[str, Any]] = None,
        signals: Any = None,
        sources: Any = None,
        product_description: str = "",
        target_icp: str = "",
        discovery_objective: str = "",
    ) -> Dict[str, Any]:
        """
        Run deterministic qualification, then enhance with LLM if available.

        Returns hybrid result with both deterministic and LLM scores.
        """
        # Step 1: Deterministic
        det_result = self.qualify(org, product_description, target_icp, discovery_objective)

        # Step 2: LLM qualification
        try:
            from app.services.discovery.llm_qualification import llm_qualify
            llm_result = llm_qualify(
                org=org,
                research=research,
                signals=signals,
                sources=sources,
                product_description=product_description,
                target_icp=target_icp,
                discovery_objective=discovery_objective,
                deterministic_score=det_result.score,
                deterministic_tier=det_result.tier,
                deterministic_confidence=det_result.confidence,
            )
            return {
                "deterministic_score": det_result.score,
                "deterministic_tier": det_result.tier,
                "deterministic_confidence": det_result.confidence,
                "deterministic_factors": [
                    {"factor": f.factor, "weight": f.weight, "score": f.score, "reason": f.reason}
                    for f in det_result.factors
                ],
                "positive_signals": det_result.positive_signals + llm_result.get("positive_signals", []),
                "negative_signals": det_result.negative_signals + llm_result.get("negative_signals", []),
                "missing_information": det_result.missing_information + llm_result.get("missing_information", []),
                "llm_score": llm_result.get("llm_score"),
                "llm_confidence": llm_result.get("llm_confidence"),
                "final_score": llm_result.get("final_score", det_result.score),
                "final_tier": llm_result.get("final_tier", det_result.tier),
                "confidence": llm_result.get("confidence", det_result.confidence),
                "recommended_contact_roles": llm_result.get("recommended_contact_roles", []),
                "recommended_ellly_capabilities": llm_result.get("recommended_ellly_capabilities", []),
                "reasons": llm_result.get("reasons", []),
                "source": llm_result.get("source", "deterministic"),
                "error": llm_result.get("error"),
            }
        except Exception as e:
            return {
                "deterministic_score": det_result.score,
                "deterministic_tier": det_result.tier,
                "deterministic_confidence": det_result.confidence,
                "deterministic_factors": [
                    {"factor": f.factor, "weight": f.weight, "score": f.score, "reason": f.reason}
                    for f in det_result.factors
                ],
                "positive_signals": det_result.positive_signals,
                "negative_signals": det_result.negative_signals,
                "missing_information": det_result.missing_information,
                "llm_score": None,
                "llm_confidence": None,
                "final_score": det_result.score,
                "final_tier": det_result.tier,
                "confidence": det_result.confidence,
                "recommended_contact_roles": [],
                "recommended_ellly_capabilities": [],
                "reasons": [],
                "source": "deterministic",
                "error": f"LLM unavailable: {str(e)}",
            }

    def _score_enterprise_size(self, org: Dict[str, Any]) -> tuple:
        desc = (org.get("description", "") + " " + org.get("approximate_scale", "")).lower()
        research = org.get("research", {})
        scale = research.get("approximate_scale", "") if isinstance(research, dict) else ""
        combined = f"{desc} {scale}".lower()

        if any(t in combined for t in ["multi-location", "multi-site", "network", "group", "chain", "1000+", "5000+"]):
            return 15, "Large multi-location organization"
        if any(t in combined for t in ["enterprise", "500+", "200+", "headquarters"]):
            return 12, "Substantial organization"
        if any(t in combined for t in ["200", "mid-size", "growing"]):
            return 8, "Mid-size organization"
        return 5, "Organization size not publicly available"

    def _score_org_type(self, org: Dict[str, Any]) -> tuple:
        org_type = org.get("organization_type", "").lower()
        if org_type in ["technology company", "saas", "software", "ai company", "fintech", "financial services"]:
            return 18, f"Technology-focused {org_type or 'organization'} — strong platform fit"
        if org_type in ["hospital group", "hospital", "healthcare technology", "health tech", "healthcare"]:
            return 15, f"Healthcare {org_type or 'organization'} — established market"
        if org_type in ["manufacturing", "industrial", "energy", "logistics"]:
            return 12, f"Enterprise {org_type or 'organization'} — digital transformation opportunity"
        if org_type in ["consulting", "professional services", "retail", "e-commerce"]:
            return 10, f"Service-oriented {org_type or 'organization'}"
        if org_type in ["startup", "scale-up"]:
            return 8, f"Fast-growing {org_type or 'organization'}"
        return 5, f"Organization type: {org_type or 'Unknown'}"

    def _score_digital_transformation(self, org: Dict[str, Any]) -> tuple:
        research = org.get("research", {})
        if not isinstance(research, dict):
            research = {}

        signals = []
        if research.get("digital_transformation"):
            signals.append("digital transformation")
        if research.get("ai_adoption"):
            signals.append("AI adoption")
        if research.get("cloud_adoption"):
            signals.append("cloud adoption")
        if research.get("automation"):
            signals.append("automation")

        tech_inits = research.get("technology_initiatives", [])
        if isinstance(tech_inits, list) and tech_inits:
            signals.extend(tech_inits[:2])

        desc = (org.get("description", "") + " " + org.get("name", "")).lower()
        for term in ["digital", "ai", "technology", "innovation", "smart", "platform"]:
            if term in desc and term not in " ".join(signals):
                signals.append(f"{term} (from description)")

        if len(signals) >= 3:
            return 20, f"Strong digital signals: {', '.join(signals[:3])}"
        if len(signals) >= 1:
            return 14, f"Digital signals detected: {', '.join(signals)}"
        return 3, "No public digital transformation evidence"

    def _score_technology_leadership(self, org: Dict[str, Any]) -> tuple:
        research = org.get("research", {})
        if not isinstance(research, dict):
            research = {}

        has_leadership = bool(
            research.get("technology_initiatives") or
            research.get("ai_adoption") or
            research.get("digital_transformation")
        )
        if has_leadership:
            return 15, "Technology leadership and initiatives identified"
        desc = org.get("description", "").lower()
        if any(t in desc for t in ["technology", "innovation", "digital", "platform"]):
            return 10, "Technology focus indicated in public profile"
        return 4, "Technology leadership not publicly documented"

    def _score_icp_alignment(self, org: Dict[str, Any], target_icp: str) -> tuple:
        if not target_icp:
            return 8, "No ICP provided — baseline score"
        icp_lower = target_icp.lower()
        combined = f"{org.get('name', '')} {org.get('organization_type', '')} {org.get('description', '')}".lower()
        icp_words = [w for w in icp_lower.split() if len(w) > 3]
        matches = [w for w in icp_words if w in combined]
        if len(matches) >= 3:
            return 15, f"Strong ICP alignment: {', '.join(matches[:3])}"
        if len(matches) >= 1:
            return 10, f"Partial ICP match: {', '.join(matches[:2])}"
        return 4, "Limited alignment with target ICP"

    def _score_objective_alignment(self, org: Dict[str, Any], objective: str, product_desc: str) -> tuple:
        combined = f"{objective} {product_desc}".lower()
        org_text = f"{org.get('name', '')} {org.get('description', '')}".lower()
        if any(t in combined for t in ["partner", "alliance", "collaboration"]):
            if any(t in org_text for t in ["network", "enterprise", "group", "partnership"]):
                return 10, "Strong partnership alignment"
            return 7, "Partnership objective matches organization profile"
        if any(t in combined for t in ["technology", "platform", "integration"]):
            return 8, "Technology partnership objective aligned"
        return 5, "Objective alignment moderate"

    def _score_location_relevance(self, org: Dict[str, Any]) -> tuple:
        city = org.get("city", "")
        country = org.get("country", "")
        if city and country:
            return 5, f"Located in {city}, {country}"
        if country:
            return 4, f"Located in {country}"
        return 2, "Location not specified"
