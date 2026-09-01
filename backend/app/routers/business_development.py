from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import AccessResponse, UserOut
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard import dashboard_service

router = APIRouter(prefix="/api/business-development", tags=["Business Development"])


@router.get("/access", response_model=AccessResponse)
def check_bd_access(current_user: User = Depends(require_business_development)):
    """Protected endpoint strictly accessible by users with the BUSINESS_DEVELOPMENT role.
    
    Returns 401 for unauthenticated requests.
    Returns 403 for authenticated users without BUSINESS_DEVELOPMENT role.
    Returns 200 for authenticated BUSINESS_DEVELOPMENT users.
    """
    return AccessResponse(
        status="authorized",
        message="Access granted to Business Development Portal.",
        phase="Phase 2 — Business Development Dashboard",
        user=UserOut.model_validate(current_user),
    )


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard_data(
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Retrieve the main dashboard metrics, today's activities, and recent activity feed.
    
    Strictly protected for BUSINESS_DEVELOPMENT role.
    """
    return dashboard_service.get_dashboard(db, current_user)
