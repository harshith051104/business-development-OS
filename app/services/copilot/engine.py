"""
engine.py - ELLY Copilot Engine (Phase 18: AI Agent Copilot)

Two-tier routing:
  Tier 1: Regex fast-path for simple intents (0 tokens, instant)
  Tier 2: LLM function-calling agent for complex/multi-step requests

All write actions still require user confirmation via ConfirmationAction.
"""
import uuid
import re
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.user import User, UserRole
from app.models.organization import Organization, ConnectionStatus, PriorityLevel
from app.models.contact import Contact
from app.models.opportunity import Opportunity, OpportunityStage, OpportunityPriority
from app.models.meeting import Meeting, MeetingStatus, MeetingType
from app.models.followup import FollowUp, FollowUpStatus, FollowUpPriority
from app.models.communication import Communication, CommunicationChannel, CommunicationDirection, CommunicationStatus
from app.models.partnership import Partnership, PartnershipStatus, PartnershipType
from app.models.outreach import OutreachDraft, DraftStatus, OutreachChannel
from app.models.copilot import CopilotConversation, CopilotMessage, CopilotConfirmationAction
from app.core.audit import log_audit_event
from app.core.config import settings

CURRENCY_SYMBOLS = {
    "INR": "₹", "USD": "$", "EUR": "€", "GBP": "£", "JPY": "¥",
    "AUD": "A$", "CAD": "C$", "SGD": "S$", "AED": "د.إ", "SAR": "﷼",
    "ZAR": "R", "BRL": "R$", "MXN": "$", "KRW": "₩", "CNY": "¥",
}


def _fmt_currency(value: float, currency: str = "INR") -> str:
    symbol = CURRENCY_SYMBOLS.get(currency, currency + " ")
    return f"{symbol}{value:,.2f}"
from app.schemas.copilot import (
    CopilotChatRequest,
    CopilotChatResponse,
    CopilotConfirmRequest,
    CopilotConfirmResponse,
    ConfirmationAction,
    DataReference,
    ToolExecutionRecord,
)
from app.services.copilot import tools
from app.services.copilot.intent_router import route as intent_route, RoutingMethod
from app.services.copilot.agent_tools import AGENT_TOOL_SCHEMAS, execute_tool
from app.services.copilot.llm_router import LLMRouter, AllProvidersExhausted

logger = logging.getLogger(__name__)

# -- Persistent confirmation helpers (replaces in-memory PENDING_CONFIRMATIONS) --

def _save_confirmation(db: Session, action_id: str, action_type: str, payload: dict, user_id: int, summary: str = None) -> CopilotConfirmationAction:
    """Save a confirmation action to the database."""
    conf = CopilotConfirmationAction(
        id=action_id,
        action_type=action_type,
        payload=payload,
        summary=summary,
        user_id=user_id,
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        status="PENDING",
    )
    db.add(conf)
    db.commit()
    return conf


def _get_confirmation(db: Session, action_id: str, user_id: int) -> CopilotConfirmationAction | None:
    """Fetch a pending, non-expired confirmation belonging to the user."""
    now = datetime.now(timezone.utc)
    return db.query(CopilotConfirmationAction).filter(
        CopilotConfirmationAction.id == action_id,
        CopilotConfirmationAction.user_id == user_id,
        CopilotConfirmationAction.status == "PENDING",
        CopilotConfirmationAction.expires_at > now,
    ).first()


def _delete_confirmation(db: Session, action_id: str):
    """Remove a confirmation after execution or cancellation."""
    db.query(CopilotConfirmationAction).filter(
        CopilotConfirmationAction.id == action_id,
    ).delete()
    db.commit()

PENDING_CONFIRMATIONS: Dict[str, Dict[str, Any]] = {}  # DEPRECATED: kept for backward compat only

SYSTEM_PROMPT = (
    "You are ELLY, an AI Business Development Copilot for the ELLY "
    "Technology Intelligence Platform.\n\n"
    "Your role: help BD executives manage organization relationships, "
    "track opportunities, prepare for meetings, and drive partnership pipelines.\n\n"
    "You have access to CRM tools. Use them proactively when the user asks "
    "something that requires data. You may call multiple tools sequentially "
    "to fulfill complex requests.\n\n"
    "Rules:\n"
    "- NEVER send emails or messages autonomously. You can draft content but "
    "must require human confirmation before any write action.\n"
    "- NEVER access clinical or patient data. Only business development "
    "data (organizations, contacts, opportunities, meetings, etc.)\n"
    "- When the user refers to them, this org, their, it - check if "
    "there is context about a specific organization and use it.\n"
    "- For multi-step requests, call tools in logical order and synthesize "
    "the results.\n"
    "- Format responses in clean markdown with headers, bullet points, and "
    "bold text.\n"
    "- Always suggest relevant follow-up actions at the end.\n"
    "- If you need to perform a write action (create meeting, move stage, "
    "etc.), prepare the details and request confirmation - do NOT execute "
    "directly.\n"
    "- When the user asks to find organizations NOT in the CRM, or wants "
    "to explore the market / search the web, use the discover_web tool.\n"
    "- When the user wants researched/qualified leads (not just raw search), "
    "use discover_qualified. It searches, deduplicates, researches websites, "
    "and produces explainable fit scores.\n"
    "- When the user asks to research a specific organization, use "
    "research_organization with the discovered_org_id.\n"
    "- When the user asks 'why should we contact' or 'prepare a brief', "
    "use get_research_brief.\n"
    "- When the user asks 'who should we contact' at a discovered org, "
    "use discover_decision_makers.\n"
    "- For discovery analytics ('which source is best'), use "
    "get_discovery_analytics.\n"
    "- ELLY works across ALL industries: healthcare, SaaS, fintech, "
    "manufacturing, AI, retail, logistics, energy, telecom, etc. "
    "Never assume healthcare unless the user specifies it."
)


def _get_llm_router() -> LLMRouter:
    return LLMRouter(api_keys={
        "groq": settings.GROQ_API_KEY,
        "nvidia": settings.NVIDIA_NIM_API_KEY,
        "gemini": settings.GEMINI_API_KEY,
    })


