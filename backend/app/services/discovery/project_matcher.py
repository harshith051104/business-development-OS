"""
Project matcher — matches organization research signals to ELLY Showcase projects.
"""
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.project import Project, ProjectStatus
from app.services.research.research_schemas import ProjectMatch

logger = logging.getLogger(__name__)


def match_projects(
    db: Session,
    research_data: Dict[str, Any],
    limit: int = 3,
) -> List[ProjectMatch]:
    """Match research signals to relevant ELLY Showcase projects."""
    projects = db.query(Project).filter(
        Project.is_deleted.is_(False),
        Project.status.in_([ProjectStatus.ACTIVE.value, ProjectStatus.PUBLISHED.value]),
    ).all()

    if not projects:
        return []

    # Build research context
    research_text = _build_research_text(research_data)

    scored = []
    for proj in projects:
        score = _score_project_match(proj, research_text, research_data)
        if score > 20:
            reason = _build_match_reason(proj, research_data)
            scored.append(ProjectMatch(
                project_name=proj.name,
                project_id=proj.id,
                relevance_score=score,
                match_reason=reason,
                category=proj.category or "",
            ))

    scored.sort(key=lambda x: x.relevance_score, reverse=True)
    return scored[:limit]


def _build_research_text(research_data: Dict[str, Any]) -> str:
    parts = []
    for field in ["what_they_do", "digital_transformation", "ai_adoption", "telemedicine", "automation"]:
        val = research_data.get(field)
        if val:
            parts.append(str(val))
    for init in research_data.get("technology_initiatives", [])[:3]:
        if isinstance(init, str):
            parts.append(init)
    for sig in research_data.get("signals", [])[:3]:
        if isinstance(sig, dict):
            parts.append(sig.get("description", ""))
    return " ".join(parts).lower()


def _score_project_match(project: Project, research_text: str, research_data: Dict) -> int:
    score = 0
    tags = [t.lower() for t in (project.tags or [])]
    features = [f.lower() for f in (project.key_features or [])]
    proj_text = f"{project.name} {project.short_description} {project.description or ''} {' '.join(tags)} {' '.join(features)}".lower()

    # Category match
    category = (project.category or "").lower()
    if "healthcare" in category and any(t in research_text for t in ["hospital", "healthcare", "medical", "clinical", "patient"]):
        score += 25
    if "saas" in category or "software" in category and any(t in research_text for t in ["saas", "software", "platform", "cloud"]):
        score += 22
    if "fintech" in category or "financial" in category and any(t in research_text for t in ["fintech", "financial", "banking", "payments"]):
        score += 22
    if "ai" in category and any(t in research_text for t in ["ai", "artificial intelligence", "machine learning", "intelligence"]):
        score += 20
    if "manufacturing" in category and any(t in research_text for t in ["manufacturing", "industrial", "production", "supply chain"]):
        score += 18
    if "automation" in category and any(t in research_text for t in ["automation", "automated", "workflow"]):
        score += 15
    if "data" in category and any(t in research_text for t in ["data", "analytics", "platform", "integration"]):
        score += 15

    # Keyword overlap
    research_words = set(research_text.split())
    proj_words = set(proj_text.split())
    stop_words = {"the", "a", "an", "is", "are", "was", "were", "and", "or", "of", "for", "in", "on", "to", "with", "by", "from", "at", "as", "this", "that", "it", "their", "they"}
    research_words -= stop_words
    proj_words -= stop_words
    if research_words and proj_words:
        overlap = len(research_words & proj_words) / max(len(research_words | proj_words), 1)
        score += int(overlap * 30)

    # Digital transformation signals boost
    if any(t in research_text for t in ["digital transformation", "modernization", "platform"]):
        if any(t in proj_text for t in ["platform", "intelligence", "digital"]):
            score += 15

    return min(score, 100)


def _build_match_reason(project: Project, research_data: Dict) -> str:
    org_name = research_data.get("official_name", "the organization")
    proj_name = project.name
    category = project.category or "technology"
    return f"{proj_name} ({category}) is potentially relevant to {org_name}'s identified needs."
