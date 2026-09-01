
"""
LLM Function-Calling Tool Definitions.
Wraps existing tools.py functions as OpenAI-compatible tool schemas.
"""
from __future__ import annotations

import json
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.services.copilot import tools


AGENT_TOOL_SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_dashboard_summary",
            "description": "Get dashboard overview: total orgs, contacts, opportunities, pipeline value.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_attention_items",
            "description": "Get items needing attention: overdue followups, today meetings, stale deals.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_organizations",
            "description": "Search CRM organizations by keyword, location, type, status, priority.",
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {"type": "string"},
                    "location": {"type": "string"},
                    "organization_type": {"type": "string"},
                    "status": {"type": "string", "enum": ["potential", "contacted", "connected", "partner"]},
                    "priority": {"type": "string", "enum": ["high", "medium", "low"]},
                    "limit": {"type": "integer", "default": 10},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_organization_360",
            "description": "Get complete dossier: contacts, opportunities, meetings, comms, partnerships, follow-ups, recommended action.",
            "parameters": {
                "type": "object",
                "properties": {
                    "organization_id": {"type": "integer"},
                    "organization_name": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_contacts",
            "description": "Search contacts by keyword, organization, role, or decision-maker status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {"type": "string"},
                    "organization_id": {"type": "integer"},
                    "is_decision_maker": {"type": "boolean"},
                    "limit": {"type": "integer", "default": 10},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_decision_makers",
            "description": "Find C-suite and senior leadership at an organization.",
            "parameters": {
                "type": "object",
                "properties": {
                    "organization_id": {"type": "integer"},
                    "organization_name": {"type": "string"},
                    "limit": {"type": "integer", "default": 10},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pipeline_summary",
            "description": "Get count of organizations at each pipeline stage.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_opportunities",
            "description": "Search opportunities by keyword, org, stage, value range.",
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {"type": "string"},
                    "organization_id": {"type": "integer"},
                    "stage": {"type": "string"},
                    "min_value": {"type": "number"},
                    "max_value": {"type": "number"},
                    "stale_only": {"type": "boolean"},
                    "limit": {"type": "integer", "default": 10},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_meetings",
            "description": "Search meetings by time filter: today, tomorrow, this_week, past, upcoming.",
            "parameters": {
                "type": "object",
                "properties": {
                    "time_filter": {"type": "string", "enum": ["today", "tomorrow", "this_week", "past", "upcoming"]},
                    "organization_id": {"type": "integer"},
                    "limit": {"type": "integer", "default": 10},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_organization_map_data",
            "description": "Get organizations with coordinates for map display. Filter by location (city, state, country).",
            "parameters": {
                "type": "object",
                "properties": {
                    "location_query": {"type": "string", "description": "Filter by city, state, or country name"},
                    "limit": {"type": "integer", "default": 50},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_calendar_events",
            "description": "Get upcoming meetings as calendar events for the next N days.",
            "parameters": {
                "type": "object",
                "properties": {
                    "days_ahead": {"type": "integer", "default": 7, "description": "Number of days to look ahead"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_followups",
            "description": "Search follow-ups by status, overdue flag.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string"},
                    "overdue_only": {"type": "boolean"},
                    "limit": {"type": "integer", "default": 10},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_meeting_preparation",
            "description": "Generate meeting prep dossier: past meetings, opportunities, talking points.",
            "parameters": {
                "type": "object",
                "properties": {
                    "organization_id": {"type": "integer"},
                    "organization_name": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_organization_timeline",
            "description": "Get chronological timeline of all interactions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "organization_id": {"type": "integer"},
                    "organization_name": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_projects",
            "description": "Search showcase projects by keyword, category.",
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {"type": "string"},
                    "category": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_organization_status",
            "description": "Update an organization's pipeline stage.",
            "parameters": {
                "type": "object",
                "properties": {
                    "organization_id": {"type": "integer"},
                    "status": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "discover_web",
            "description": "Search the internet for organizations using Tavily/Serper web search. Use when the user asks to find orgs not yet in the CRM, or wants to explore the market.",
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {"type": "string", "description": "Org name or keyword to search"},
                    "location": {"type": "string", "description": "Country or city"},
                    "organization_type": {"type": "string", "description": "e.g. SaaS, Fintech, Healthcare, Manufacturing, AI"},
                    "product_description": {"type": "string", "description": "What the user's company offers"},
                    "target_icp": {"type": "string", "description": "Ideal customer profile"},
                    "limit": {"type": "integer", "default": 5},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "discover_qualified",
            "description": "Full discovery pipeline: search web sources, deduplicate, research websites, qualify with explainable scoring. Use when the user wants high-quality researched leads.",
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {"type": "string"},
                    "location": {"type": "string"},
                    "organization_type": {"type": "string"},
                    "product_description": {"type": "string"},
                    "target_icp": {"type": "string"},
                    "discovery_objective": {"type": "string"},
                    "limit": {"type": "integer", "default": 10},
                    "research": {"type": "boolean", "default": True},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "research_organization",
            "description": "Deep-research a specific discovered organization. Scrapes its website for business intelligence, technology signals, and generates a research brief.",
            "parameters": {
                "type": "object",
                "properties": {
                    "discovered_org_id": {"type": "integer", "description": "ID of the discovered organization"},
                    "force_refresh": {"type": "boolean", "default": False},
                },
                "required": ["discovered_org_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "qualify_organization",
            "description": "Re-qualify a discovered organization with explainable scoring. Returns score, tier, factors, and reasons.",
            "parameters": {
                "type": "object",
                "properties": {
                    "discovered_org_id": {"type": "integer"},
                },
                "required": ["discovered_org_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_research_brief",
            "description": "Generate an Account Intelligence Brief for a discovered organization. Shows why to contact, opportunity, recommended approach, risks.",
            "parameters": {
                "type": "object",
                "properties": {
                    "discovered_org_id": {"type": "integer"},
                },
                "required": ["discovered_org_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "discover_decision_makers",
            "description": "Find decision-maker contacts at a discovered organization. Returns contacts with role, source, and verification status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "discovered_org_id": {"type": "integer"},
                    "roles": {"type": "string", "description": "Comma-separated target roles, e.g. CTO, CIO, VP of Sales, Head of Partnerships"},
                },
                "required": ["discovered_org_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_discovery_analytics",
            "description": "Get discovery intelligence metrics: leads by source, qualification scores, conversion rates, high-fit counts.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "enrich_contacts",
            "description": "Enrich contacts at an organization using BetterContact. Returns verified emails, phone, LinkedIn.",
            "parameters": {
                "type": "object",
                "properties": {
                    "organization": {"type": "string"},
                    "contacts_json": {"type": "string", "description": "JSON array of contacts: [{\"name\": \"...\", \"role\": \"...\"}]"},
                    "domain": {"type": "string"},
                },
                "required": ["organization"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_provider_health",
            "description": "Get health status for all external providers (Tavily, Serper, ScrapeGraphAI, BetterContact, LLM).",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_campaigns",
            "description": "List or search multi-step outreach campaigns by name, status, or industry.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "status": {"type": "string"},
                    "industry": {"type": "string"},
                    "limit": {"type": "integer", "default": 10},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_campaign_replies",
            "description": "Get all contacts who replied to outreach campaigns — prospects needing immediate attention.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_next_best_action",
            "description": "Get the single highest-priority next best action across the entire commercial funnel.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_campaign_roi",
            "description": "Get the full commercial ROI funnel for a specific campaign: leads → sent → opened → replied → meetings → opportunities → proposals → won → revenue.",
            "parameters": {
                "type": "object",
                "properties": {
                    "campaign_id": {"type": "integer"},
                },
                "required": ["campaign_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_demos",
            "description": "Search demo records by status or outcome.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string"},
                    "outcome": {"type": "string"},
                    "limit": {"type": "integer", "default": 10},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_negotiations",
            "description": "Search negotiation records by status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string"},
                    "limit": {"type": "integer", "default": 10},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_tasks",
            "description": "Search BD tasks by status or priority.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string"},
                    "priority": {"type": "string"},
                    "limit": {"type": "integer", "default": 10},
                },
            },
        },
    },
]


TOOL_REGISTRY: dict[str, Callable] = {
    "get_dashboard_summary": tools.get_dashboard_summary,
    "get_attention_items": tools.get_attention_items,
    "search_organizations": tools.search_organizations,
    "discover_organizations": tools.discover_web,
    "get_organization_360": tools.get_organization_360_briefing,
    "search_contacts": tools.search_contacts,
    "find_decision_makers": tools.find_decision_makers,
    "get_pipeline_summary": tools.get_pipeline_summary,
    "get_stage_organizations": tools.get_stage_organizations,
    "search_opportunities": tools.search_opportunities,
    "search_meetings": tools.search_meetings,
    "search_followups": tools.search_followups,
    "get_meeting_preparation": tools.get_meeting_preparation_briefing,
    "get_organization_timeline": tools.get_organization_global_timeline,
    "search_projects": tools.search_projects,
    "search_partnerships": tools.search_partnerships,
    "get_funnel_reports": tools.get_funnel_reports,
    "search_customers": tools.search_customers,
    "search_proposals": tools.search_proposals,
    "discover_web": tools.discover_web,
    "discover_qualified": tools.discover_qualified,
    "research_organization": tools.research_organization_tool,
    "qualify_organization": tools.qualify_organization_tool,
    "get_research_brief": tools.get_research_brief,
    "discover_decision_makers": tools.discover_decision_makers_tool,
    "get_discovery_analytics": tools.get_discovery_analytics_tool,
    "enrich_contacts": tools.enrich_contacts_tool,
    "get_provider_health": tools.get_provider_health_tool,
    "get_organization_map_data": tools.get_organization_map_data,
    "get_calendar_events": tools.get_calendar_events,
    # Newly wired campaign & pipeline tools
    "search_campaigns": tools.search_campaigns_tool,
    "get_campaign_replies": tools.get_campaign_replies_tool,
    "get_next_best_action": tools.get_next_best_action_tool,
    "get_campaign_roi": tools.get_campaign_roi_tool,
    "search_demos": tools.search_demos,
    "search_negotiations": tools.search_negotiations,
    "search_tasks": tools.search_tasks,
}


def execute_tool(db: Session, name: str, arguments: dict, user: Any = None) -> dict:
    if name not in TOOL_REGISTRY:
        return {"error": f"Unknown tool: {name}"}
    func = TOOL_REGISTRY[name]
    try:
        import inspect
        sig = inspect.signature(func)
        call_args = dict(arguments)
        if "user" in sig.parameters and user is not None and "user" not in call_args:
            call_args["user"] = user
        result = func(db, **call_args)
        if result is None:
            return {"result": None}
        if isinstance(result, dict):
            return result
        if isinstance(result, list):
            return {"items": result, "count": len(result)}
        return {"result": result}
    except TypeError as e:
        return {"error": f"Tool argument error: {e}"}
    except Exception as e:
        return {"error": f"Tool execution error: {e}"}