class CopilotEngine:

    @classmethod
    def process_chat(
        cls,
        db: Session,
        user: User,
        request: CopilotChatRequest
    ) -> CopilotChatResponse:
        conversation_id = request.conversation_id or f"conv-{uuid.uuid4().hex[:12]}"
        conversation = db.query(CopilotConversation).filter(
            CopilotConversation.id == conversation_id
        ).first()
        if not conversation:
            title = request.message[:40] + ("..." if len(request.message) > 40 else "")
            conversation = CopilotConversation(
                id=conversation_id,
                user_id=user.id,
                title=title
            )
            db.add(conversation)
            db.commit()

        user_msg = CopilotMessage(
            conversation_id=conversation_id,
            sender="user",
            content=request.message
        )
        db.add(user_msg)
        db.commit()

        # Clinical guardrail
        if cls._is_clinical_data_request(request.message):
            reply = (
                "Business Development Boundary Notice\n\n"
                "Sensitive operational data (clinical records, patient data, "
                "financial records, personal identifiable information) is "
                "outside the scope of the ELLY Business Development Portal.\n\n"
                "I can help you explore organizations, executive contacts, "
                "partnership pipelines, or showcase projects."
            )
            return cls._save_and_return_response(
                db, conversation_id, reply, intent="clinical_refusal"
            )

        # Autonomous send refusal
        if cls._is_autonomous_send_request(request.message):
            reply = (
                "Manual Outreach Policy\n\n"
                "ELLY enforces strict manual human outreach by design. I cannot automatically "
                "send emails, WhatsApp messages, or LinkedIn messages autonomously.\n\n"
                "However, I can prepare a personalized outreach draft for your review. You can "
                "find, customize, and manually send it from your Outreach Workspace."
            )
            return cls._save_and_return_response(
                db, conversation_id, reply, intent="outreach_refusal"
            )

        # Context resolution (pronoun binding)
        resolved_message = cls._resolve_pronouns_with_context(
            db, request.message, request.context
        )

        # Write action fast-path (must precede LLM routing)
        write_result = cls._check_write_actions(
            db, user, resolved_message, request.context, conversation_id
        )
        if write_result:
            reply, intent, tools_exec, data_refs, pending_conf, followups = write_result
            return cls._save_and_return_response(
                db, conversation_id, reply,
                intent=intent, tools_executed=tools_exec,
                data_references=data_refs, pending_confirmation=pending_conf,
                suggested_followups=followups
            )

        # Tier 1: Regex fast-path
        route_result = intent_route(resolved_message)
        if route_result.method == RoutingMethod.REGEX and route_result.tool_name:
            # Handle write actions detected by intent_router
            if route_result.tool_name in ("_write_move_stage", "_write_log_call"):
                write_result = cls._check_write_actions(
                    db, user, resolved_message, request.context, conversation_id
                )
                if write_result:
                    reply, intent, tools_exec, data_refs, pending_conf, followups = write_result
                    return cls._save_and_return_response(
                        db, conversation_id, reply,
                        intent=intent, tools_executed=tools_exec,
                        data_references=data_refs, pending_confirmation=pending_conf,
                        suggested_followups=followups
                    )

            try:
                args = route_result.pre_resolved_args or {}
                # Map intent_router tool names to actual TOOL_REGISTRY keys
                tool_name_map = {
                    "get_organization_360_briefing": "get_organization_360",
                    "get_meeting_preparation": "get_meeting_preparation",
                    "discover_organizations": "discover_web",
                }
                registry_name = tool_name_map.get(route_result.tool_name, route_result.tool_name)

                # Call tools directly (not via execute_tool) to get raw results for formatting
                from app.services.copilot.agent_tools import TOOL_REGISTRY
                import inspect
                func = TOOL_REGISTRY.get(registry_name)
                if func:
                    sig = inspect.signature(func)
                    call_args = dict(args)
                    # Map arg names to match function signatures
                    if "organization_name" in call_args and "keyword" in sig.parameters:
                        call_args["keyword"] = call_args.pop("organization_name")
                    if "organization_name" in call_args and "org_identifier" in sig.parameters:
                        call_args["org_identifier"] = call_args.pop("organization_name")
                    if "stage" in call_args and "stage_name" in sig.parameters:
                        call_args["stage_name"] = call_args.pop("stage")
                    if "user" in sig.parameters and user is not None:
                        call_args["user"] = user
                    raw_result = func(db, **call_args)
                else:
                    raw_result = execute_tool(db, route_result.tool_name, args, user)

                reply, intent, tools_exec, data_refs, followups = (
                    cls._format_regex_result(route_result.tool_name, args, raw_result, db, user)
                )
                return cls._save_and_return_response(
                    db, conversation_id, reply,
                    intent=intent, tools_executed=tools_exec,
                    data_references=data_refs, suggested_followups=followups
                )
            except Exception as e:
                logger.warning("Regex tool failed, falling back to LLM: %s", e)

        # Tier 2: LLM agent
        return cls._run_llm_agent(
            db, user, conversation_id, resolved_message, request.context
        )

    # ─────────────────────────────────────────────────────────────
    # GUARDRAIL CLASSIFIERS
    # ─────────────────────────────────────────────────────────────

    @classmethod
    def _is_clinical_data_request(cls, text: str) -> bool:
        t = text.lower()
        clinical_patterns = [
            r"\b(patient|patients)\b.*\b(data|record|records|history|chart|charts|vitals|ehr|emr|fhir|dicom)\b",
            r"\bshow\b.*\b(patient|patients)\b",
            r"\bclinical\b.*\b(data|records|analytics|monitoring|diagnosis|trial)\b",
            r"\bmedical\b.*\b(record|records|history|chart|prescription|diagnosis)\b",
            r"\bdiagnose\b",
        ]
        return any(re.search(pat, t) for pat in clinical_patterns)

    @classmethod
    def _is_autonomous_send_request(cls, text: str) -> bool:
        t = text.lower()
        patterns = [
            r"\b(send|dispatch|blast)\b.*\b(email|emails|mail|message|messages|whatsapp|linkedin)\b.*\b(auto|automatically|autonomous|now|all)\b",
            r"\bauto(matically)?\b.*\b(send|email|message)\b",
            r"^send (this )?(email|message|note) now$",
        ]
        return any(re.search(pat, t) for pat in patterns)

    # ─────────────────────────────────────────────────────────────
    # CONTEXT RESOLUTION
    # ─────────────────────────────────────────────────────────────

    @classmethod
    def _resolve_pronouns_with_context(cls, db, message, context):
        if not context or not context.active_entity_id:
            return message

        msg = message
        if context.active_entity_type == "organization" or (
            context.current_page and "/organizations/" in context.current_page
        ):
            org = tools.resolve_organization(db, context.active_entity_id)
            if org:
                msg = re.sub(
                    r"\b(them|this organization|this org|their)\b",
                    org.name, msg, flags=re.IGNORECASE
                )
                if re.search(
                    r"^(tell me about|who is|briefing|summary|status of|what happened with|prepare for)\s+(it|them|this)\b",
                    msg, re.IGNORECASE
                ):
                    msg = f"tell me everything about {org.name}"

        elif context.active_entity_type == "meeting" or (
            context.current_page and "/meetings/" in context.current_page
        ):
            msg = re.sub(
                r"\b(this meeting|this call|for it|for this)\b",
                f"meeting {context.active_entity_id}",
                msg, flags=re.IGNORECASE
            )

        elif context.active_entity_type == "opportunity" or (
            context.current_page and "/opportunities/" in context.current_page
        ):
            msg = re.sub(
                r"\b(this opportunity|this deal|for this)\b",
                f"opportunity {context.active_entity_id}",
                msg, flags=re.IGNORECASE
            )

        return msg

    # ─────────────────────────────────────────────────────────────
    # WRITE ACTION HANDLERS (Regex fast-path, require confirmation)
    # ─────────────────────────────────────────────────────────────

    @classmethod
    def _check_write_actions(cls, db, user, message, context, conversation_id):
        t = message.lower()

        # A: Move connection stage
        stage_move_match = re.search(
            r"\b(move|change stage|update stage|advance|set stage|update status)\b"
            r".*\bto\s+([A-Za-z]+)\b",
            message, re.IGNORECASE
        )
        if stage_move_match:
            raw_stage = stage_move_match.group(2).strip().lower()
            matched_stage = next(
                (s.value for s in ConnectionStatus
                 if s.value.lower() == raw_stage or s.name.lower() == raw_stage),
                None
            )
            if matched_stage:
                orgs = db.query(Organization).filter(Organization.is_deleted == False).all()
                target_org = next((o for o in orgs if o.name.lower() in t), None)
                if not target_org and context and context.active_entity_id:
                    target_org = tools.resolve_organization(db, context.active_entity_id)
                if not target_org and orgs:
                    target_org = orgs[0]
                if target_org:
                    action_id = f"act-{uuid.uuid4().hex[:8]}"
                    payload = {
                        "organization_id": target_org.id,
                        "target_stage": matched_stage,
                        "reason": f"Updated via ELLY Copilot command by {user.name}"
                    }
                    pending_conf = ConfirmationAction(
                        action_id=action_id,
                        action_type="move_connection_stage",
                        title=f"Move {target_org.name} to {matched_stage}",
                        description=f"Advance organization from current stage `{target_org.status}` to `{matched_stage}`.",
                        target_entity_type="organization",
                        target_entity_id=target_org.id,
                        payload=payload,
                        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
                    )
                    _save_confirmation(db, action_id, "move_connection_stage", payload, user.id)
                    tools_exec = [ToolExecutionRecord(tool_name="prepare_move_connection_stage", status="requires_confirmation")]
                    return (
                        f"I have prepared the stage transition for **{target_org.name}**.\n\n"
                        f"Please confirm to advance this organization to **{matched_stage}**.",
                        "confirm_stage_move", tools_exec, [], pending_conf, ["Confirm action", "Cancel"]
                    )

        # B: Create Meeting
        if any(p in t for p in ["schedule meeting", "create meeting", "book a call", "set up a meeting"]):
            orgs = db.query(Organization).filter(Organization.is_deleted == False).all()
            target_org = next((o for o in orgs if o.name.lower() in t), None)
            action_id = f"act-{uuid.uuid4().hex[:8]}"
            scheduled_time = datetime.now(timezone.utc) + timedelta(days=2, hours=10)
            payload = {
                "organization_id": target_org.id if target_org else None,
                "title": f"Strategic Platform Discussion with {target_org.name if target_org else 'Partner'}",
                "scheduled_at": scheduled_time.isoformat(),
                "meeting_type": "Virtual",
                "agenda": "Platform capabilities presentation and partnership scope."
            }
            pending_conf = ConfirmationAction(
                action_id=action_id,
                action_type="create_meeting",
                title=f"Schedule Meeting: {payload['title']}",
                description=f"Book a virtual meeting for {scheduled_time.strftime('%A, %b %d at %I:%M %p')}.",
                target_entity_type="organization" if target_org else None,
                target_entity_id=target_org.id if target_org else None,
                payload=payload,
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
            )
            _save_confirmation(db, action_id, "create_meeting", payload, user.id)
            tools_exec = [ToolExecutionRecord(tool_name="prepare_create_meeting", status="requires_confirmation")]
            return (
                f"I have prepared the meeting details for **{payload['title']}**.\n\n"
                f"Please review and confirm to create this meeting on your BD calendar.",
                "confirm_create_meeting", tools_exec, [], pending_conf, ["Confirm action", "Cancel"]
            )

        # C: Create Follow-up
        if any(p in t for p in ["create follow-up", "create followup", "add follow-up", "schedule follow-up", "set a reminder"]):
            orgs = db.query(Organization).filter(Organization.is_deleted == False).all()
            target_org = next((o for o in orgs if o.name.lower() in t), None)
            action_id = f"act-{uuid.uuid4().hex[:8]}"
            due_date = datetime.now(timezone.utc) + timedelta(days=3)
            payload = {
                "organization_id": target_org.id if target_org else None,
                "title": f"Follow up with {target_org.name if target_org else 'Lead'}",
                "due_date": due_date.isoformat(),
                "priority": "HIGH" if (target_org and target_org.priority == "High") else "MEDIUM",
                "description": "Check in regarding strategic partnership proposal."
            }
            pending_conf = ConfirmationAction(
                action_id=action_id,
                action_type="create_followup",
                title=f"Create Follow-up: {payload['title']}",
                description=f"Set reminder due on {due_date.strftime('%b %d, %Y')} (Priority: {payload['priority']}).",
                target_entity_type="organization" if target_org else None,
                target_entity_id=target_org.id if target_org else None,
                payload=payload,
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
            )
            _save_confirmation(db, action_id, "create_followup", payload, user.id)
            tools_exec = [ToolExecutionRecord(tool_name="prepare_create_followup", status="requires_confirmation")]
            return (
                f"I have prepared the follow-up task for **{payload['title']}**.\n\n"
                f"Please confirm to add this reminder to your task list.",
                "confirm_create_followup", tools_exec, [], pending_conf, ["Confirm action", "Cancel"]
            )

        # D: Log Call
        if any(p in t for p in ["log a call", "log call", "record call", "log my call"]):
            orgs = db.query(Organization).filter(Organization.is_deleted == False).all()
            target_org = next((o for o in orgs if o.name.lower() in t), None)
            if not target_org and context and context.active_entity_id:
                target_org = tools.resolve_organization(db, context.active_entity_id)
            if not target_org and orgs:
                target_org = orgs[0]
            action_id = f"act-{uuid.uuid4().hex[:8]}"
            payload = {
                "organization_id": target_org.id if target_org else 1,
                "notes": f"Product capabilities discussion and next steps review with {target_org.name if target_org else 'Partner'}.",
                "outcome": "Interested",
                "duration_minutes": 15,
                "next_action": "Schedule platform demonstration"
            }
            pending_conf = ConfirmationAction(
                action_id=action_id,
                action_type="log_call",
                title=f"Log Phone Call: {target_org.name if target_org else 'Organization'}",
                description=f"Record call outcome 'Interested' and attach notes to the communication timeline.",
                target_entity_type="organization" if target_org else None,
                target_entity_id=target_org.id if target_org else None,
                payload=payload,
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
            )
            _save_confirmation(db, action_id, "log_call", payload, user.id)
            tools_exec = [ToolExecutionRecord(tool_name="prepare_log_call", status="requires_confirmation")]
            return (
                f"I have prepared the call record for **{target_org.name if target_org else 'Organization'}**.\n\n"
                f"Please confirm to add this call to the communication timeline.",
                "confirm_log_call", tools_exec, [], pending_conf, ["Confirm action", "Cancel"]
            )

        # E: Create Proposal
        if any(p in t for p in ["create a proposal", "create proposal", "prepare proposal", "draft proposal"]):
            orgs = db.query(Organization).filter(Organization.is_deleted == False).all()
            target_org = next((o for o in orgs if o.name.lower() in t), None)
            if not target_org and context and context.active_entity_id:
                target_org = tools.resolve_organization(db, context.active_entity_id)
            if not target_org and orgs:
                target_org = orgs[0]
            action_id = f"act-{uuid.uuid4().hex[:8]}"
            payload = {
                "organization_id": target_org.id if target_org else 1,
                "title": f"ELLY Enterprise Proposal - {target_org.name if target_org else 'Partner'}",
                "value": 500000.0,
                "version": "v1.0",
                "content_summary": "Full deployment of ELLY Technology Intelligence & Platform solutions."
            }
            pending_conf = ConfirmationAction(
                action_id=action_id,
                action_type="create_proposal",
                title=f"Create Proposal: {payload['title']}",
                description=f"Generate commercial proposal v1.0 valued at {_fmt_currency(payload['value'], payload.get('currency', 'INR'))}.",
                target_entity_type="organization" if target_org else None,
                target_entity_id=target_org.id if target_org else None,
                payload=payload,
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
            )
            _save_confirmation(db, action_id, "create_proposal", payload, user.id)
            tools_exec = [ToolExecutionRecord(tool_name="prepare_create_proposal", status="requires_confirmation")]
            return (
                f"I have prepared the proposal for **{target_org.name if target_org else 'Partner'}**.\n\n"
                f"Please confirm to generate this commercial proposal.",
                "confirm_create_proposal", tools_exec, [], pending_conf, ["Confirm action", "Cancel"]
            )

        # F: Convert to Customer
        if any(p in t for p in ["convert to customer", "make them a customer", "convert to a customer", "convert customer"]):
            orgs = db.query(Organization).filter(Organization.is_deleted == False).all()
            target_org = next((o for o in orgs if o.name.lower() in t), None)
            if not target_org and context and context.active_entity_id:
                target_org = tools.resolve_organization(db, context.active_entity_id)
            if not target_org and orgs:
                target_org = orgs[0]
            action_id = f"act-{uuid.uuid4().hex[:8]}"
            payload = {
                "organization_id": target_org.id if target_org else 1,
                "contract_value": 750000.0,
                "notes": f"Converted to active customer account via ELLY BD Copilot."
            }
            pending_conf = ConfirmationAction(
                action_id=action_id,
                action_type="convert_to_customer",
                title=f"Convert to Customer: {target_org.name if target_org else 'Organization'}",
                description=f"Activate commercial customer account and update pipeline stage to Customer.",
                target_entity_type="organization" if target_org else None,
                target_entity_id=target_org.id if target_org else None,
                payload=payload,
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
            )
            _save_confirmation(db, action_id, "convert_to_customer", payload, user.id)
            tools_exec = [ToolExecutionRecord(tool_name="prepare_convert_customer", status="requires_confirmation")]
            return (
                f"I have prepared customer account activation for **{target_org.name if target_org else 'Organization'}**.\n\n"
                f"Please confirm to convert this organization into an active customer.",
                "confirm_convert_customer", tools_exec, [], pending_conf, ["Confirm action", "Cancel"]
            )

        # G: Create Task
        if any(p in t for p in ["create a task", "create task", "add a task", "add task", "new task"]):
            action_id = f"act-{uuid.uuid4().hex[:8]}"
            due_date = datetime.now(timezone.utc) + timedelta(days=2)
            task_title = re.sub(
                r"^(create a task to|create a task|create task|add a task to|add a task|add task|new task)\s+",
                "", message, flags=re.IGNORECASE
            ).strip("?. ") or "Review commercial documentation"
            payload = {
                "title": task_title,
                "priority": "High",
                "due_date": due_date.isoformat(),
                "description": "Created via ELLY Copilot task assistant."
            }
            pending_conf = ConfirmationAction(
                action_id=action_id,
                action_type="create_task",
                title=f"Create BD Task: {payload['title']}",
                description=f"Add task due on {due_date.strftime('%b %d, %Y')} (Priority: High).",
                payload=payload,
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
            )
            _save_confirmation(db, action_id, "create_task", payload, user.id)
            tools_exec = [ToolExecutionRecord(tool_name="prepare_create_task", status="requires_confirmation")]
            return (
                f"I have prepared the task **{payload['title']}**.\n\n"
                f"Please confirm to add this to your BD task list.",
                "confirm_create_task", tools_exec, [], pending_conf, ["Confirm action", "Cancel"]
            )

        return None
    @classmethod
    def _format_regex_result(cls, tool_name, args, result, db, user):
        tools_exec = [ToolExecutionRecord(tool_name=tool_name, arguments=args, status="success")]
        data_refs: List[DataReference] = []
        followups_list: List[str] = []

        if tool_name == "get_dashboard_summary":
            dash = result
            attention = tools.get_attention_items(db, user)
            lines = [
                "### Business Development Executive Briefing\n",
                f"- **Active Pipeline Value**: {_fmt_currency(dash['total_pipeline_value'])} across **{dash['active_opportunities_count']}** open deals",
                f"- **Today's Meetings**: **{dash['today_meetings']}** scheduled",
                f"- **Overdue Follow-ups**: **{dash['overdue_followups']}** requiring urgent action",
                f"- **Active Partnerships**: **{dash['active_partnerships']}** strategic accounts",
            ]
            if attention:
                lines.append("\n#### Priority Items:")
                for idx, item in enumerate(attention, 1):
                    lines.append(f"{idx}. [{item['priority']}] **{item['title']}** - {item['description']}")
                    data_refs.append(DataReference(entity_type=item["entity_type"], entity_id=item["entity_id"], title=item["title"], subtitle=item["description"], url=item["url"]))
            else:
                lines.append("\n*All clear!*")
            followups_list = ["Give me a briefing for my next meeting", "Show all high-priority organizations"]
            return "\n".join(lines), "get_attention", tools_exec, data_refs, followups_list

        if tool_name == "get_attention_items":
            attention = result
            dash = tools.get_dashboard_summary(db, user)
            lines = [
                "### Priority Items Requiring Your Attention\n",
                f"- **Active Pipeline Value**: {_fmt_currency(dash['total_pipeline_value'])}",
                f"- **Overdue Follow-ups**: **{dash['overdue_followups']}**",
            ]
            if not attention:
                lines.append("\n*All clear!*")
            else:
                for idx, item in enumerate(attention, 1):
                    lines.append(f"{idx}. [{item['priority']}] **{item['title']}** - {item['description']}")
                    data_refs.append(DataReference(entity_type=item["entity_type"], entity_id=item["entity_id"], title=item["title"], subtitle=item["description"], url=item["url"]))
            followups_list = ["Give me a briefing", "Show high-priority organizations"]
            return "\n".join(lines), "get_attention", tools_exec, data_refs, followups_list

        if tool_name == "get_pipeline_summary":
            pipeline = result
            lines = ["### Connection Pipeline Summary by Stage:"]
            for st, data in pipeline.items():
                sample = f" (e.g. {', '.join(data['sample_organizations'][:3])})" if data["sample_organizations"] else ""
                cnt = data['count']
                org_suffix = 's' if cnt != 1 else ''
                lines.append(f"- **{st}**: **{cnt}** organization{org_suffix}{sample}")
            followups_list = ["Show Interested organizations", "What needs my attention?"]
            return "\n".join(lines), "get_pipeline_summary", tools_exec, [], followups_list
        if tool_name == "search_organizations":
            orgs = result
            if not orgs:
                return "No organizations found.", "search_organizations", tools_exec, [], ["Show all organizations"]
            lines = [f"### Found Matching Organizations ({len(orgs)}):"]
            for o in orgs:
                lines.append(f"- **{o['name']}** ({o['organization_type']} - {o['city'] or o['country']}) | Stage: `{o['status']}` | Priority: `{o['priority']}`")
                data_refs.append(DataReference(entity_type="organization", entity_id=o["id"], title=o["name"], subtitle=f"{o['organization_type']} - {o['status']}", url=f"/business-development/organizations/{o['id']}"))
            followups_list = ["Tell me everything about them", "Find decision makers"]
            return "\n".join(lines), "search_organizations", tools_exec, data_refs, followups_list

        if tool_name == "get_organization_360_briefing":
            briefing = result
            if not briefing:
                return "Organization not found.", "get_organization_360_briefing", tools_exec, [], ["Search organizations"]
            org_info = briefing["organization"]
            data_refs.append(DataReference(entity_type="organization", entity_id=org_info["id"], title=org_info["name"], subtitle=f"{org_info['type']} - {org_info['status']}", url=f"/business-development/organizations/{org_info['id']}"))
            lines = [
                f"### 360\u00b0 BD Briefing: {org_info['name']}\n",
                f"- **Type & Status**: {org_info['type']} | **Stage**: `{org_info['status']}` | **Priority**: `{org_info['priority']}`",
                f"- **Location**: {org_info['location'] or 'N/A'} | **Owner**: {org_info['owner']}",
                f"\n#### Key Decision Makers ({len(briefing['contacts'])}):"
            ]
            for c in briefing["contacts"][:4]:
                dm = " (Decision Maker)" if c["is_decision_maker"] else ""
                lines.append(f"- **{c['name']}** - {c['designation']}{dm}")
            lines.append(f"\n#### Active Deals ({len(briefing['opportunities'])}):")
            for op in briefing["opportunities"]:
                lines.append(f"- **{op['title']}**: {_fmt_currency(op['value'] or 0)} (`{op['stage']}`)")
            lines.append("\n#### Recommended Next Action:")
            lines.append(f"> **{briefing['recommended_next_action']}**")
            followups_list = [f"Find decision makers at {org_info['name']}", f"Schedule meeting with {org_info['name']}"]
            return "\n".join(lines), "get_organization_360_briefing", tools_exec, data_refs, followups_list
        if tool_name == "search_contacts":
            contacts = result
            if not contacts:
                return "No contacts found.", "search_contacts", tools_exec, [], ["Discover contacts via AI Discovery"]
            lines = [f"### Contacts & Decision Makers ({len(contacts)}):"]
            for c in contacts:
                dm = " (Decision Maker)" if c["is_decision_maker"] else ""
                lines.append(f"- **{c['name']}** - {c['designation']} at **{c['organization_name']}**{dm} (`{c['email'] or 'No email'}`)")
                data_refs.append(DataReference(entity_type="contact", entity_id=c["id"], title=c["name"], subtitle=f"{c['designation']} - {c['organization_name']}", url=f"/business-development/contacts/{c['id']}"))
            followups_list = ["Prepare outreach draft"]
            return "\n".join(lines), "search_contacts", tools_exec, data_refs, followups_list

        if tool_name == "find_decision_makers":
            contacts = result
            if not contacts:
                return "No decision makers found.", "find_decision_makers", tools_exec, [], ["Search organizations"]
            lines = [f"### Decision Makers ({len(contacts)}):"]
            for c in contacts:
                lines.append(f"- **{c['name']}** - {c['designation']} at **{c['organization_name']}** (`{c['email'] or 'No email'}`)")
                data_refs.append(DataReference(entity_type="contact", entity_id=c["id"], title=c["name"], subtitle=f"{c['designation']} - {c['organization_name']}", url=f"/business-development/contacts/{c['id']}"))
            followups_list = ["Prepare outreach draft"]
            return "\n".join(lines), "find_decision_makers", tools_exec, data_refs, followups_list

        if tool_name == "search_meetings":
            meetings = result
            if not meetings:
                return "No meetings found.", "search_meetings", tools_exec, [], ["Schedule a meeting"]
            lines = [f"### Meetings ({len(meetings)}):"]
            for m in meetings:
                lines.append(f"- **{m['title']}** with **{m['organization_name']}** at `{m['scheduled_at']}` ({m['meeting_type']})")
                data_refs.append(DataReference(entity_type="meeting", entity_id=m["id"], title=m["title"], subtitle=f"{m['organization_name']} - {m['status']}", url=f"/business-development/meetings/{m['id']}"))
            followups_list = ["Prepare me for my next meeting"]
            return "\n".join(lines), "search_meetings", tools_exec, data_refs, followups_list

        if tool_name == "get_organization_map_data":
            orgs = result
            if not orgs:
                return "No organizations with map coordinates found.", "get_organization_map_data", tools_exec, [], ["Show all organizations"]
            lines = [f"### Organizations on Map ({len(orgs)}):"]
            for o in orgs:
                loc = f"{o['city']}, {o['country']}" if o.get('city') else o.get('country', 'Unknown')
                lines.append(f"- **{o['name']}** ({o['organization_type']}) — {loc} [{o['priority']}]")
                data_refs.append(DataReference(entity_type="organization", entity_id=o["id"], title=o["name"], subtitle=f"{o['organization_type']} - {loc}", url=f"/business-development/organizations/{o['id']}"))
            followups_list = ["Show organizations near Bangalore", "Show me the map"]
            return "\n".join(lines), "get_organization_map_data", tools_exec, data_refs, followups_list

        if tool_name == "get_calendar_events":
            events = result
            if not events:
                return "No upcoming meetings in your calendar.", "get_calendar_events", tools_exec, [], ["Schedule a meeting"]
            lines = [f"### Upcoming Calendar Events ({len(events)}):"]
            for e in events:
                org = e.get('organization_name') or 'No org'
                lines.append(f"- **{e['title']}** with **{org}** at `{e['start']}` ({e['status']})")
                data_refs.append(DataReference(entity_type="meeting", entity_id=e["id"], title=e["title"], subtitle=f"{org} - {e['status']}", url=f"/business-development/meetings/{e['id']}"))
            followups_list = ["What meetings do I have tomorrow?", "Schedule a meeting"]
            return "\n".join(lines), "get_calendar_events", tools_exec, data_refs, followups_list

        if tool_name == "search_followups":
            fups = result
            if not fups:
                return "No follow-ups found.", "search_followups", tools_exec, [], ["What needs my attention?"]
            lines = [f"### Follow-up Tasks ({len(fups)}):"]
            for f in fups:
                tag = "OVERDUE" if f["is_overdue"] else f"Due: {f['due_date']}"
                lines.append(f"- **{f['title']}** for **{f['organization_name']}** - `{tag}` (Priority: `{f['priority']}`)")
                data_refs.append(DataReference(entity_type="followup", entity_id=f["id"], title=f["title"], subtitle=f"{f['organization_name']} - {tag}", url=f"/business-development/followups/{f['id']}"))
            followups_list = ["Create a new follow-up"]
            return "\n".join(lines), "search_followups", tools_exec, data_refs, followups_list

        if tool_name == "search_opportunities":
            opps = result
            if not opps:
                return "No opportunities found.", "search_opportunities", tools_exec, [], ["Show pipeline"]
            total = sum(o["value"] or 0 for o in opps)
            lines = [f"### Opportunities ({len(opps)} | Total: {_fmt_currency(total)}):"]
            for op in opps:
                lines.append(f"- **{op['title']}** ({op['organization_name']}) - {_fmt_currency(op['value'] or 0)} | Stage: `{op['stage']}`")
                data_refs.append(DataReference(entity_type="opportunity", entity_id=op["id"], title=op["title"], subtitle=f"{op['organization_name']} - {_fmt_currency(op['value'] or 0)}", url=f"/business-development/opportunities/{op['id']}"))
            followups_list = ["Show pipeline conversion rates"]
            return "\n".join(lines), "search_opportunities", tools_exec, data_refs, followups_list

        if tool_name == "search_partnerships":
            parts = result
            if not parts:
                return "No partnerships found.", "search_partnerships", tools_exec, [], ["Show opportunities"]
            lines = [f"### Partnerships ({len(parts)}):"]
            for p in parts:
                lines.append(f"- **{p['name']}** with **{p['organization_name']}** (`{p['partnership_type']}` | Status: `{p['status']}`)")
                data_refs.append(DataReference(entity_type="partnership", entity_id=p["id"], title=p["name"], subtitle=f"{p['organization_name']} - {p['status']}", url=f"/business-development/partnerships/{p['id']}"))
            followups_list = ["What needs my attention?"]
            return "\n".join(lines), "search_partnerships", tools_exec, data_refs, followups_list

        if tool_name == "search_projects":
            projects = result
            lines = [f"### Available Project Showcase Solutions ({len(projects)}):"]
            for p in projects:
                lines.append(f"- **{p['title']}** (`{p['category']}`): {p['short_description']}")
                data_refs.append(DataReference(entity_type="project", entity_id=p["id"], title=p["title"], subtitle=p["category"], url=f"/business-development/showcase/{p['id']}"))
            followups_list = ["Prepare an introduction"]
            return "\n".join(lines), "search_projects", tools_exec, data_refs, followups_list

        if tool_name == "search_meetings":
            meetings = result
            if not meetings:
                return "No meetings found.", "search_meetings", tools_exec, [], ["Schedule a meeting"]
            lines = [f"### Meetings ({len(meetings)}):"]
            for mt in meetings:
                lines.append(f"- **{mt['title']}** with **{mt['organization_name']}** at `{mt['scheduled_at']}` ({mt['meeting_type']})")
                data_refs.append(DataReference(entity_type="meeting", entity_id=mt["id"], title=mt["title"], subtitle=f"{mt['organization_name']} - {mt['status']}", url=f"/business-development/meetings/{mt['id']}"))
            followups_list = ["Prepare me for my next meeting"]
            return "\n".join(lines), "search_meetings", tools_exec, data_refs, followups_list

        if tool_name == "get_stage_organizations":
            orgs = result
            stage = args.get("stage", "Unknown")
            if not orgs:
                return f"No organizations found in stage **{stage}**.", "get_stage_organizations", tools_exec, [], ["Show pipeline summary"]
            lines = [f"### Organizations in Stage: `{stage}` ({len(orgs)}):"]
            for o in orgs:
                lines.append(f"- **{o['name']}** (Priority: `{o['priority']}` | Location: {o['location']})")
                data_refs.append(DataReference(entity_type="organization", entity_id=o["id"], title=o["name"], subtitle=f"Stage: {stage} - Priority: {o['priority']}", url=f"/business-development/organizations/{o['id']}"))
            followups_list = ["Show pipeline conversion", "What needs my attention?"]
            return "\n".join(lines), "get_stage_organizations", tools_exec, data_refs, followups_list

        if tool_name == "get_meeting_preparation":
            briefing = result
            if not briefing:
                return "No meeting preparation data available.", "meeting_preparation", tools_exec, [], ["Show meetings"]
            m_info = briefing["meeting"]
            org_info = briefing["target_organization"]
            c_info = briefing["primary_contact"]
            if org_info["id"]:
                data_refs.append(DataReference(entity_type="organization", entity_id=org_info["id"], title=org_info["name"], subtitle=f"Stage: {org_info['status']}", url=f"/business-development/organizations/{org_info['id']}"))
            lines = [
                f"### Pre-Meeting Briefing Dossier\n",
                f"**{m_info['title']}**",
                f"- **Scheduled For**: {m_info['scheduled_at']} ({m_info['meeting_type']})",
                f"- **Target Organization**: **{org_info['name']}** ({org_info['type']} - Priority: `{org_info['priority']}`)",
                f"- **Key Participant**: **{c_info['name']}** ({c_info['designation']})\n",
                f"#### Recommended Showcase Projects:"
            ]
            for pr in briefing["recommended_showcase_projects"]:
                lines.append(f"- **{pr['name']}** ({pr['category']}): {pr['pitch']}")
            lines.append(f"\n#### Suggested Talking Points:")
            for tp in briefing["suggested_talking_points"]:
                lines.append(f"- {tp}")
            followups_list = ["Prepare an outreach summary", "What follow-ups are due?"]
            return "\n".join(lines), "meeting_preparation_briefing", tools_exec, data_refs, followups_list

        if tool_name == "get_funnel_reports":
            report = result
            stages = report.get("funnel_stages", [])
            summary = report.get("summary", {})
            lines = [
                f"### Commercial Funnel Report\n",
                f"- **Total Organizations**: {report.get('total_organizations', 0)}",
                f"- **Pipeline Value**: {_fmt_currency(report.get('pipeline_value', 0))}\n",
                f"#### Funnel Stages:",
            ]
            for s in stages:
                lines.append(f"- **{s['stage']}**: {s['count']} orgs ({s['percentage']}%) — {_fmt_currency(s['value'])}")
            lines.append(f"\n#### Summary:")
            lines.append(f"- Proposals: {summary.get('active_proposals', 0)} active / {summary.get('total_proposals', 0)} total")
            lines.append(f"- Demos: {summary.get('total_demos', 0)} | Negotiations: {summary.get('total_negotiations', 0)}")
            lines.append(f"- Partnerships: {summary.get('total_partnerships', 0)} | Customers: {summary.get('total_customers', 0)}")
            followups_list = ["Show pipeline by stage", "What needs my attention?"]
            return "\n".join(lines), "get_funnel_reports", tools_exec, data_refs, followups_list

        if tool_name == "search_customers":
            customers = result
            if not customers:
                return "No active customer accounts found.", "search_customers", tools_exec, [], ["Show funnel report"]
            lines = [f"### Active Customer Accounts ({len(customers)}):"]
            for cust in customers:
                lines.append(f"- **{cust['organization_name']}** ({cust['status']}) — Contract: {_fmt_currency(cust.get('contract_value', 0))}")
                data_refs.append(DataReference(entity_type="customer", entity_id=cust["id"], title=cust["organization_name"], subtitle=f"Status: {cust['status']}", url=f"/business-development/customers/{cust['id']}"))
            followups_list = ["Show customer health metrics", "Show funnel report"]
            return "\n".join(lines), "search_customers", tools_exec, data_refs, followups_list

        if tool_name == "search_proposals":
            proposals = result
            if not proposals:
                return "No active proposals found.", "search_proposals", tools_exec, [], ["Show funnel report"]
            lines = [f"### Active Proposals ({len(proposals)}):"]
            for prop in proposals:
                lines.append(f"- **{prop['title']}** ({prop['status']}) — Value: {_fmt_currency(prop.get('value', 0))}")
                data_refs.append(DataReference(entity_type="proposal", entity_id=prop["id"], title=prop["title"], subtitle=f"Status: {prop['status']}", url=f"/business-development/proposals/{prop['id']}"))
            followups_list = ["Show funnel report", "What needs my attention?"]
            return "\n".join(lines), "search_proposals", tools_exec, data_refs, followups_list

        if tool_name == "discover_web":
            orgs = result
            if not orgs:
                return "No organizations found from web search. Try different keywords.", "discover_web", tools_exec, [], ["Search CRM organizations"]
            if isinstance(orgs, list) and len(orgs) > 0 and "error" in orgs[0]:
                return f"Web search unavailable: {orgs[0]['error']}", "discover_web", tools_exec, [], ["Search CRM organizations"]
            lines = [f"### Web Discovery Results ({len(orgs)}):"]
            for idx, o in enumerate(orgs):
                name = o.get("name", "Unknown")
                org_type = o.get("organization_type", "")
                location = o.get("city") or o.get("country") or ""
                fit = o.get("fit_level", "")
                source = o.get("source", "web")
                lines.append(f"- **{name}** ({org_type} — {location}) | Fit: `{fit}` | Source: {source}")
                data_refs.append(DataReference(
                    entity_type="organization", entity_id=idx + 1,
                    title=name, subtitle=f"{org_type} — {location} | {fit}",
                    url=o.get("website", "")
                ))
            followups_list = ["Add these to CRM", "Search for contacts at these orgs"]
            return "\n".join(lines), "discover_web", tools_exec, data_refs, followups_list

        if tool_name == "discover_qualified":
            orgs = result.get("organizations", []) if isinstance(result, dict) else []
            total_raw = result.get("total_raw", 0) if isinstance(result, dict) else 0
            total_dedup = result.get("total_deduplicated", 0) if isinstance(result, dict) else 0
            sources = result.get("sources_used", []) if isinstance(result, dict) else []
            saved_count = result.get("saved_to_crm", 0) if isinstance(result, dict) else 0
            if not orgs:
                return "No qualified organizations found. Try different search criteria.", "discover_qualified", tools_exec, [], ["Search with different keywords"]
            lines = [f"### Qualified Discovery Results ({len(orgs)} from {total_raw} raw, {total_dedup} unique):"]
            if saved_count:
                lines.append(f"**{saved_count} new organizations added to CRM** (Organizations page).")
            lines.append(f"**Sources:** {', '.join(sources) if sources else 'N/A'}\n")
            for i, o in enumerate(orgs[:10], 1):
                name = o.get("name", "Unknown")
                score = o.get("potential_fit_score", 0)
                tier = o.get("potential_fit", "Low")
                crm = o.get("crm_status", "NEW_LEAD")
                signals = o.get("qualification", {}).get("positive_signals", [])[:2]
                research_status = o.get("research_status", "not researched")
                lines.append(f"**{i}. {name}** — {score}/100 [{tier}] | CRM: `{crm}` | Research: {research_status}")
                if signals:
                    for s in signals:
                        lines.append(f"   ✓ {s}")
            followups_list = ["Research the top lead", "Show account brief for #1", "View Organizations page"]
            return "\n".join(lines), "discover_qualified", tools_exec, data_refs, followups_list

        if tool_name == "research_organization":
            if isinstance(result, dict) and "error" in result:
                return f"Research failed: {result['error']}", "research_organization", tools_exec, [], ["Try again"]
            research = result.get("research", {}) if isinstance(result, dict) else {}
            brief = result.get("brief", {}) if isinstance(result, dict) else {}
            projects = result.get("matched_projects", []) if isinstance(result, dict) else []
            lines = [f"### Research Brief: {brief.get('organization_name', 'Unknown')}"]
            lines.append(f"**Fit Score:** {brief.get('fit_score', 0)}/100 [{brief.get('priority', 'Low')}]")
            if brief.get("company_overview"):
                lines.append(f"\n**Overview:** {brief['company_overview'][:300]}")
            if brief.get("why_contact"):
                lines.append(f"\n**Why Contact:** {brief['why_contact']}")
            if brief.get("potential_elly_opportunity"):
                lines.append(f"\n**ELLY Opportunity:** {brief['potential_elly_opportunity']}")
            if brief.get("technology_signals"):
                lines.append("\n**Technology Signals:**")
                for s in brief["technology_signals"][:3]:
                    lines.append(f"- {s}")
            if brief.get("recommended_approach"):
                lines.append(f"\n**Recommended Approach:** {brief['recommended_approach']}")
            if projects:
                lines.append("\n**Matched ELLY Projects:**")
                for p in projects[:3]:
                    lines.append(f"- {p.get('project_name', '')} ({p.get('relevance_score', 0)}% match)")
            if brief.get("risks_and_unknowns"):
                lines.append("\n**Risks:**")
                for r in brief["risks_and_unknowns"]:
                    lines.append(f"- ⚠ {r}")
            followups_list = ["Find decision makers", "Add to CRM", "Research another organization"]
            return "\n".join(lines), "research_organization", tools_exec, data_refs, followups_list

        if tool_name == "qualify_organization":
            if isinstance(result, dict) and "error" in result:
                return f"Qualification failed: {result['error']}", "qualify_organization", tools_exec, [], []
            score = result.get("score", 0)
            tier = result.get("tier", "Low")
            confidence = result.get("confidence", 0)
            factors = result.get("factors", [])
            positive = result.get("positive_signals", [])
            negative = result.get("negative_signals", [])
            lines = [f"### Qualification Score: {score}/100 [{tier}] (confidence: {confidence:.0%})"]
            lines.append("\n**Scoring Factors:**")
            for f in factors:
                bar = "█" * (f["score"] * 10 // max(f["weight"], 1))
                lines.append(f"- {f['factor']}: {f['score']}/{f['weight']} {bar} — {f['reason']}")
            if positive:
                lines.append("\n**✓ Positive Signals:**")
                for s in positive[:3]:
                    lines.append(f"- {s}")
            if negative:
                lines.append("\n**⚠ Risks:**")
                for s in negative[:2]:
                    lines.append(f"- {s}")
            followups_list = ["Show full research brief", "Find decision makers", "Add to CRM"]
            return "\n".join(lines), "qualify_organization", tools_exec, data_refs, followups_list

        if tool_name == "get_research_brief":
            if isinstance(result, dict) and "error" in result:
                return f"Brief failed: {result['error']}", "get_research_brief", tools_exec, [], []
            lines = [f"### Account Intelligence Brief: {result.get('organization_name', 'Unknown')}"]
            lines.append(f"**Fit Score:** {result.get('fit_score', 0)}/100 [{result.get('priority', 'Low')}]")
            for section, title in [
                ("company_overview", "Company Overview"),
                ("why_contact", "Why Contact"),
                ("potential_elly_opportunity", "ELLY Opportunity"),
                ("recommended_approach", "Recommended Approach"),
            ]:
                if result.get(section):
                    lines.append(f"\n**{title}:** {result[section]}")
            if result.get("technology_signals"):
                lines.append("\n**Technology Signals:**")
                for s in result["technology_signals"][:5]:
                    lines.append(f"- {s}")
            if result.get("recommended_showcase_projects"):
                lines.append("\n**Recommended Projects:**")
                for p in result["recommended_showcase_projects"]:
                    lines.append(f"- {p}")
            followups_list = ["Find decision makers", "Add to CRM"]
            return "\n".join(lines), "get_research_brief", tools_exec, data_refs, followups_list

        if tool_name == "discover_decision_makers":
            contacts = result if isinstance(result, list) else []
            if not contacts:
                return "No decision-makers found. Try enriching contacts via the Discovery page.", "discover_decision_makers", tools_exec, [], ["Research the organization"]
            lines = [f"### Decision Makers Found ({len(contacts)}):"]
            for c in contacts[:8]:
                verified = "✓ Verified" if c.get("email_status") == "enriched" else f"({c.get('email_status', 'unverified')})"
                dm = f"[{c.get('decision_maker_score', 0)}]" if c.get("decision_maker_score", 0) >= 80 else ""
                lines.append(f"- **{c['name']}** — {c['role']} {dm} | Email: {verified} | Source: {c.get('source', 'unknown')}")
                if c.get("fit_reason"):
                    lines.append(f"  {c['fit_reason'][:100]}")
            followups_list = ["Prepare outreach draft", "Add contacts to CRM"]
            return "\n".join(lines), "discover_decision_makers", tools_exec, data_refs, followups_list

        if tool_name == "get_discovery_analytics":
            if isinstance(result, dict) and "error" in result:
                return f"Analytics error: {result['error']}", "get_discovery_analytics", tools_exec, [], []
            lines = ["### Discovery Intelligence Analytics"]
            lines.append(f"- **Leads Discovered:** {result.get('leads_discovered', 0)}")
            lines.append(f"- **High-Fit Leads:** {result.get('high_fit_leads', 0)}")
            lines.append(f"- **Leads Added to CRM:** {result.get('leads_added_to_crm', 0)}")
            lines.append(f"- **Conversion Rate:** {result.get('conversion_rate', 0)}%")
            lines.append(f"- **Average Score:** {result.get('average_qualification_score', 0)}")
            lines.append(f"- **Decision Makers Found:** {result.get('decision_makers_found', 0)}")
            lines.append(f"- **Verified Contacts:** {result.get('verified_contacts', 0)}")
            lines.append(f"- **Duplicate Rate:** {result.get('duplicate_rate', 0)}%")
            src = result.get("source_performance", {})
            if src:
                lines.append("\n**Source Performance:**")
                for name, metrics in src.items():
                    lines.append(f"- {name}: {metrics.get('total', 0)} leads, {metrics.get('high_fit', 0)} high-fit")
            followups_list = ["Find high-fit leads", "Research top leads"]
            return "\n".join(lines), "get_discovery_analytics", tools_exec, data_refs, followups_list

        # Generic fallback for any other tool result
        reply = f"Tool `{tool_name}` executed successfully."
        if isinstance(result, dict):
            if "items" in result:
                items = result["items"]
                reply = f"Found {len(items)} results from `{tool_name}`."
            elif "error" in result:
                reply = f"Tool error: {result['error']}"
        elif isinstance(result, list):
            reply = f"Found {len(result)} results from `{tool_name}`."
        return reply, tool_name, tools_exec, data_refs, followups_list

    # ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    # LLM AGENT (Tier 2)
    # ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

    @classmethod
    def _run_llm_agent(cls, db, user, conversation_id, message, context):
        """Run LLM function-calling agent with multi-step tool execution."""
        tools_exec: List[ToolExecutionRecord] = []
        data_refs: List[DataReference] = []

        # Build conversation messages from history
        conv = db.query(CopilotConversation).filter(CopilotConversation.id == conversation_id).first()
        history_msgs = []
        if conv:
            past = db.query(CopilotMessage).filter(
                CopilotMessage.conversation_id == conversation_id
            ).order_by(CopilotMessage.id).all()
            for pm in past:
                role = "user" if pm.sender == "user" else "assistant"
                history_msgs.append({"role": role, "content": pm.content})

        # Build context hint
        context_hint = ""
        if context and context.active_entity_id:
            if context.active_entity_type == "organization" or (context.current_page and "/organizations/" in context.current_page):
                org = tools.resolve_organization(db, context.active_entity_id)
                if org:
                    context_hint = f"\n[Active Organization: {org.name} (ID: {org.id}, Stage: {org.status}, Priority: {org.priority})]"
            elif context.active_entity_type == "meeting":
                context_hint = f"\n[Active Meeting ID: {context.active_entity_id}]"
            elif context.active_entity_type == "opportunity":
                context_hint = f"\n[Active Opportunity ID: {context.active_entity_id}]"

        # Add workload summary for complex queries
        workload_hint = ""
        try:
            dash = tools.get_dashboard_summary(db, user)
            workload_hint = (
                f"\n[Current Workload: {dash['total_orgs']} orgs, "
                f"{dash['active_opportunities_count']} open deals ({_fmt_currency(dash['total_pipeline_value'], 'INR').replace('.00', '')}), "
                f"{dash['today_meetings']} meetings today, "
                f"{dash['overdue_followups']} overdue follow-ups, "
                f"{dash['active_partnerships']} partnerships]"
            )
        except Exception:
            pass

        system_content = SYSTEM_PROMPT + context_hint + workload_hint

        messages = [{"role": "system", "content": system_content}]
        messages.extend(history_msgs)
        messages.append({"role": "user", "content": message})

        # Create LLM router and run agent loop
        router = _get_llm_router()
        max_iterations = settings.LLM_MAX_AGENT_ITERATIONS

        # Track pending confirmation if generated by any tool
        pending_conf_holder: List[Optional[ConfirmationAction]] = [None]

        try:
            def tool_executor(name, arguments):
                result = execute_tool(db, name, arguments, user)
                tools_exec.append(ToolExecutionRecord(
                    tool_name=name, arguments=arguments,
                    status="success" if "error" not in result else "error",
                    summary=f"Executed {name}" if "error" not in result else result.get("error", "Unknown error")
                ))

                # If tool requires confirmation before actual commit
                if isinstance(result, dict) and result.get("requires_confirmation") and not pending_conf_holder[0]:
                    action_type = result.get("action_type", "execute_action")
                    action_id = f"act-{uuid.uuid4().hex[:8]}"
                    expires = datetime.now(timezone.utc) + timedelta(minutes=10)

                    if action_type == "schedule_meeting":
                        conf_title = f"Schedule Meeting: {result.get('title', 'Meeting')}"
                        conf_desc = f"Schedule with {result.get('organization_name', 'Organization')} at {result.get('scheduled_at')} ({result.get('duration_minutes', 30)} min)."
                    elif action_type == "send_email":
                        conf_title = f"Send Outreach Email to {result.get('contact_name', 'Prospect')}"
                        conf_desc = f"Subject: '{result.get('subject', 'Outreach')}' to {result.get('contact_email') or result.get('organization_name', 'prospect')}."
                    else:
                        conf_title = f"Execute {action_type.replace('_', ' ').title()}"
                        conf_desc = f"Execute action for {result.get('organization_name', 'organization')}."

                    pending_action = ConfirmationAction(
                        action_id=action_id,
                        action_type=action_type,
                        title=conf_title,
                        description=conf_desc,
                        target_entity_type="organization",
                        target_entity_id=result.get("organization_id"),
                        payload=result,
                        expires_at=expires,
                    )
                    _save_confirmation(db, action_id, action_type, result, user.id, summary=conf_title)
                    pending_conf_holder[0] = pending_action

                # Track data references for known entity types
                if isinstance(result, dict) and "items" in result:
                    for item in result["items"][:5]:
                        if isinstance(item, dict):
                            et = "organization" if "organization_type" in item else ("contact" if "designation" in item else None)
                            if et and "id" in item and "name" in item:
                                data_refs.append(DataReference(
                                    entity_type=et, entity_id=item["id"],
                                    title=item["name"],
                                    subtitle=item.get("status", item.get("organization_type", "")),
                                    url=f"/business-development/{et}s/{item['id']}"
                                ))
                return result

            # Deterministic Task Classifier: simple_tool -> Groq, complex_tool -> Gemini, extraction -> NVIDIA NIM
            from app.services.copilot.task_classifier import classify_task
            task_type = classify_task(message).value

            response = router.chat_with_tools(
                messages=messages,
                tools=AGENT_TOOL_SCHEMAS,
                tool_executor=tool_executor,
                max_rounds=max_iterations,
                task_type=task_type,
            )

            reply = response.content or "I was unable to generate a response."
            provider_used = response.provider

        except AllProvidersExhausted as e:
            reply = ("I am unable to reach my AI providers at the moment. "
                     "Please try again shortly. (All providers exhausted)")
            provider_used = "none"
            logger.error("All LLM providers exhausted: %s", e)
        except Exception as e:
            reply = f"I encountered an error while processing your request. Please try again."
            provider_used = "error"
            logger.error("LLM agent error: %s", e, exc_info=True)

        # Build followups
        followups = ["Show dashboard", "Show my priorities", "What meetings do I have?"]

        return cls._save_and_return_response(
            db, conversation_id, reply,
            intent="llm_agent",
            tools_executed=tools_exec,
            data_references=data_refs,
            pending_confirmation=pending_conf_holder[0],
            suggested_followups=followups
        )

    # ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    # ACTION CONFIRMATION EXECUTION
    # ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

    @classmethod
    def execute_confirmed_action(cls, db, user, request):
        # Fetch from DB instead of in-memory dict
        action_record = _get_confirmation(db, request.action_id, user.id)
        if not action_record:
            # Check if expired or wrong user for better error message
            now = datetime.now(timezone.utc)
            any_record = db.query(CopilotConfirmationAction).filter(
                CopilotConfirmationAction.id == request.action_id
            ).first()
            if any_record:
                # Ensure expires_at is timezone-aware for comparison
                exp = any_record.expires_at
                if exp and exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                if exp and exp <= now:
                    msg = "Action has expired."
                elif any_record.user_id != user.id:
                    msg = "Action belongs to another user."
                elif any_record.status != "PENDING":
                    msg = f"Action already {any_record.status.lower()}."
                else:
                    msg = "Action has expired or does not exist."
            else:
                msg = "Action has expired or does not exist."
            return CopilotConfirmResponse(
                action_id=request.action_id, approved=request.approved,
                success=False, message=msg
            )

        if not request.approved:
            action_record.status = "CANCELLED"
            action_record.cancelled_at = datetime.now(timezone.utc)
            db.commit()
            return CopilotConfirmResponse(
                action_id=request.action_id, approved=False,
                success=True, message="Action cancelled by user."
            )

        payload = request.modified_payload or action_record.payload
        action_type = action_record.action_type
        data_refs: List[DataReference] = []

        try:
            if action_type == "move_connection_stage":
                org = db.query(Organization).filter(Organization.id == payload["organization_id"]).first()
                if not org:
                    return CopilotConfirmResponse(action_id=request.action_id, approved=True, success=False, message="Organization not found.")
                old_status = org.status
                org.status = payload["target_stage"]
                db.commit()
                log_audit_event(db, action="COPILOT_STAGE_MOVE", resource_type="ORGANIZATION", resource_id=org.id, user=user, metadata={"old_stage": old_status, "new_stage": org.status})
                data_refs.append(DataReference(entity_type="organization", entity_id=org.id, title=org.name, subtitle=f"Moved to {org.status}", url=f"/business-development/organizations/{org.id}"))
                _delete_confirmation(db, request.action_id)
                return CopilotConfirmResponse(action_id=request.action_id, approved=True, success=True, message=f"Successfully moved **{org.name}** to **{org.status}**.", result_data={"organization_id": org.id, "new_stage": org.status}, data_references=data_refs)

            elif action_type == "create_meeting":
                scheduled_dt = datetime.fromisoformat(payload["scheduled_at"]) if isinstance(payload["scheduled_at"], str) else payload["scheduled_at"]
                org_id = payload.get("organization_id")
                if not org_id:
                    first_org = db.query(Organization).filter(Organization.is_deleted == False).first()
                    org_id = first_org.id if first_org else 1
                meeting = Meeting(title=payload["title"], organization_id=org_id, scheduled_at=scheduled_dt, meeting_type=MeetingType.BUSINESS_DISCUSSION.value, status=MeetingStatus.SCHEDULED.value, agenda=payload.get("agenda"), created_by=user.id)
                db.add(meeting)
                db.commit()
                db.refresh(meeting)
                log_audit_event(db, action="COPILOT_CREATE_MEETING", resource_type="MEETING", resource_id=meeting.id, user=user, metadata={"title": meeting.title})
                data_refs.append(DataReference(entity_type="meeting", entity_id=meeting.id, title=meeting.title, subtitle=meeting.scheduled_at.strftime("%b %d at %I:%M %p"), url=f"/business-development/meetings/{meeting.id}"))
                _delete_confirmation(db, request.action_id)
                return CopilotConfirmResponse(action_id=request.action_id, approved=True, success=True, message=f"Successfully scheduled meeting **{meeting.title}**.", result_data={"meeting_id": meeting.id}, data_references=data_refs)

            elif action_type == "create_followup":
                due_dt = datetime.fromisoformat(payload["due_date"]) if isinstance(payload["due_date"], str) else payload["due_date"]
                org_id = payload.get("organization_id")
                if not org_id:
                    first_org = db.query(Organization).filter(Organization.is_deleted == False).first()
                    org_id = first_org.id if first_org else 1
                fu = FollowUp(title=payload["title"], organization_id=org_id, due_at=due_dt, priority=FollowUpPriority.HIGH.value if payload.get("priority", "").upper() == "HIGH" else FollowUpPriority.MEDIUM.value, status=FollowUpStatus.PENDING.value, description=payload.get("description"), assigned_to=user.name, created_by=user.id)
                db.add(fu)
                db.commit()
                db.refresh(fu)
                log_audit_event(db, action="COPILOT_CREATE_FOLLOWUP", resource_type="FOLLOWUP", resource_id=fu.id, user=user, metadata={"title": fu.title})
                data_refs.append(DataReference(entity_type="followup", entity_id=fu.id, title=fu.title, subtitle=f"Due: {fu.due_at.strftime('%b %d')}", url=f"/business-development/followups/{fu.id}"))
                _delete_confirmation(db, request.action_id)
                return CopilotConfirmResponse(action_id=request.action_id, approved=True, success=True, message=f"Successfully created follow-up **{fu.title}**.", result_data={"followup_id": fu.id}, data_references=data_refs)

            elif action_type == "log_call":
                comm = Communication(organization_id=payload["organization_id"], channel="Phone", direction="Outgoing", subject=f"Phone Call with {payload.get('notes', 'Contact')[:30]}", summary=f"Call outcome: {payload.get('outcome', 'Connected')}", content=payload.get("notes", "Phone call logged via ELLY Copilot."), communication_date=datetime.now(timezone.utc), status="Completed", created_by=user.name)
                db.add(comm)
                db.commit()
                db.refresh(comm)
                log_audit_event(db, action="COPILOT_LOG_CALL", resource_type="CALL", resource_id=comm.id, user=user, metadata={"organization_id": payload["organization_id"]})
                _delete_confirmation(db, request.action_id)
                return CopilotConfirmResponse(action_id=request.action_id, approved=True, success=True, message="Successfully logged call in the communication timeline.", result_data={"call_id": comm.id})

            elif action_type == "create_proposal":
                from app.models.proposal import Proposal
                prop = Proposal(organization_id=payload["organization_id"], title=payload["title"], version=payload.get("version", "v1.0"), value=payload.get("value", 500000.0), content_summary=payload.get("content_summary"), status="Draft", owner_id=user.id, created_by=user.name)
                db.add(prop)
                db.commit()
                db.refresh(prop)
                log_audit_event(db, action="COPILOT_CREATE_PROPOSAL", resource_type="PROPOSAL", resource_id=prop.id, user=user, metadata={"title": prop.title})
                data_refs.append(DataReference(entity_type="proposal", entity_id=prop.id, title=prop.title, subtitle=f"Value: {_fmt_currency(prop.value or 0, prop.currency or 'INR')}", url=f"/business-development/proposals/{prop.id}"))
                _delete_confirmation(db, request.action_id)
                return CopilotConfirmResponse(action_id=request.action_id, approved=True, success=True, message=f"Successfully generated proposal **{prop.title}**.", result_data={"proposal_id": prop.id}, data_references=data_refs)

            elif action_type == "convert_to_customer":
                from app.models.customer import Customer
                org = db.query(Organization).filter(Organization.id == payload["organization_id"]).first()
                if not org:
                    return CopilotConfirmResponse(action_id=request.action_id, approved=True, success=False, message="Organization not found.")
                cust = db.query(Customer).filter(Customer.organization_id == org.id, Customer.is_deleted == False).first()
                if not cust:
                    cust = Customer(organization_id=org.id, contract_value=payload.get("contract_value", 750000.0), status="Active", account_health="Good", owner_id=user.id, notes=payload.get("notes"), created_by=user.name)
                    db.add(cust)
                else:
                    cust.status = "Active"
                    cust.contract_value = payload.get("contract_value", cust.contract_value)
                org.status = ConnectionStatus.CUSTOMER.value
                db.commit()
                db.refresh(cust)
                log_audit_event(db, action="COPILOT_CONVERT_CUSTOMER", resource_type="CUSTOMER", resource_id=cust.id, user=user, metadata={"organization_name": org.name})
                data_refs.append(DataReference(entity_type="customer", entity_id=cust.id, title=org.name, subtitle=f"Customer Account Active - {_fmt_currency(cust.contract_value or 0, cust.currency or 'INR')}", url=f"/business-development/customers/{cust.id}"))
                _delete_confirmation(db, request.action_id)
                return CopilotConfirmResponse(action_id=request.action_id, approved=True, success=True, message=f"Successfully converted **{org.name}** to an active customer.", result_data={"customer_id": cust.id}, data_references=data_refs)

            elif action_type == "create_task":
                from app.models.task import BDTask
                due_dt = datetime.fromisoformat(payload["due_date"]) if isinstance(payload["due_date"], str) else payload["due_date"]
                task = BDTask(title=payload["title"], description=payload.get("description"), priority=payload.get("priority", "High"), due_date=due_dt, status="Todo", owner_id=user.id, created_by=user.name)
                db.add(task)
                db.commit()
                db.refresh(task)
                log_audit_event(db, action="COPILOT_CREATE_TASK", resource_type="TASK", resource_id=task.id, user=user, metadata={"title": task.title})
                data_refs.append(DataReference(entity_type="task", entity_id=task.id, title=task.title, subtitle=f"Due: {task.due_date.strftime('%b %d') if task.due_date else 'Soon'}", url="/business-development/tasks"))
                _delete_confirmation(db, request.action_id)
                return CopilotConfirmResponse(action_id=request.action_id, approved=True, success=True, message=f"Successfully added task **{task.title}**.", result_data={"task_id": task.id}, data_references=data_refs)

            elif action_type == "send_email":
                from app.models.communication import Communication
                org_id = payload.get("organization_id")
                comm = Communication(
                    organization_id=org_id,
                    channel="Email",
                    direction="Outgoing",
                    subject=payload.get("subject", "Outreach Email"),
                    summary=f"Sent to {payload.get('contact_email') or payload.get('contact_name', 'Prospect')}",
                    content=payload.get("body", ""),
                    communication_date=datetime.now(timezone.utc),
                    status="Completed",
                    created_by=getattr(user, "name", "User"),
                )
                db.add(comm)
                db.commit()
                db.refresh(comm)
                log_audit_event(db, action="COPILOT_SEND_EMAIL", resource_type="EMAIL", resource_id=comm.id, user=user, metadata={"organization_id": org_id, "contact_email": payload.get("contact_email")})
                if org_id:
                    data_refs.append(DataReference(entity_type="organization", entity_id=org_id, title=payload.get("organization_name", "Organization"), subtitle="Outreach email logged", url=f"/business-development/organizations/{org_id}"))
                _delete_confirmation(db, request.action_id)
                return CopilotConfirmResponse(
                    action_id=request.action_id, approved=True, success=True,
                    message=f"Successfully dispatched and recorded outreach email to **{payload.get('contact_name', 'prospect')}**.",
                    result_data={"communication_id": comm.id},
                    data_references=data_refs
                )

            elif action_type == "schedule_meeting":
                scheduled_dt = datetime.fromisoformat(payload["scheduled_at"]) if isinstance(payload["scheduled_at"], str) else payload["scheduled_at"]
                org_id = payload.get("organization_id")
                meeting = Meeting(
                    title=payload.get("title", "Strategic Meeting"),
                    organization_id=org_id,
                    scheduled_at=scheduled_dt,
                    duration_minutes=payload.get("duration_minutes", 30),
                    meeting_type=payload.get("meeting_type", MeetingType.BUSINESS_DISCUSSION.value),
                    status=MeetingStatus.SCHEDULED.value,
                    meeting_url=payload.get("meeting_url") or None,
                    notes=payload.get("notes"),
                    primary_contact_id=payload.get("primary_contact_id"),
                    created_by=user.id,
                )
                db.add(meeting)
                db.commit()
                db.refresh(meeting)
                log_audit_event(db, action="COPILOT_SCHEDULE_MEETING", resource_type="MEETING", resource_id=meeting.id, user=user, metadata={"title": meeting.title})
                data_refs.append(DataReference(entity_type="meeting", entity_id=meeting.id, title=meeting.title, subtitle=meeting.scheduled_at.strftime("%b %d at %I:%M %p"), url=f"/business-development/meetings/{meeting.id}"))
                _delete_confirmation(db, request.action_id)
                return CopilotConfirmResponse(
                    action_id=request.action_id, approved=True, success=True,
                    message=f"Successfully booked meeting **{meeting.title}** for {meeting.scheduled_at.strftime('%b %d, %Y at %I:%M %p')}.",
                    result_data={"meeting_id": meeting.id},
                    data_references=data_refs
                )

            return CopilotConfirmResponse(action_id=request.action_id, approved=True, success=False, message=f"Action type '{action_type}' is not supported.")

        except Exception as e:
            logger.error("Confirmation execution failed: %s", e)
            return CopilotConfirmResponse(action_id=request.action_id, approved=True, success=False, message=f"Failed to execute action: {str(e)}")

    # ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    # INTERNAL RESPONSE BUILDER
    # ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

    @classmethod
    def _save_and_return_response(cls, db, conversation_id, reply, intent=None, tools_executed=None, data_references=None, pending_confirmation=None, suggested_followups=None):
        tools_json = [t.model_dump(mode="json") for t in tools_executed] if tools_executed else None
        refs_json = [r.model_dump(mode="json") for r in data_references] if data_references else None
        conf_json = pending_confirmation.model_dump(mode="json") if pending_confirmation else None

        msg = CopilotMessage(
            conversation_id=conversation_id,
            sender="assistant",
            content=reply,
            intent=intent,
            tools_executed=tools_json,
            data_references=refs_json,
            pending_confirmation=conf_json,
            confirmation_status="pending" if pending_confirmation else None
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)

        return CopilotChatResponse(
            conversation_id=conversation_id,
            message_id=msg.id,
            reply=reply,
            intent=intent,
            tools_executed=tools_executed or [],
            data_references=data_references or [],
            pending_confirmation=pending_confirmation,
            suggested_followups=suggested_followups or [],
            created_at=msg.created_at
        )
