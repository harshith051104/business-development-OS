"""
Company-domain email pattern learning.

One confirmed corporate address reveals that domain's address format;
later candidates at the same domain are generated from the learned
pattern instead of a blind default. A learned pattern improves odds —
it never proves a mailbox exists, so candidates stay status 'guess'.

Confirmed sources: addresses observed publicly (website/search 'found')
or externally verified — never pattern guesses themselves.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.models.discovery import EmailPattern

NON_ALPHA = re.compile(r"[^a-z0-9]")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# More specific templates first — first match wins in both directions.
PATTERN_TEMPLATES = (
    "first.last",
    "first_last",
    "firstlast",
    "flast",
    "firstl",
    "f.last",
    "last.first",
    "first",
    "last",
)

# Never learn from placeholder domains.
PLACEHOLDER_DOMAINS = {"example.com", "example.org", "example.net", "test.local", "test.com", "test.org"}


def normalize_domain(value: str) -> str:
    """Extract a bare domain from a URL, email, or raw domain string."""
    if not value:
        return ""
    v = value.strip().lower()
    if "@" in v:  # email
        v = v.rsplit("@", 1)[1]
    v = v.replace("https://", "").replace("http://", "")
    return v.split("/")[0].replace("www.", "").strip(".")


def name_parts(full_name: str) -> Tuple[str, str]:
    """Lowercased alphanumeric (first, last) from a person's name."""
    cleaned = re.sub(r"\b(dr|mr|mrs|ms|prof)\.?\b", " ", (full_name or "").lower())
    parts = [NON_ALPHA.sub("", p) for p in cleaned.split()]
    parts = [p for p in parts if p]
    if not parts:
        return "", ""
    return parts[0], (parts[-1] if len(parts) > 1 else "")


def _render(pattern: str, first: str, last: str) -> Optional[str]:
    if pattern == "first.last":
        return f"{first}.{last}" if last else None
    if pattern == "first_last":
        return f"{first}_{last}" if last else None
    if pattern == "firstlast":
        return f"{first}{last}" if last else None
    if pattern == "flast":
        return f"{first[0]}{last}" if first and last else None
    if pattern == "firstl":
        return f"{first}{last[0]}" if first and last else None
    if pattern == "f.last":
        return f"{first[0]}.{last}" if first and last else None
    if pattern == "last.first":
        return f"{last}.{first}" if last else None
    if pattern == "first":
        return first or None
    if pattern == "last":
        return last or None
    return None


def apply_pattern(pattern: str, full_name: str, domain: str) -> Optional[str]:
    """Render an email from a pattern template. None when a required part is missing."""
    domain = normalize_domain(domain)
    first, last = name_parts(full_name)
    if not domain:
        return None
    local = _render(pattern, first, last)
    if not local:
        return None
    return f"{local}@{domain}"


def infer_pattern(email: str, full_name: str) -> Optional[str]:
    """Which template produced this address's local part? None if no template fits."""
    if not email or "@" not in email:
        return None
    local = email.split("@", 1)[0].lower()
    first, last = name_parts(full_name)
    if not first:
        return None
    for template in PATTERN_TEMPLATES:
        rendered = _render(template, first, last)
        if rendered and rendered == local:
            return template
    return None


def learn_pattern(
    db: Session,
    email: str,
    full_name: str,
    source_url: Optional[str] = None,
    learned_from: str = "observed_address",
    confidence: float = 0.9,
) -> Optional[EmailPattern]:
    """
    Record the domain pattern revealed by a confirmed address.
    Returns the stored row, or None when the address is unusable for learning
    (bad format, placeholder domain, or local part no template explains).
    """
    if not email or not EMAIL_RE.match(email.strip()):
        return None
    domain = normalize_domain(email)
    if not domain or "." not in domain or domain in PLACEHOLDER_DOMAINS:
        return None

    pattern = infer_pattern(email.strip(), full_name)
    if not pattern:
        return None

    now = datetime.now(timezone.utc)
    row = db.query(EmailPattern).filter(EmailPattern.domain == domain).first()
    if row:
        row.pattern = pattern
        row.sample_email = email.strip().lower()
        row.learned_from = learned_from
        row.source_url = source_url or row.source_url
        row.confidence = confidence
        row.observed_at = now
    else:
        row = EmailPattern(
            domain=domain,
            pattern=pattern,
            sample_email=email.strip().lower(),
            learned_from=learned_from,
            source_url=source_url,
            confidence=confidence,
            observed_at=now,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_pattern(db: Session, domain_or_url: str) -> Optional[str]:
    """Learned pattern template for a domain, or None (blind default)."""
    domain = normalize_domain(domain_or_url)
    if not domain:
        return None
    row = db.query(EmailPattern).filter(EmailPattern.domain == domain).first()
    return row.pattern if row else None
