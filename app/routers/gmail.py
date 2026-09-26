from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from starlette.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User
from app.models.campaign import GmailAccount
from app.schemas.campaign import GmailAccountOut
from app.services.gmail_service import GmailService
from app.core.audit import log_audit_event

router = APIRouter(
    prefix="/api/gmail",
    tags=["Gmail Integration"],
)


@router.get("/auth")
def start_gmail_auth(
    current_user: User = Depends(require_business_development),
):
    auth_url, state = GmailService.get_auth_url(current_user.id)
    return {"authorization_url": auth_url, "state": state}


@router.get("/auth/callback")
def gmail_callback(
    code: str = Query(...),
    state: str = Query(None),
    db: Session = Depends(get_db),
):
    try:
        account = GmailService.handle_callback(code, state, db)
        return RedirectResponse(url="http://localhost:5173/business-development/campaigns?gmail=connected", status_code=302)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to connect Gmail: {e}")


@router.get("/accounts", response_model=List[GmailAccountOut])
def list_gmail_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    accounts = db.query(GmailAccount).filter(GmailAccount.user_id == current_user.id).all()
    return accounts


@router.post("/sync-replies")
def sync_gmail_replies(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """
    Polls connected Gmail accounts to detect prospect replies across active campaigns.
    Automatically pauses sequence and generates follow-up tasks upon reply detection.
    """
    result = GmailService.sync_inbox_replies(db=db, user_id=current_user.id)
    return {
        "success": True,
        "synced_active_threads": result.get("synced_active_threads", 0),
        "replies_detected": result.get("replies_detected", 0),
        "detected": result.get("detected", []),
    }


@router.get("/track/open/{campaign_contact_id}")
def track_email_open(
    campaign_contact_id: int,
    db: Session = Depends(get_db),
):
    """
    Lightweight, privacy-conscious 1x1 transparent GIF tracking pixel.
    Updates open_count and opened_at without affecting decision-critical logic.
    """
    from datetime import datetime, timezone
    from starlette.responses import Response
    from app.models.campaign import CampaignContact

    cc = db.query(CampaignContact).filter(CampaignContact.id == campaign_contact_id).first()
    if cc:
        if not cc.opened_at:
            cc.opened_at = datetime.now(timezone.utc)
        cc.open_count = (cc.open_count or 0) + 1
        db.commit()

    # 1x1 transparent GIF binary
    gif_bytes = b'GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'
    return Response(content=gif_bytes, media_type="image/gif")


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_gmail_account(
    account_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    account = db.query(GmailAccount).filter(GmailAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Gmail account not found")
    if account.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your Gmail account")
    
    email = account.email
    db.delete(account)
    db.commit()
    
    log_audit_event(
        db=db,
        action="gmail_disconnect",
        resource_type="gmail_account",
        resource_id=None,
        user=current_user,
        metadata={"email": email},
    )
    return None
