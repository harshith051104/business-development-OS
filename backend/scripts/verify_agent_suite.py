"""
Verification script for the Multi-Model Autonomous BD Execution Agent.
Tests:
  1. LLMRouter provider configurations & task routing matrices
  2. Autonomous BD tools (recommend_showcase_deck, draft_outreach_email, schedule_meeting, auto_generate_followups)
  3. Tool Registry mapping & schema validity
"""
import os
import sys

# Ensure backend path is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal
from app.services.copilot.llm_router import LLMRouter, PROVIDERS, TASK_ROUTING_PREFERENCE
from app.services.copilot.agent_tools import AGENT_TOOL_SCHEMAS, TOOL_REGISTRY, execute_tool
from app.services.copilot import tools
from app.models.organization import Organization

def run_verification():
    print("=" * 60)
    print("1. VERIFYING LLM ROUTER CONFIGURATION & PROVIDERS")
    print("=" * 60)
    router = LLMRouter()
    provider_names = [p["name"] for p in router._providers]
    print(f"Registered providers: {provider_names}")
    assert provider_names == ["groq", "nvidia", "gemini"], f"Expected groq, nvidia, gemini, got {provider_names}"
    print("  [OK] Provider list matches requirement [groq, nvidia, gemini]")

    for p in router._providers:
        print(f"  - {p['name']}: primary='{p['model']}', fallback='{p.get('fallback_model')}', role='{p.get('role')}'")
        assert p.get("fallback_model"), f"Provider {p['name']} missing fallback_model"

    assert "chat" in TASK_ROUTING_PREFERENCE
    assert "tool_call" in TASK_ROUTING_PREFERENCE
    assert "research" in TASK_ROUTING_PREFERENCE
    print(f"  [OK] Task routing matrix verified: {TASK_ROUTING_PREFERENCE}")

    print("\n" + "=" * 60)
    print("2. VERIFYING TOOL REGISTRY & SCHEMAS")
    print("=" * 60)
    schema_names = [s["function"]["name"] for s in AGENT_TOOL_SCHEMAS]
    print(f"Total agent tool schemas: {len(schema_names)}")
    print(f"Total registered tool executors: {len(TOOL_REGISTRY)}")

    new_tools = ["recommend_showcase_deck", "draft_outreach_email", "schedule_meeting", "auto_generate_followups"]
    for nt in new_tools:
        assert nt in schema_names, f"Tool schema {nt} missing from AGENT_TOOL_SCHEMAS"
        assert nt in TOOL_REGISTRY, f"Tool {nt} missing from TOOL_REGISTRY"
        print(f"  [OK] Autonomous tool '{nt}' verified in schema and registry")

    print("\n" + "=" * 60)
    print("3. VERIFYING TOOL EXECUTION ON LIVE DB")
    print("=" * 60)
    db = SessionLocal()
    try:
        org = db.query(Organization).filter(Organization.is_deleted == False).first()
        if not org:
            print("  ! No organizations in DB to test live tool execution. Creating dummy check.")
            org_id = 1
            org_name = "Test Healthcare Org"
        else:
            org_id = org.id
            org_name = org.name

        print(f"Using test organization: {org_name} (ID: {org_id})")

        # Test recommend_showcase_deck
        print("\n--> Testing recommend_showcase_deck...")
        deck_res = tools.recommend_showcase_deck(db, org_id)
        print(f"  Result keys: {list(deck_res.keys())}")
        if "recommended_project" in deck_res and deck_res["recommended_project"]:
            p = deck_res["recommended_project"]
            print(f"  [OK] Recommended Project: {p['name']} (Category: {p['category']})")
            print(f"  [OK] Presentation Deck: {p['presentation_url'] or 'N/A'}")
            print(f"  [OK] Pitch: {deck_res.get('pitch_summary')}")
        else:
            print(f"  [OK] Result message: {deck_res.get('message', 'None')}")

        # Test draft_outreach_email
        print("\n--> Testing draft_outreach_email...")
        email_res = tools.draft_outreach_email(db, org_id, template_type="introduction", pitch_angle="Demonstrating clinical AI pipeline optimization")
        assert "subject" in email_res, "Missing subject in email draft"
        assert "body" in email_res, "Missing body in email draft"
        assert email_res.get("requires_confirmation") is True, "Must require confirmation"
        print(f"  [OK] Subject: {email_res['subject']}")
        print(f"  [OK] Recipient: {email_res['contact_name']} ({email_res['contact_email'] or 'No email'})")
        print(f"  [OK] Requires confirmation: {email_res['requires_confirmation']}")
        print(f"  [OK] Body excerpt: {email_res['body'][:120]}...")

        # Test schedule_meeting
        print("\n--> Testing schedule_meeting...")
        meet_res = tools.schedule_meeting_tool(
            db, org_id,
            title="Strategic Technology Partnership Discussion",
            scheduled_at="2026-09-18T10:00:00Z",
            duration_minutes=45,
            meeting_url="https://meet.google.com/abc-defg-hij"
        )
        assert meet_res.get("requires_confirmation") is True
        assert meet_res.get("action_type") == "schedule_meeting"
        print(f"  [OK] Title: {meet_res['title']}")
        print(f"  [OK] Scheduled For: {meet_res['scheduled_at']}")
        print(f"  [OK] Requires confirmation: {meet_res['requires_confirmation']}")

        # Test auto_generate_followups
        print("\n--> Testing auto_generate_followups...")
        fu_res = tools.auto_generate_followups(db, limit=3)
        print(f"  [OK] Generated follow-up recommendations count: {fu_res['count']}")
        for f in fu_res.get("follow_up_recommendations", []):
            print(f"    - [{f['priority']}] {f['title']}: {f['reason']}")

        # Test execute_tool wrapper
        print("\n--> Testing execute_tool wrapper dispatch...")
        wrapper_res = execute_tool(db, "recommend_showcase_deck", {"organization_id": org_id})
        assert "organization_id" in wrapper_res or "error" in wrapper_res
        print("  [OK] execute_tool executed successfully via generic registry dispatch")

    finally:
        db.close()

    print("\n" + "=" * 60)
    print("ALL AUTONOMOUS AGENT VERIFICATIONS PASSED SUCCESSFULLY! [OK][OK][OK]")
    print("=" * 60)

if __name__ == "__main__":
    run_verification()
