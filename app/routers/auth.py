from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.core.audit import log_audit_event
from app.models.user import User
from app.schemas.auth import (
    UserLogin,
    UserOut,
    TokenResponse,
    LogoutResponse,
)
from app.auth.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, request: Request, db: Session = Depends(get_db)):
    """Authenticate user credentials and issue a signed JWT access token."""
    email_clean = credentials.email.lower().strip()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        log_audit_event(
            db=db,
            action="LOGIN_FAILED",
            resource_type="User",
            user_email=email_clean,
            request=request,
            metadata={"reason": "invalid_credentials"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        log_audit_event(
            db=db,
            action="LOGIN_FAILED",
            resource_type="User",
            user=user,
            request=request,
            metadata={"reason": "account_deactivated"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated. Please contact an administrator.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_data = {
        "sub": user.email,
        "user_id": user.id,
        "role": user.role,
        "name": user.name,
    }
    access_token = create_access_token(data=token_data)

    log_audit_event(
        db=db,
        action="LOGIN_SUCCESS",
        resource_type="User",
        resource_id=user.id,
        user=user,
        request=request,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Retrieve details of the currently authenticated user."""
    return UserOut.model_validate(current_user)


@router.post("/logout", response_model=LogoutResponse)
def logout():
    """Client logout confirmation."""
    return LogoutResponse(
        status="success",
        message="Successfully logged out.",
    )
