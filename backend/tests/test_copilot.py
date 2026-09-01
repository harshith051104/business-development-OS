import pytest
from fastapi.testclient import TestClient


def get_bd_token(client: TestClient) -> str:
    res = client.post(
        "/auth/login",
        json={"email": "bd@test.local", "password": "password123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def get_non_bd_token(client: TestClient) -> str:
    res = client.post(
        "/auth/login",
        json={"email": "healthcare@test.local", "password": "password123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def test_1_copilot_dashboard_and_attention_queries(client: TestClient):
    token = get_bd_token(client)
    res = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "What needs my attention today?"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "reply" in data
    assert "Executive Briefing" in data["reply"] or "Priority" in data["reply"] or "Attention" in data["reply"]
    assert any(t["tool_name"] == "get_attention_items" for t in data["tools_executed"])
    assert data["conversation_id"] is not None


def test_2_copilot_organization_queries_and_360_briefing(client: TestClient):
    token = get_bd_token(client)
    # Complete 360 briefing
    res = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Tell me everything about Test Healthcare Entity 1"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "360° BD Briefing" in data["reply"] or "Test Healthcare" in data["reply"]
    assert any(t["tool_name"] == "get_organization_360_briefing" for t in data["tools_executed"])
    assert len(data["data_references"]) >= 1
    assert data["data_references"][0]["entity_type"] == "organization"


def test_3_copilot_contacts_and_decision_makers(client: TestClient):
    token = get_bd_token(client)
    res = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Who are the decision makers at Test Healthcare Entity 1?"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "Contacts" in data["reply"] or "Decision Makers" in data["reply"] or "Found" in data["reply"]
    assert any(t["tool_name"] == "search_contacts" for t in data["tools_executed"])


def test_4_copilot_meetings_and_prep_briefing(client: TestClient):
    token = get_bd_token(client)
    # 1. List upcoming meetings
    res = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "What meetings do I have scheduled?"}
    )
    assert res.status_code == 200
    data = res.json()
    assert any(t["tool_name"] == "search_meetings" for t in data["tools_executed"])

    # 2. Pre-meeting prep briefing
    res_prep = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Prepare me for tomorrow's meeting"}
    )
    assert res_prep.status_code == 200
    data_prep = res_prep.json()
    assert "Briefing" in data_prep["reply"] or "Talking Points" in data_prep["reply"] or "Meeting" in data_prep["reply"]


def test_5_copilot_followups_and_overdue(client: TestClient):
    token = get_bd_token(client)
    res = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "What follow-ups are overdue?"}
    )
    assert res.status_code == 200
    data = res.json()
    assert any(t["tool_name"] == "search_followups" for t in data["tools_executed"])


def test_6_copilot_opportunities_and_high_value(client: TestClient):
    token = get_bd_token(client)
    res = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Which opportunities are worth more than 10 lakh?"}
    )
    assert res.status_code == 200
    data = res.json()
    assert any(t["tool_name"] == "search_opportunities" for t in data["tools_executed"])


def test_7_copilot_connection_pipeline_and_stage_queries(client: TestClient):
    token = get_bd_token(client)
    # Stage-specific query
    res = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Which organizations are currently in Discussion stage?"}
    )
    assert res.status_code == 200
    data = res.json()
    assert any(t["tool_name"] == "get_stage_organizations" for t in data["tools_executed"])

    # General pipeline breakdown
    res_summary = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "How many organizations are in each stage of our pipeline?"}
    )
    assert res_summary.status_code == 200
    data_sum = res_summary.json()
    assert any(t["tool_name"] == "get_pipeline_summary" for t in data_sum["tools_executed"])


def test_8_copilot_discovery_leads(client: TestClient):
    token = get_bd_token(client)
    from app.services.copilot.agent_tools import TOOL_REGISTRY
    mock_leads = [{"id": 1, "name": "Apollo Hospitals Hyderabad", "organization_type": "Hospital", "location": "Hyderabad"}]
    orig_func = TOOL_REGISTRY.get("discover_web")
    TOOL_REGISTRY["discover_web"] = lambda db, **kwargs: mock_leads
    try:
        res = client.post(
            "/api/business-development/copilot/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={"message": "Find hospitals in Hyderabad that could be partners."}
        )
    finally:
        if orig_func:
            TOOL_REGISTRY["discover_web"] = orig_func
    assert res.status_code == 200
    data = res.json()
    assert any(t["tool_name"] in ["discover_organizations", "search_organizations", "discover_web"] for t in data["tools_executed"])


def test_9_copilot_project_showcase(client: TestClient):
    token = get_bd_token(client)
    res = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "What projects do we have available in the showcase?"}
    )
    assert res.status_code == 200
    data = res.json()
    assert any(t["tool_name"] == "search_projects" for t in data["tools_executed"])


