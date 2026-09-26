from typing import Dict, Any, Optional, Tuple, List
from sqlalchemy.orm import Session
from app.services.campaign.placeholder_engine import PlaceholderEngine
from app.services.campaign.research_aggregator import ResearchAggregator
from app.services.campaign.personalization_engine import PersonalizationEngine
from app.services.campaign.scorer import PersonalizationScorer


class CampaignCompiler:
    """
    Full compilation pipeline:
    Context Aggregation -> AI Personalization -> Placeholder Resolution -> HTML Conversion -> Scoring -> Validation
    """

    @classmethod
    def compile_step_email(
        cls,
        db: Session,
        contact_id: int,
        subject_template: Optional[str] = None,
        body_template: Optional[str] = None,
        step_number: int = 1,
        channel: str = "Email",
        sender_user: Optional[Any] = None,
        cached_ai_values: Optional[Dict[str, Any]] = None,
        force_regenerate: bool = False,
    ) -> Dict[str, Any]:
        # 1. Default fallback templates if none provided
        if not subject_template:
            if step_number == 1:
                subject_template = "Collaboration with {{organization_name}} & ELLY"
            elif step_number == 2:
                subject_template = "Quick follow-up regarding {{organization_name}}"
            else:
                subject_template = "Touching base: {{organization_name}}"

        if not body_template:
            body_template = """Hi {{first_name}},

{{opening_hook}}

{{relevant_problem}}

{{ai_value_prop}}

{{cta}}

Best regards,
{{sender_name}}
{{sender_email}}"""

        # 2. Collect Context
        context = ResearchAggregator.collect_context(db, contact_id, sender_user=sender_user)

        # 3. Extract needed placeholders
        raw_text = f"{subject_template or ''} {body_template or ''}"
        needed_placeholders = PlaceholderEngine.extract_placeholders(raw_text)

        # 4. AI Personalization fields
        ai_fields = {}
        ai_keys = {"ai_value_prop", "opening_hook", "relevant_problem", "cta"}
        needs_ai = any(k in needed_placeholders for k in ai_keys)

        if needs_ai:
            if cached_ai_values and not force_regenerate and all(k in cached_ai_values for k in ai_keys if k in needed_placeholders):
                ai_fields = cached_ai_values
            else:
                engine = PersonalizationEngine()
                ai_fields = engine.generate_personalization(context, step_number=step_number, channel=channel)

        # Merge context + AI fields
        full_values = {**context, **ai_fields}

        # 5. Resolve placeholders
        rendered_subject = PlaceholderEngine.resolve(subject_template, full_values)
        rendered_body_plain = PlaceholderEngine.resolve(body_template, full_values)

        # Convert plaintext to clean responsive email HTML
        rendered_body_html = cls._convert_plain_to_html(rendered_body_plain)

        # 6. Validate zero unresolved placeholders
        is_valid_subj, unres_subj = PlaceholderEngine.validate_no_unresolved(rendered_subject)
        is_valid_body, unres_body = PlaceholderEngine.validate_no_unresolved(rendered_body_plain)
        all_unresolved = list(set(unres_subj + unres_body))
        is_valid = is_valid_subj and is_valid_body

        validation_errors = []
        if all_unresolved:
            validation_errors.append(f"Unresolved placeholders remaining: {', '.join(all_unresolved)}")

        # 7. Quality & Personalization Scoring (0-100)
        score = PersonalizationScorer.score(rendered_subject, rendered_body_plain, context)

        return {
            "contact_id": contact_id,
            "contact_name": context.get("contact_name", "Prospect"),
            "organization_name": context.get("organization_name", "Organization"),
            "step_number": step_number,
            "subject": rendered_subject,
            "body_plain": rendered_body_plain,
            "body_html": rendered_body_html,
            "personalization_score": score,
            "unresolved_placeholders": all_unresolved,
            "is_valid": is_valid,
            "validation_errors": validation_errors,
            "ai_generated_fields": ai_fields,
            "showcase_project_used": context.get("project_name"),
        }

    @classmethod
    def _convert_plain_to_html(cls, text: str) -> str:
        paragraphs = text.strip().split("\n\n")
        html_paras = []
        for p in paragraphs:
            lines = p.strip().split("\n")
            line_brs = "<br>".join(lines)
            html_paras.append(f"<p style='margin: 0 0 16px 0; line-height: 1.6; color: #222;'>{line_brs}</p>")
        
        body_content = "\n".join(html_paras)
        return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; background-color: #ffffff; margin: 0; padding: 16px;">
    {body_content}
</body>
</html>"""
