import json
import logging
from typing import Dict, Any, Optional
from app.services.copilot.llm_router import LLMRouter
from app.core.config import settings

logger = logging.getLogger("elly.campaign.personalization")


class PersonalizationEngine:
    """
    AI Personalization Engine generating tailored value propositions, hooks, and CTAs
    using ELLY's multi-provider LLM router (Groq -> NVIDIA -> Gemini) with deterministic fallback.
    """

    def __init__(self):
        self.router = LLMRouter(api_keys={
            "groq": getattr(settings, "GROQ_API_KEY", ""),
            "nvidia": getattr(settings, "NVIDIA_NIM_API_KEY", ""),
            "gemini": getattr(settings, "GEMINI_API_KEY", ""),
        })

    def generate_personalization(
        self,
        context: Dict[str, Any],
        step_number: int = 1,
        channel: str = "Email",
    ) -> Dict[str, str]:
        """
        Generates:
        - opening_hook
        - relevant_problem
        - ai_value_prop
        - cta
        """
        org_name = context.get("organization_name", "your organization")
        contact_name = context.get("contact_name", "Leader")
        contact_role = context.get("contact_role", "Executive")
        industry = context.get("industry", "Enterprise")
        city = context.get("city", "")
        project_name = context.get("project_name", "ELLY Intelligence Platform")
        project_desc = context.get("project_description", "operational AI workflow solution")

        prompt = f"""
You are an expert Enterprise B2B Business Development Specialist for ELLY.
Generate tailored, high-converting outreach components for a B2B communication.

TARGET DETAILS:
- Organization: {org_name} ({industry} in {city or 'Global'})
- Decision Maker: {contact_name} ({contact_role})
- ELLY Showcase Asset: {project_name} - {project_desc}
- Sequence Step: Step {step_number} ({channel})

INSTRUCTIONS:
1. Ground all statements in the target's industry and executive role.
2. Do NOT hallucinate fake case studies or metrics not provided.
3. Keep tone concise, professional, and value-driven.
4. Output STRICT JSON with keys:
   - "opening_hook": 1 sentence acknowledging their role at {org_name}.
   - "relevant_problem": 1-2 sentences on challenges faced by {contact_role}s in {industry}.
   - "ai_value_prop": 2 sentences on how ELLY's {project_name} addresses these challenges.
   - "cta": A low-friction question or meeting proposal (e.g. 15-minute introductory discussion).

JSON:
"""
        try:
            messages = [
                {"role": "system", "content": "You are a professional B2B outreach copywriter. Respond ONLY with valid JSON."},
                {"role": "user", "content": prompt}
            ]
            response = self.router.chat(messages=messages, temperature=0.3)
            if response and response.content:
                text = response.content.strip()
                # Clean code blocks if present
                if text.startswith("```"):
                    text = text.split("```", 2)[1]
                    if text.startswith("json"):
                        text = text[4:]
                    text = text.strip()
                parsed = json.loads(text)
                def _to_s(key, default):
                    v = parsed.get(key)
                    if isinstance(v, list):
                        return "\n\n".join(str(x) for x in v if x)
                    return str(v).strip() if v else default

                return {
                    "opening_hook": _to_s("opening_hook", f"I've been following {org_name}'s recent work in the {industry} sector."),
                    "relevant_problem": _to_s("relevant_problem", f"Leading digital initiatives as {contact_role} requires balancing operational efficiency with seamless technology adoption."),
                    "ai_value_prop": _to_s("ai_value_prop", f"ELLY's {project_name} provides {project_desc}, purpose-built to accelerate outcomes for {industry} leaders."),
                    "cta": _to_s("cta", "Would you be open to a brief 15-minute conversation next week to explore how this fits into your roadmap?"),
                }
        except Exception as e:
            logger.warning(f"LLM personalization call failed ({e}), using deterministic fallback.")

        # Deterministic universal B2B fallback
        if step_number == 1:
            return {
                "opening_hook": f"I hope this note finds you well amidst your initiatives at {org_name}.",
                "relevant_problem": f"As {contact_role}, staying ahead in {industry} demands scalable technology solutions that deliver clear ROI without operational disruption.",
                "ai_value_prop": f"ELLY's {project_name} was developed to provide {project_desc}, helping organizations like {org_name} streamline mission-critical workflows.",
                "cta": "Would you have 15 minutes next Tuesday or Thursday for an introductory discussion?",
            }
        elif step_number == 2:
            return {
                "opening_hook": f"Following up on my previous note regarding {org_name}'s strategic roadmap.",
                "relevant_problem": f"We frequently see {industry} leaders seeking accelerated implementation timelines for enterprise AI adoption.",
                "ai_value_prop": f"Through {project_name}, our partners have experienced rapid integration with existing enterprise systems.",
                "cta": "Are you available for a brief discussion this week?",
            }
        else:
            return {
                "opening_hook": f"Touching base one last time regarding our collaboration with {org_name}.",
                "relevant_problem": f"We want to ensure you have full visibility into how modern {industry} platforms are optimizing efficiency.",
                "ai_value_prop": f"{project_name} remains available whenever your team evaluates next-generation platforms.",
                "cta": "Let me know if next quarter aligns better with your schedule.",
            }
