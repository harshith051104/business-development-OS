from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[int] = None
    ip_address: Optional[str] = None
    metadata_json: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class PaginatedAuditLogsOut(BaseModel):
    items: List[AuditLogOut]
    total: int
    page: int
    page_size: int
    total_pages: int
