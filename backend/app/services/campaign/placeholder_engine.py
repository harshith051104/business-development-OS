import re
from typing import Dict, Any, List, Tuple


class PlaceholderEngine:
    """
    Template Placeholder Engine with strict unresolved token detection.
    Supports standard CRM attributes, ELLY Showcase attributes, and AI generative fields.
    Supports both {{placeholder}} and {placeholder} syntax.
    """

    PLACEHOLDER_REGEX = re.compile(r"\{\{([a-zA-Z0-9_]+)\}\}|\{([a-zA-Z0-9_]+)\}")

    @classmethod
    def extract_placeholders(cls, template_str: str) -> List[str]:
        if not template_str:
            return []
        matches = cls.PLACEHOLDER_REGEX.findall(template_str)
        found = []
        for double_match, single_match in matches:
            token = double_match or single_match
            if token and token not in found:
                found.append(token)
        return found

    @classmethod
    def resolve(cls, template_str: str, values: Dict[str, Any]) -> str:
        if not template_str:
            return ""

        def _replace_match(match: re.Match) -> str:
            token = match.group(1) or match.group(2)
            if token in values and values[token] is not None:
                val = str(values[token])
                return val
            # Return original match if not resolved
            return match.group(0)

        return cls.PLACEHOLDER_REGEX.sub(_replace_match, template_str)

    @classmethod
    def get_unresolved(cls, rendered_str: str) -> List[str]:
        """Detect any remaining unresolved placeholder tags in the rendered string."""
        return cls.extract_placeholders(rendered_str)

    @classmethod
    def validate_no_unresolved(cls, rendered_str: str) -> Tuple[bool, List[str]]:
        """Returns (is_valid, list_of_unresolved_tokens)."""
        unresolved = cls.get_unresolved(rendered_str)
        return (len(unresolved) == 0, unresolved)
