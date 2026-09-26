"""
Smart Intent Router with two-tier routing.

Tier 1: Regex fast-path (0ms, 0 tokens) for simple, predictable intents.
Tier 2: LLM function-calling for complex, ambiguous, multi-step requests.

The router decides WHETHER to use the LLM. Simple stuff stays free.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class RoutingMethod(str, Enum):
    REGEX = "regex"
    LLM = "llm"


@dataclass
class RouteResult:
    intent: str
    method: RoutingMethod
    confidence: float = 1.0
    tool_name: Optional[str] = None
    pre_resolved_args: Optional[dict] = None


# -- Tier 1: Regex patterns for fast, free routing --
# Order matters: first match wins. More specific patterns first.

SIMPLE_INTENTS: list[tuple[str, re.Pattern, str, Optional[callable]]] = [
    # 360 briefing - must be before generic org search
    ("organization_360", re.compile(
        r"\b(tell me everything|360|complete briefing|all about|tell me about|briefing for|overview of)\b",
        re.I),
     "get_organization_360_briefing", None),

    # Meeting preparation
    ("meeting_prep", re.compile(
        r"\b(prepar|brief|agenda|prep).{0,30}\b(meeting|call)\b"
        r"|\b(meeting|call).{0,30}\b(prepar|brief|agenda|prep|what should)\b",
        re.I),
     "get_meeting_preparation", None),

    # Write action: move stage (must precede pipeline)
    ("move_stage", re.compile(
        r"\b(move|change stage|update stage|advance|set stage|update status)\b"
        r".*\bto\s+([A-Za-z]+)\b",
        re.I),
     "_write_move_stage", None),

    # Stage-specific organizations ("Which organizations are in Discussion?")
    ("stage_orgs", re.compile(
        r"\b(organization|org|hospital).{0,30}\b(in|at)\s+(Potential|New|Contacted|Responded|Meeting|Discussion|Demo|Proposal|Negotiation|Partnership|Customer|Connected|Interested)\b",
        re.I),
     "get_stage_organizations",
     lambda m: {"stage": m.group(2)}),

    # Funnel reports
    ("funnel_reports", re.compile(
        r"\b(funnel|commercial report|full report)\b",
        re.I),
     "get_funnel_reports", None),

    # Pipeline summary ("How many organizations in each stage")
    ("pipeline", re.compile(
        r"\b(pipeline|stages?|connection stages?|each stage)\b"
        r"|\bhow many\b.{0,30}\bstage",
        re.I),
     "get_pipeline_summary", None),

    # Meetings list ("What meetings do I have", "Show meetings")
    ("meetings_list", re.compile(
        r"\b(meetings?|calls?)\b.{0,30}\b(show|list|what|have|scheduled|today|tomorrow|upcoming|do i)\b"
        r"|\b(show|list)\b.{0,20}\b(meetings?|calls?)\b"
        r"|\bwhat\b.{0,20}\b(meetings?|calls?)\b",
        re.I),
     "search_meetings", None),

    # Map/Location context
    ("map_view", re.compile(
        r"\b(map|where|location|geographic|nearby|near)\b.{0,30}\b(organization|org|hospital|company|show)\b"
        r"|\b(show|find|where).{0,20}\b(on|the)\s+map\b"
        r"|\borganizations?\s+(near|around|in)\b",
        re.I),
     "get_organization_map_data", None),

    # Calendar/Upcoming meetings
    ("calendar_view", re.compile(
        r"\b(calendar|schedule|upcoming|today|tomorrow|this week)\b.{0,20}\b(meetings?|events?)\b"
        r"|\bwhat('s| is)\b.{0,20}\b(on|scheduled)\b.{0,20}\b(calendar|today|tomorrow)\b"
        r"|\b(next meeting|where is my next)\b",
        re.I),
     "get_calendar_events", None),

    # Follow-ups
    ("followups_list", re.compile(r"\b(follow.?ups?)\b", re.I),
     "search_followups", None),

    # Opportunities ("Which opportunities", "Show opportunities", "deals")
    ("opportunities", re.compile(
        r"\b(opportunit\w*|deal|deals|pipeline value)\b",
        re.I),
     "search_opportunities", None),

    # Contacts / Decision makers ("Who are the decision makers", "Find contacts")
    ("contacts", re.compile(
        r"\b(who|find|search|show|list).{0,30}\b(decision.?makers?|contact|cto|ceo|cdo|cio|director|head of|leadership)\b"
        r"|\b(decision.?makers?|contacts?)\b.{0,20}\b(at|for|in)\b",
        re.I),
     "search_contacts", None),

    # Find/search organizations ("Find companies in Hyderabad")
    ("search_org", re.compile(
        r"\b(find|discover|search|show|look).{0,20}\b(organizations?|companies?|orgs?|leads?|businesses?|hospitals?|clinics?)\b",
        re.I),
     "discover_organizations", None),

    # Customers
    ("customers", re.compile(
        r"\b(customer|customers|active customer|client|clients)\b",
        re.I),
     "search_customers", None),

    # Proposals
    ("proposals", re.compile(
        r"\b(proposal|proposals|active proposal)\b",
        re.I),
     "search_proposals", None),

    # Campaigns
    ("campaigns", re.compile(
        r"\b(campaign|campaigns|outreach campaign|sequence)\b",
        re.I),
     "search_campaigns", None),

    # Campaign replies
    ("campaign_replies", re.compile(
        r"\b(replies|replied|who replied|campaign replies)\b",
        re.I),
     "get_campaign_replies", None),

    # Campaign ROI
    ("campaign_roi", re.compile(
        r"\b(campaign roi|campaign report|campaign funnel|campaign performance)\b",
        re.I),
     "get_campaign_roi", None),

    # Next best action
    ("next_best_action", re.compile(
        r"\b(next best action|what should i do|what('s| is) next|priority|priorities)\b",
        re.I),
     "get_next_best_action", None),

    # Demos
    ("demos", re.compile(
        r"\b(demo|demos|demo status|demo outcome)\b",
        re.I),
     "search_demos", None),

    # Negotiations
    ("negotiations", re.compile(
        r"\b(negotiation|negotiations|active negotiation|deal negotiation)\b",
        re.I),
     "search_negotiations", None),

    # Tasks
    ("tasks", re.compile(
        r"\b(task|tasks|bd tasks|open tasks)\b",
        re.I),
     "search_tasks", None),

    # Log call (write action - regex fast path)
    ("log_call", re.compile(
        r"\b(log|record).{0,10}\b(call|phone)\b",
        re.I),
     "_write_log_call", None),

    # Partnerships
    ("partnerships", re.compile(
        r"\b(partnership|partnerships|strategic partner|alliance|active partner)\b",
        re.I),
     "search_partnerships", None),

    # Projects / showcase
    ("projects", re.compile(
        r"\b(project|showcase|feature|solution|available)\b.{0,20}\b(project|showcase|feature|solution)\b"
        r"|\b(showcase|projects?)\b",
        re.I),
     "search_projects", None),

    # Timeline
    ("timeline", re.compile(r"\b(timeline|history|chronolog|what happened)\b", re.I),
     "get_organization_timeline", None),

    # Dashboard / overview
    ("dashboard", re.compile(
        r"\b(dashboard|summary|overview|what.?s? going on)\b",
        re.I),
     "get_dashboard_summary", None),

    # Attention / priorities
    ("attention", re.compile(
        r"\b(attention|urgent|priorit|what should i do|work on|what needs|need to work)\b",
        re.I),
     "get_attention_items", None),
]


def _extract_org_from_message(message: str) -> Optional[str]:
    """Try to extract an organization name from the message."""
    patterns = [
        re.compile(r"\b(?:about|for|at|show|find|search)\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s*\?|\s*$)", re.I),
        re.compile(r"([A-Z][A-Za-z\s]+(?:Hospital|Healthcare|Health|Medical|Labs|Pharma|Technologies|Solutions|Corp|Inc|Ltd|Group|Systems|Partners|Finance|Bank|Insurance|Manufacturing))", re.I),
    ]
    for pat in patterns:
        m = pat.search(message)
        if m:
            return m.group(1).strip()
    return None


def _extract_location_from_message(message: str) -> Optional[str]:
    """Try to extract a location from the message."""
    m = re.search(r"\b(?:in|at|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b", message)
    return m.group(1) if m else None


def _extract_stage_from_message(message: str) -> Optional[str]:
    """Try to extract a connection stage name from the message."""
    stages = [
        "Potential", "New", "Contacted", "Responded", "Meeting",
        "Discussion", "Demo", "Proposal", "Negotiation", "Partnership",
        "Customer", "Connected", "Interested",
    ]
    msg_lower = message.lower()
    for stage in stages:
        if stage.lower() in msg_lower:
            return stage
    return None


def route(message: str, context: Optional[dict] = None) -> RouteResult:
    """
    Smart two-tier routing.

    Tier 1: Regex fast-path for simple intents (0 tokens, instant).
    Tier 2: LLM function-calling for complex/multi-step requests.
    """
    msg = message.strip()
    if not msg:
        return RouteResult(intent="empty", method=RoutingMethod.REGEX)

    # Tier 1: Try regex patterns (first match wins)
    for intent_name, pattern, tool_name, arg_extractor in SIMPLE_INTENTS:
        m = pattern.search(msg)
        if m:
            args = {}
            if arg_extractor:
                try:
                    args = arg_extractor(m)
                except Exception:
                    pass

            # Extract org name for org-specific queries
            if intent_name in ("organization_360", "find_leaders", "meeting_prep",
                               "timeline", "search_contacts"):
                org = _extract_org_from_message(msg)
                if org:
                    args["organization_name"] = org

            # Extract location for org search
            if intent_name == "search_org":
                loc = _extract_location_from_message(msg)
                if loc:
                    args["location"] = loc
                # Also extract org type
                org_type_match = re.search(r"\b(hospital|saas|fintech|manufacturing|healthcare|technology|ai|finance|retail|logistics)\b", msg, re.I)
                if org_type_match:
                    args["organization_type"] = org_type_match.group(1).title()

            # Extract stage for stage-specific queries
            if intent_name == "stage_orgs":
                stage = _extract_stage_from_message(msg)
                if stage:
                    args["stage"] = stage
                else:
                    # No specific stage found, route to pipeline summary instead
                    return RouteResult(
                        intent="pipeline",
                        method=RoutingMethod.REGEX,
                        confidence=1.0,
                        tool_name="get_pipeline_summary",
                        pre_resolved_args=None,
                    )

            # Extract time filter for meetings
            if intent_name == "meetings_list":
                if "today" in msg.lower():
                    args["time_filter"] = "today"
                elif "tomorrow" in msg.lower():
                    args["time_filter"] = "tomorrow"
                elif "week" in msg.lower():
                    args["time_filter"] = "this_week"
                elif "past" in msg.lower():
                    args["time_filter"] = "past"
                else:
                    args["time_filter"] = "upcoming"

            # Extract overdue for followups
            if intent_name == "followups_list":
                if "overdue" in msg.lower():
                    args["is_overdue"] = True

            return RouteResult(
                intent=intent_name,
                method=RoutingMethod.REGEX,
                confidence=1.0,
                tool_name=tool_name,
                pre_resolved_args=args or None,
            )

    # Tier 2: No regex match -> LLM agent
    return RouteResult(
        intent="llm_agent",
        method=RoutingMethod.LLM,
        confidence=0.0,
    )