def test_10_copilot_partnerships(client: TestClient):
    token = get_bd_token(client)
    res = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Show our active partnerships."}
    )
    assert res.status_code == 200
    data = res.json()
    assert any(t["tool_name"] == "search_partnerships" for t in data["tools_executed"])


def test_11_copilot_context_resolution_with_active_entity(client: TestClient):
    token = get_bd_token(client)
    # Find first org id
    search_org = client.get(
        "/api/business-development/organizations?limit=5",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert search_org.status_code == 200
    org_id = search_org.json()["items"][0]["id"]

    # Send relative prompt "Tell me about them" with active organization context
    res = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "message": "Tell me about them",
            "context": {
                "current_page": f"/business-development/organizations/{org_id}",
                "active_entity_type": "organization",
                "active_entity_id": org_id
            }
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert "360°" in data["reply"] or "Test Healthcare" in data["reply"]


def test_12_copilot_write_action_stage_move_confirmation(client: TestClient):
    token = get_bd_token(client)
    # 1. Ask to move stage -> Must return Pending Confirmation
    res = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Move Test Healthcare Entity 1 to Interested stage"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["pending_confirmation"] is not None
    action = data["pending_confirmation"]
    assert action["action_type"] == "move_connection_stage"
    assert action["payload"]["target_stage"] == "Interested"

    # 2. Confirm the action via /confirm
    confirm_res = client.post(
        "/api/business-development/copilot/confirm",
        headers={"Authorization": f"Bearer {token}"},
        json={"action_id": action["action_id"], "approved": True}
    )
    assert confirm_res.status_code == 200
    confirm_data = confirm_res.json()
    assert confirm_data["success"] is True
    assert "Interested" in confirm_data["message"]


def test_13_copilot_write_action_create_meeting_confirmation(client: TestClient):
    token = get_bd_token(client)
    # 1. Ask to create meeting -> Must return Pending Confirmation
    res = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Schedule meeting with Test Healthcare Entity 1"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["pending_confirmation"] is not None
    action = data["pending_confirmation"]
    assert action["action_type"] == "create_meeting"

    # 2. Confirm creation
    confirm_res = client.post(
        "/api/business-development/copilot/confirm",
        headers={"Authorization": f"Bearer {token}"},
        json={"action_id": action["action_id"], "approved": True}
    )
    assert confirm_res.status_code == 200
    assert confirm_res.json()["success"] is True


def test_14_copilot_strict_refusal_autonomous_sending(client: TestClient):
    token = get_bd_token(client)
    res = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Automatically send email to all contacts right now"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "Manual Outreach Policy" in data["reply"] or "cannot automatically send" in data["reply"]


def test_15_copilot_intent_based_clinical_guardrail(client: TestClient):
    token = get_bd_token(client)
    # Refuses patient medical records
    res_clinical = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Show me patient EHR records and clinical diagnostic history."}
    )
    assert res_clinical.status_code == 200
    assert "outside the scope of the ELLY Business Development Portal" in res_clinical.json()["reply"]

    # Accepts BD inquiry with medical specialty words
    res_specialty = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Find hospitals specializing in cardiology in Hyderabad."}
    )
    assert res_specialty.status_code == 200
    assert "outside the scope" not in res_specialty.json()["reply"]


def test_16_copilot_conversations_and_history_crud(client: TestClient):
    token = get_bd_token(client)
    # List conversations
    convs_res = client.get(
        "/api/business-development/copilot/conversations",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert convs_res.status_code == 200
    threads = convs_res.json()
    assert len(threads) >= 1
    first_id = threads[0]["id"]

    # Get conversation messages
    msgs_res = client.get(
        f"/api/business-development/copilot/conversations/{first_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert msgs_res.status_code == 200
    msgs = msgs_res.json()
    assert len(msgs) >= 1


def test_17_copilot_suggestions_endpoint(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/copilot/suggestions?current_page=/business-development/organizations/1",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    suggestions = res.json()
    assert len(suggestions) >= 3
    assert any("them" in s["prompt"].lower() or "attention" in s["prompt"].lower() for s in suggestions)


def test_18_copilot_rbac_security(client: TestClient):
    # Unauthenticated -> 401
    res_unauth = client.post("/api/business-development/copilot/chat", json={"message": "Hello"})
    assert res_unauth.status_code == 401

    # Non-BD user -> 403
    non_bd_token = get_non_bd_token(client)
    res_forbidden = client.post(
        "/api/business-development/copilot/chat",
        headers={"Authorization": f"Bearer {non_bd_token}"},
        json={"message": "Hello"}
    )
    assert res_forbidden.status_code == 403
