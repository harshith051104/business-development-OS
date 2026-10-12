from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.auth.deps import require_business_development
from app.models.user import User
from app.models.copilot import CopilotConversation, CopilotMessage
from app.schemas.copilot import (
    CopilotChatRequest,
    CopilotChatResponse,
    CopilotConfirmRequest,
    CopilotConfirmResponse,
    CopilotConversationOut,
    CopilotMessageOut,
    CopilotSuggestion,
)
from app.services.copilot.engine import CopilotEngine
from app.services import signal_service

router = APIRouter(prefix="/api/business-development/copilot", tags=["Copilot"])


@router.post("/chat", response_model=CopilotChatResponse)
def copilot_chat(
    payload: CopilotChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development)
):
    """
    Primary conversational endpoint for the ELLY Universal BD Copilot.
    Understands intent, resolves page context, executes tools across all 15 modules,
    and returns rich responses with data references and confirmation actions.
    """
    return CopilotEngine.process_chat(db, current_user, payload)


@router.post("/confirm", response_model=CopilotConfirmResponse)
def copilot_confirm_action(
    payload: CopilotConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development)
):
    """
    Executes or cancels a pending write action (e.g. stage move, create meeting, create followup)
    that previously required user confirmation.
    """
    return CopilotEngine.execute_confirmed_action(db, current_user, payload)


@router.get("/conversations", response_model=List[CopilotConversationOut])
def get_conversations(
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development)
):
    """
    Lists active conversation threads for the current user.
    """
    threads = db.query(CopilotConversation).filter(
        CopilotConversation.user_id == current_user.id
    ).order_by(desc(CopilotConversation.updated_at)).limit(limit).all()

    results = []
    for t in threads:
        results.append(CopilotConversationOut(
            id=t.id,
            title=t.title,
            created_at=t.created_at,
            updated_at=t.updated_at,
            message_count=len(t.messages)
        ))
    return results


@router.get("/conversations/{conversation_id}", response_model=List[CopilotMessageOut])
def get_conversation_messages(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development)
):
    """
    Retrieves complete chronological message history for a specific conversation.
    """
    conv = db.query(CopilotConversation).filter(
        CopilotConversation.id == conversation_id,
        CopilotConversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    return conv.messages


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development)
):
    """
    Deletes a conversation and its messages.
    """
    conv = db.query(CopilotConversation).filter(
        CopilotConversation.id == conversation_id,
        CopilotConversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted successfully."}


@router.get("/suggestions", response_model=List[CopilotSuggestion])
def get_copilot_suggestions(
    current_page: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development)
):
    """
    Provides contextual prompt suggestions based on current route or workload.
    """
    top_signals = signal_service.list_active(db, limit=1)
    suggestions = [
        CopilotSuggestion(category="Priorities", prompt="What needs my attention today?", description="Check overdue tasks, today's meetings, and stale deals"),
        CopilotSuggestion(category="Briefing", prompt="Tell me everything about this organization", description="360° dossier combining contacts, deals, comms, and meetings"),
        CopilotSuggestion(category="Meetings", prompt="What meetings do I have tomorrow?", description="Upcoming agendas and pre-meeting briefing preparation"),
        CopilotSuggestion(category="Pipeline", prompt="Which organizations are in Discussion stage?", description="Inspect opportunities and stage velocity"),
        CopilotSuggestion(category="Contacts", prompt="Who are the decision makers at high-priority organizations?", description="Executive leadership and contact discovery"),
        CopilotSuggestion(category="Showcase", prompt="What projects should I showcase?", description="View platform solutions and capability pitches"),
    ]

    if current_page and "/organizations/" in current_page:
        suggestions.insert(0, CopilotSuggestion(category="Active Context", prompt="Tell me everything about them", description="Complete 360° summary of the organization currently open"))
        suggestions.insert(1, CopilotSuggestion(category="Active Context", prompt="Who are their key decision makers?", description="Find CTO, CIO, and Director contacts for this organization"))

    elif current_page and "/meetings" in current_page:
        suggestions.insert(0, CopilotSuggestion(category="Active Context", prompt="Prepare me for my next meeting", description="Talking points, project showcase match, and past notes"))

    if top_signals:
        sig = top_signals[0]
        suggestions.insert(0, CopilotSuggestion(category="Signal", prompt="What's the top buying signal right now?", description=sig.description))

    return suggestions[:6]
