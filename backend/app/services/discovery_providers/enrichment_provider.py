from typing import Dict, Any, Optional
import re
from app.services.discovery_providers.base import BaseEmailEnrichmentProvider

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Four-state email vocabulary (delivery-confidence model):
#   verified - mailbox independently confirmed deliverable
#   risky    - catch-all / deliverability uncertain-positive
#   guess    - pattern-derived candidate, NOT confirmed
#   invalid  - no usable domain or format; nothing can be generated
EMAIL_VERIFIED = "verified"
EMAIL_RISKY = "risky"
EMAIL_GUESS = "guess"
EMAIL_INVALID = "invalid"

# Domains that are placeholders, never real companies.
PLACEHOLDER_DOMAINS = {"example.com", "example.org", "example.net",
                       "test.local", "test.com", "test.org"}

DEFAULT_PATTERN = "first.last"


class StandardEmailEnrichmentProvider(BaseEmailEnrichmentProvider):
    """
    Business email enrichment via organization-domain pattern.

    Generates a FORMAT-VALID candidate address only — it never verifies
    deliverability and never fabricates phone numbers or social profiles.
    A candidate is always status 'guess' until an external source confirms it.
    """

    @property
    def provider_name(self) -> str:
        return "Standard Enterprise Email Enrichment"

    def enrich_contact(
        self,
        full_name: str,
        organization_name: str,
        website: Optional[str] = None,
        job_title: Optional[str] = None,
        email_pattern: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Derives a candidate corporate email from the organization domain and
        contact name. email_pattern: a learned pattern template (e.g. 'flast')
        from app.services.discovery.email_patterns — improves odds but never
        upgrades the result above status 'guess'.
        """
        from app.services.discovery.email_patterns import apply_pattern, normalize_domain

        def _no_candidate(status: str, pattern: Optional[str], source: Optional[str], confidence: float) -> Dict[str, Any]:
            return {
                "email": None,
                "email_status": status,
                "phone": None,          # fabricated contact data is never returned
                "linkedin_url": None,
                "verified": False,
                "pattern": pattern,
                "pattern_source": source,
                "confidence": confidence,
            }

        domain = normalize_domain(website or "")
        if not domain or "." not in domain or domain in PLACEHOLDER_DOMAINS:
            return _no_candidate(EMAIL_INVALID, None, None, 0.0)

        parts = [p.strip().lower() for p in full_name.replace("Dr.", "").replace("Dr ", "").split() if p.strip()]
        first_name = parts[0] if parts else ""
        last_name = parts[-1] if len(parts) > 1 else ""
        clean_name = f"{first_name} {last_name}".strip()
        if not clean_name:
            return _no_candidate(EMAIL_INVALID, None, None, 0.0)

        # Candidate generation: learned pattern first, then safe fallbacks.
        candidate = None
        pattern_used = None
        for pattern in (email_pattern, DEFAULT_PATTERN, "first"):
            if not pattern:
                continue
            candidate = apply_pattern(pattern, clean_name, domain)
            if candidate:
                pattern_used = pattern
                break

        if not candidate:
            return _no_candidate(EMAIL_INVALID, None, None, 0.0)

        # Clean non-alphanumeric chars in local part
        local_part, domain_part = candidate.split("@", 1)
        clean_local = re.sub(r"[^a-z0-9._-]", "", local_part)
        final_email = f"{clean_local}@{domain_part}"

        if not EMAIL_REGEX.match(final_email):
            return _no_candidate(EMAIL_INVALID, pattern_used, None, 0.0)

        return {
            "email": final_email,
            # Deliverability is unknown — a guess stays a guess.
            "email_status": EMAIL_GUESS,
            "phone": None,
            "linkedin_url": None,
            "verified": False,
            "pattern": pattern_used,
            "pattern_source": "learned" if email_pattern else "default",
            "confidence": 0.7 if email_pattern else 0.4,
        }
