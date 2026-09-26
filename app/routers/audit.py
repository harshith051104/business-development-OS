import math
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.audit import PaginatedAuditLogsOut, AuditLogOut

router = APIRouter(
    prefix="/api/business-development/audit-logs",
    tags=["Audit & Compliance"],
    dependencies=[Depends(require_business_development)],
)


@router.get("", response_model=PaginatedAuditLogsOut)
def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action.strip()}%"))
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                AuditLog.action.ilike(term),
                AuditLog.user_email.ilike(term),
                AuditLog.resource_type.ilike(term),
                AuditLog.metadata_json.ilike(term),
            )
        )

    total = query.count()
    total_pages = max(1, math.ceil(total / page_size))
    items = (
        query.order_by(desc(AuditLog.timestamp))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedAuditLogsOut(
        items=[AuditLogOut.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
