import json
from typing import Optional, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import Request
from app.models.audit import AuditLog
from app.models.user import User


def log_audit_event(
    db: Session,
    action: str,
    resource_type: str,
    resource_id: Optional[int] = None,
    user: Optional[User] = None,
    user_email: Optional[str] = None,
    request: Optional[Request] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> AuditLog:
    """
    Records a structured security audit log entry.
    Never records sensitive tokens, passwords, or secrets.
    """
    ip_addr = None
    if request:
        client = getattr(request, "client", None)
        ip_addr = client.host if client else None

    # Sanitize metadata (remove password/token keys if any accidentally passed)
    safe_metadata = None
    if metadata:
        clean_dict = {
            k: v for k, v in metadata.items()
            if not any(secret_term in k.lower() for secret_term in ("password", "token", "secret", "key", "auth"))
        }
        try:
            safe_metadata = json.dumps(clean_dict)
        except Exception:
            safe_metadata = str(clean_dict)

    entry = AuditLog(
        user_id=user.id if user else None,
        user_email=user.email if user else (user_email or "anonymous"),
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_addr,
        metadata_json=safe_metadata,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(entry)
    try:
        db.commit()
        db.refresh(entry)
    except Exception:
        db.rollback()

    return entry
