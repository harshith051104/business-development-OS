from app.routers.auth import router as auth_router
from app.routers.business_development import router as bd_router
from app.routers.organizations import router as organizations_router
from app.routers.contacts import router as contacts_router
from app.routers.showcase import router as showcase_router
from app.routers.meetings import router as meetings_router
from app.routers.followups import router as followups_router
from app.routers.opportunities import router as opportunities_router
from app.routers.connections import router as connections_router
from app.routers.communications import router as communications_router
from app.routers.analytics import router as analytics_router
from app.routers.audit import router as audit_router
from app.routers.discovery import router as discovery_router
from app.routers.outreach import router as outreach_router
from app.routers.partnerships import router as partnerships_router
from app.routers.admin import router as admin_router

__all__ = [
    "auth_router",
    "bd_router",
    "organizations_router",
    "contacts_router",
    "showcase_router",
    "meetings_router",
    "followups_router",
    "opportunities_router",
    "connections_router",
    "communications_router",
    "analytics_router",
    "audit_router",
    "discovery_router",
    "outreach_router",
    "partnerships_router",
    "admin_router",
]
