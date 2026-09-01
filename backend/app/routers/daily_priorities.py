from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.core.database import get_db
from app.auth.deps import get_current_user
from app.models.user import User
from app.schemas.daily_priorities import DailyPrioritiesResponse
from app.services.daily_priorities import compute_daily_priorities, compute_next_best_action

router = APIRouter(prefix="/api/business-development/daily-priorities", tags=["Daily Priorities"])


@router.get("", response_model=DailyPrioritiesResponse)
def get_daily_priorities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve dynamic, real-time daily operational BD priorities across all pipeline stages."""
    return compute_daily_priorities(db, current_user)


@router.get("/next-best-action")
def get_next_best_action(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Evaluates commercial signals across the funnel and returns the single highest-leverage next best action.
    """
    return compute_next_best_action(db, current_user)
