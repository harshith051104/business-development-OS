import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient


def get_bd_token(client: TestClient) -> str:
    res = client.post(
        "/auth/login",
        json={"email": "bd@test.local", "password": "password123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def test_1_end_to_end_commercial_lifecycle(client: TestClient):
    """
    Test Complete 10-Stage Commercial Funnel:
    Find -> Research -> Contact -> Email/Call -> Meeting -> Demo -> Proposal -> Negotiation -> Customer
    """
    token = get_bd_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. FIND & ADD TO CRM (External Leads Ingestion with Duplicate Prevention)
    res_ingest = client.post(
        "/api/business-development/integrations/ingest",
        headers=headers,
        json={
            "source_system": "Marketing",
            "organization_name": "Apollo Global Institute of Health",
            "organization_type": "Hospital Group",
            "city": "Hyderabad",
            "state": "Telangana",
            "website": "https://apolloglobal.example.com",
            "contact_name": "Dr. Rajesh Sharma",
            "contact_role": "Chief Technology Officer",
            "contact_email": "rajesh.sharma@apolloglobal.example.com",
            "contact_phone": "+91 9876543210",
            "lead_score": 92,
            "campaign_name": "Healthcare AI Summit 2026",
            "notes": "Interested in ELLY clinical intelligence platform integration."
        }
    )
    assert res_ingest.status_code == 201
    ingest_data = res_ingest.json()
    org_id = ingest_data["organization_id"]
    contact_id = ingest_data["contact_id"]
    assert org_id is not None
    assert contact_id is not None

    # 2. RESEARCH 360° VIEW
    res_org = client.get(f"/api/business-development/organizations/{org_id}", headers=headers)
    assert res_org.status_code == 200
    org_data = res_org.json()
    assert org_data["name"] == "Apollo Global Institute of Health"
    assert org_data["status"] == "New"

    # 3. DRAFT EMAIL & HUMAN SEND CONFIRMATION
    res_draft = client.post(
        "/api/business-development/outreach/drafts",
        headers=headers,
        json={
            "organization_id": org_id,
            "contact_id": contact_id,
            "channel": "Email",
            "subject": "Transforming Healthcare Operations with ELLY AI Platform",
            "message": "Dear Dr. Sharma, Following our connection at the Healthcare AI Summit, I would like to showcase ELLY.",
        }
    )
    assert res_draft.status_code == 201
    draft_id = res_draft.json()["id"]

    # Explicit human action: Send / Record Email
    res_send = client.post(
        "/api/business-development/outreach/record",
        headers=headers,
        json={
            "organization_id": org_id,
            "contact_id": contact_id,
            "draft_id": draft_id,
            "channel": "Email",
            "summary": "Platform intro email sent to Dr. Rajesh Sharma",
            "notes": "Dear Dr. Sharma, Following our connection at the Healthcare AI Summit...",
            "update_organization_status": True,
            "new_organization_status": "Contacted"
        }
    )
    assert res_send.status_code == 200
    assert res_send.json()["organization_id"] == org_id

    # 4. LOG OUTGOING CALL
    res_call = client.post(
        "/api/business-development/calls",
        headers=headers,
        json={
            "organization_id": org_id,
            "contact_id": contact_id,
            "outcome": "Interested",
            "notes": "Dr. Sharma confirmed high interest in an AI demonstration.",
            "next_action": "Schedule presentation demo",
            "schedule_followup": True,
            "followup_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        }
    )
    assert res_call.status_code == 201
    assert res_call.json()["channel"] == "Phone"

    # Verify stage moved to Responded
    res_org_after_call = client.get(f"/api/business-development/organizations/{org_id}", headers=headers)
    assert res_org_after_call.json()["status"] == "Responded"

    # 5. SCHEDULE MEETING
    res_meeting = client.post(
        "/api/business-development/meetings",
        headers=headers,
        json={
            "organization_id": org_id,
            "primary_contact_id": contact_id,
            "title": "Platform Intro Meeting with Dr. Sharma",
            "meeting_type": "Virtual",
            "scheduled_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "agenda": "Review enterprise platform architecture and deployment models."
        }
    )
    assert res_meeting.status_code in [200, 201]
    meeting_id = res_meeting.json()["id"]

    # 6. SCHEDULE & COMPLETE DEMO
    res_demo = client.post(
        "/api/business-development/demos",
        headers=headers,
        json={
            "organization_id": org_id,
            "meeting_id": meeting_id,
            "primary_contact_id": contact_id,
            "title": "ELLY Platform Technical Demonstration",
            "scheduled_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "participants": "Dr. Rajesh Sharma (CTO), Head of Digital Innovation",
            "customer_requirements": "High availability, integration with hospital billing and PACS."
        }
    )
    assert res_demo.status_code == 201
    demo_id = res_demo.json()["id"]

    # Complete demo with outcome Proposal Requested
    res_demo_complete = client.put(
        f"/api/business-development/demos/{demo_id}",
        headers=headers,
        json={
            "status": "Completed",
            "outcome": "Proposal Requested",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "demo_notes": "Attendees were impressed. Requested a commercial proposal for 500 beds."
        }
    )
    assert res_demo_complete.status_code == 200
    assert res_demo_complete.json()["outcome"] == "Proposal Requested"

    # 7. CREATE PROPOSAL
    res_prop = client.post(
        "/api/business-development/proposals",
        headers=headers,
        json={
            "organization_id": org_id,
            "primary_contact_id": contact_id,
            "title": "Apollo Global Enterprise Platform License v1.0",
            "version": "v1.0",
            "value": 1500000.0,
            "currency": "INR",
            "status": "Sent",
            "content_summary": "Comprehensive platform license and 24/7 technical support."
        }
    )
    assert res_prop.status_code == 201
    prop_id = res_prop.json()["id"]
    assert res_prop.json()["value"] == 1500000.0

    # 8. START NEGOTIATION
    res_neg = client.post(
        "/api/business-development/negotiations",
        headers=headers,
        json={
            "organization_id": org_id,
            "proposal_id": prop_id,
            "primary_contact_id": contact_id,
            "title": "Final Terms & Commercial SLA Negotiation",
            "commercial_value": 1400000.0,
            "currency": "INR",
            "status": "Active",
            "key_requirements": "3-year commitment with annual billing.",
            "open_issues": "Payment milestone terms."
        }
    )
    assert res_neg.status_code == 201
    neg_id = res_neg.json()["id"]

    # Agree on negotiation terms
    res_neg_agree = client.put(
        f"/api/business-development/negotiations/{neg_id}",
        headers=headers,
        json={"status": "Agreed", "notes": "Both parties agreed on commercial terms."}
    )
    assert res_neg_agree.status_code == 200

    # 9. CONVERT TO ACTIVE CUSTOMER
    res_convert = client.post(
        "/api/business-development/customers/convert",
        headers=headers,
        json={
            "organization_id": org_id,
            "primary_contact_id": contact_id,
            "contract_value": 1400000.0,
            "currency": "INR",
            "notes": "Enterprise contract finalized for 3-year term."
        }
    )
    assert res_convert.status_code == 201
    cust_data = res_convert.json()
    assert cust_data["status"] == "Active"
    assert cust_data["contract_value"] == 1400000.0

    # 10. VERIFY GLOBAL TIMELINE & CUSTOMER STATUS
    res_org_final = client.get(f"/api/business-development/organizations/{org_id}", headers=headers)
    assert res_org_final.json()["status"] == "Customer"


def test_2_daily_priorities_engine(client: TestClient):
    """Test real-time calculation of daily priorities."""
    token = get_bd_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/business-development/daily-priorities", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_priority_count" in data
    assert "what_should_i_do_next" in data
    assert len(data["all_priority_items"]) >= 0


def test_3_funnel_reports(client: TestClient):
    """Test 10-stage funnel report analytics."""
    token = get_bd_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/business-development/reports/funnel", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_organizations"] > 0
    assert len(data["stages"]) == 10
    assert "lead_source_breakdown" in data
    assert "rep_performance" in data


def test_4_bd_task_management(client: TestClient):
    """Test BD task creation, retrieval, and completion."""
    token = get_bd_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    res_task = client.post(
        "/api/business-development/tasks",
        headers=headers,
        json={
            "title": "Review AI demonstration slides for Fortis Healthcare",
            "priority": "High",
            "status": "Todo",
            "due_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "description": "Ensure cardiology and radiology showcase case studies are included."
        }
    )
    assert res_task.status_code == 201
    task_id = res_task.json()["id"]

    # Mark completed
    res_up = client.put(
        f"/api/business-development/tasks/{task_id}",
        headers=headers,
        json={"status": "Completed"}
    )
    assert res_up.status_code == 200
    assert res_up.json()["status"] == "Completed"


def test_5_copilot_phase17_conversational_workflow(client: TestClient):
    """Test AI Copilot Phase 17 capabilities across new modules."""
    token = get_bd_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Ask for daily priorities
    res1 = client.post(
        "/api/business-development/copilot/chat",
        headers=headers,
        json={"message": "What should I work on today?"}
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert any(t["tool_name"] == "get_attention_items" for t in data1["tools_executed"])

    # 2. Ask for full funnel reports
    res2 = client.post(
        "/api/business-development/copilot/chat",
        headers=headers,
        json={"message": "Show our commercial funnel report"}
    )
    assert res2.status_code == 200
    assert any(t["tool_name"] == "get_funnel_reports" for t in res2.json()["tools_executed"])

    # 3. Ask for customers
    res3 = client.post(
        "/api/business-development/copilot/chat",
        headers=headers,
        json={"message": "Show active customers"}
    )
    assert res3.status_code == 200
    assert any(t["tool_name"] == "search_customers" for t in res3.json()["tools_executed"])

    # 4. Ask for proposals
    res4 = client.post(
        "/api/business-development/copilot/chat",
        headers=headers,
        json={"message": "What proposals are active?"}
    )
    assert res4.status_code == 200
    assert any(t["tool_name"] == "search_proposals" for t in res4.json()["tools_executed"])

    # 5. Write Action: Log call with confirmation
    res5 = client.post(
        "/api/business-development/copilot/chat",
        headers=headers,
        json={"message": "Log a call with Apollo Global Institute of Health"}
    )
    assert res5.status_code == 200
    data5 = res5.json()
    assert data5["pending_confirmation"] is not None
    action_id = data5["pending_confirmation"]["action_id"]

    # Confirm action
    res5_conf = client.post(
        "/api/business-development/copilot/confirm",
        headers=headers,
        json={"action_id": action_id, "approved": True}
    )
    assert res5_conf.status_code == 200
    assert res5_conf.json()["success"] is True


def test_6_external_integrations_status(client: TestClient):
    """Test external integrations clean interface status endpoint."""
    token = get_bd_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/business-development/integrations/status", headers=headers)
    assert res.status_code == 200
    integrations = res.json()
    assert len(integrations) == 4
    names = [i["system_name"] for i in integrations]
    assert "Marketing System Connector" in names
    assert "Events & Conferences Connector" in names
    assert "Growth & Inbound Signals Connector" in names
    assert "Investor & Ecosystem Referral Connector" in names
