from typing import Dict, Any
from app.services.campaign.placeholder_engine import PlaceholderEngine


class PersonalizationScorer:
    """
    Evaluates generated outreach on a 0 to 100 personalization quality scale.
    """

    @classmethod
    def score(cls, subject: str, body: str, context: Dict[str, Any]) -> float:
        combined = f"{subject} {body}".lower()
        score = 40.0  # Base baseline

        # Check for unresolved tags — severe penalty
        unresolved = PlaceholderEngine.get_unresolved(subject + " " + body)
        if unresolved:
            return max(0.0, score - 50.0)

        # 1. Organization Mention (+15 pts)
        org_name = (context.get("organization_name") or "").lower()
        if org_name and org_name in combined:
            score += 15.0

        # 2. Contact Name & Role Mention (+15 pts)
        first_name = (context.get("first_name") or "").lower()
        contact_role = (context.get("contact_role") or "").lower()
        if first_name and first_name in combined:
            score += 10.0
        if contact_role and contact_role in combined:
            score += 5.0

        # 3. Industry / Location Specificity (+10 pts)
        industry = (context.get("industry") or "").lower()
        city = (context.get("city") or "").lower()
        if industry and industry in combined:
            score += 5.0
        if city and city in combined:
            score += 5.0

        # 4. ELLY Showcase Project / Solution Relevance (+10 pts)
        project_name = (context.get("project_name") or "").lower()
        if project_name and (project_name in combined or "elly" in combined):
            score += 10.0

        # 5. Clear Call to Action (+10 pts)
        cta_keywords = ["minute", "conversation", "schedule", "call", "discuss", "explore", "time", "tuesday", "thursday", "next week"]
        if any(kw in combined for kw in cta_keywords):
            score += 10.0

        return min(100.0, round(score, 1))
