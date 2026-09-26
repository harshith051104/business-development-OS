import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.organization import Organization
from app.models.contact import Contact
from app.models.project import Project, ProjectStatus
from app.models.opportunity import Opportunity, OpportunityStage
from app.models.partnership import Partnership, PartnershipStatus
from app.models.meeting import Meeting, MeetingStatus
from app.models.followup import FollowUp, FollowUpStatus
from app.models.communication import Communication, CommunicationChannel, CommunicationDirection
from app.models.discovery import DiscoveredOrganization, DiscoveryStatus


def get_token(client: TestClient, email: str, password: str = "password123") -> str:
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


def test_complete_business_development_e2e_lifecycle(client: TestClient, db_session: Session):
    """
    Complete E2E Business Acceptance Flow:
    1. BD User Login
    2. Discover target organization & save discovery result
    3. Convert discovery item to Organization record
    4. Add Contact (Decision Maker) to Organization
    5. Update Connection pipeline status
    6. Browse Project Showcase & Presentation mode
    7. Schedule a Meeting with contact
    8. Complete Meeting with notes & next steps
    9. Create Follow-up task
    10. Record omni-channel Communication
    11. Create commercial Opportunity
    12. Move Opportunity to Discussion stage
    13. Convert Opportunity to Partnership
    14. Manage Partnership details & assign owner
    15. Verify real Analytics data aggregation
    16. Admin login, project governance, and audit verification
    """

    # ─────────────────────────────────────────────────────────────
    # STEP 1: BD Authentication
    # ─────────────────────────────────────────────────────────────
    bd_token = get_token(client, "bd@test.local", "password123")
    bd_headers = {"Authorization": f"Bearer {bd_token}"}

    me_res = client.get("/auth/me", headers=bd_headers)
    assert me_res.status_code == 200
    bd_user_data = me_res.json()
    assert bd_user_data["email"] == "bd@test.local"
    assert bd_user_data["role"] == "BUSINESS_DEVELOPMENT"

    # ─────────────────────────────────────────────────────────────
    # STEP 2: Discovery Search & Save Discovery Item
    # ─────────────────────────────────────────────────────────────
    disc_search_res = client.post(
        "/api/business-development/discover/search",
        headers=bd_headers,
        json={"keyword": "Hospital", "location": "Bengaluru", "page": 1, "page_size": 10},
    )
    assert disc_search_res.status_code == 200
    discovered_list = disc_search_res.json()["items"]
    assert len(discovered_list) > 0

    target_discovered = discovered_list[0]
    disc_id = target_discovered["id"]

    save_disc_res = client.post(
        f"/api/business-development/discover/{disc_id}/save",
        headers=bd_headers,
    )
    assert save_disc_res.status_code == 200
    assert save_disc_res.json()["status"] == "saved"

    # ─────────────────────────────────────────────────────────────
    # STEP 3: Convert Discovery to Organization
    # ─────────────────────────────────────────────────────────────
    convert_org_res = client.post(
        f"/api/business-development/discover/{disc_id}/add",
        headers=bd_headers,
        json={"priority": "High", "custom_notes": "Added from discovery provider."},
    )
    assert convert_org_res.status_code in [200, 201]
    org_data = convert_org_res.json()
    org_id = org_data["id"]
    assert org_data["name"] == target_discovered["name"]

    # ─────────────────────────────────────────────────────────────
    # STEP 4: Add Contact to Organization
    # ─────────────────────────────────────────────────────────────
    unique_suffix = int(datetime.now(timezone.utc).timestamp() * 1000) % 1000000
    contact_res = client.post(
        f"/api/business-development/contacts",
        headers=bd_headers,
        json={
            "first_name": "Dr. Vikram",
            "last_name": f"Malhotra_{unique_suffix}",
            "designation": "Chief Operating Officer",
            "department": "Executive Leadership",
            "email": f"vikram.malhotra.{unique_suffix}@e2e-hospital.example.com",
            "phone": f"+91 987{unique_suffix:06d}",
            "is_primary_contact": True,
            "is_decision_maker": True,
            "organization_id": org_id,
            "notes": "Key sponsor for technology modernization.",
        },
    )
    assert contact_res.status_code == 201
    contact_data = contact_res.json()
    contact_id = contact_data["id"]
    assert contact_data["first_name"] == "Dr. Vikram"
    assert contact_data["is_decision_maker"] is True

    # ─────────────────────────────────────────────────────────────
    # STEP 5: Update Pipeline Status
    # ─────────────────────────────────────────────────────────────
    status_update_res = client.patch(
        f"/api/business-development/organizations/{org_id}/status",
        headers=bd_headers,
        json={"status": "Connected", "notes": "Connected with COO on introductory call."},
    )
    assert status_update_res.status_code == 200
    assert status_update_res.json()["status"] == "Connected"

    # ─────────────────────────────────────────────────────────────
    # STEP 6: Browse Project Showcase & Presentation Details
    # ─────────────────────────────────────────────────────────────
    showcase_res = client.get("/api/business-development/showcase", headers=bd_headers)
    assert showcase_res.status_code == 200
    projects = showcase_res.json()["items"]
    assert len(projects) > 0
    selected_project = projects[0]
    proj_id = selected_project["id"]

    # Verify project detail query
    proj_detail_res = client.get(f"/api/business-development/showcase/{proj_id}", headers=bd_headers)
    assert proj_detail_res.status_code == 200
    assert "name" in proj_detail_res.json()

    # ─────────────────────────────────────────────────────────────
    # STEP 7: Schedule Meeting
    # ─────────────────────────────────────────────────────────────
    meeting_time = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    meeting_res = client.post(
        "/api/business-development/meetings",
        headers=bd_headers,
        json={
            "title": "Hospital Automation & Presentation Review",
            "meeting_type": "Product Demo",
            "scheduled_at": meeting_time,
            "duration_minutes": 45,
            "location": "Virtual / Video Conference",
            "meeting_url": "https://meet.example.com/elly-apex",
            "organization_id": org_id,
            "contact_ids": [contact_id],
            "project_id": proj_id,
            "agenda": "Demonstrate platform architecture and integration feasibility.",
        },
    )
    assert meeting_res.status_code == 201
    meeting_data = meeting_res.json()
    meeting_id = meeting_data["id"]
    assert meeting_data["title"] == "Hospital Automation & Presentation Review"

    # ─────────────────────────────────────────────────────────────
    # STEP 8: Complete Meeting & Record Minutes
    # ─────────────────────────────────────────────────────────────
    complete_meeting_res = client.post(
        f"/api/business-development/meetings/{meeting_id}/complete",
        headers=bd_headers,
        json={
            "notes": "Dr. Vikram was very impressed by the showcase. Requested proposal for strategic alliance.",
            "next_actions": "Submit formal partnership proposal and commercial proposal.",
        },
    )
    assert complete_meeting_res.status_code == 200
    assert complete_meeting_res.json()["status"] == "Completed"

    # ─────────────────────────────────────────────────────────────
    # STEP 9: Create Follow-up Task
    # ─────────────────────────────────────────────────────────────
    due_date = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    followup_res = client.post(
        "/api/business-development/followups",
        headers=bd_headers,
        json={
            "title": "Send Partnership MoU & Scope Deck",
            "due_at": due_date,
            "priority": "High",
            "organization_id": org_id,
            "contact_id": contact_id,
            "description": "Include technical deployment timeline and service tiering.",
        },
    )
    assert followup_res.status_code == 201
    followup_id = followup_res.json()["id"]

    # ─────────────────────────────────────────────────────────────
    # STEP 10: Record Communication
    # ─────────────────────────────────────────────────────────────
    comm_res = client.post(
        "/api/business-development/communications",
        headers=bd_headers,
        json={
            "channel": "Email",
            "direction": "Outgoing",
            "subject": "Follow-up: ELLY Partnership Proposal & Next Steps",
            "content": "Dear Dr. Vikram, Thank you for the insightful discussion today. Attached is our proposal.",
            "organization_id": org_id,
            "contact_id": contact_id,
            "communication_date": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert comm_res.status_code == 201
    comm_id = comm_res.json()["id"]

    # ─────────────────────────────────────────────────────────────
    # STEP 11: Create Commercial Opportunity
    # ─────────────────────────────────────────────────────────────
    opp_res = client.post(
        "/api/business-development/opportunities",
        headers=bd_headers,
        json={
            "name": "Apex Hospital Strategic Integration",
            "organization_id": org_id,
            "primary_contact_id": contact_id,
            "project_id": proj_id,
            "stage": "Potential",
            "priority": "High",
            "estimated_value": 750000.0,
            "probability": 70,
            "expected_close_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "next_action": "Review commercial terms with legal team.",
        },
    )
    assert opp_res.status_code == 201
    opp_data = opp_res.json()
    opp_id = opp_data["id"]
    assert opp_data["estimated_value"] == 750000.0

    # ─────────────────────────────────────────────────────────────
    # STEP 12: Move Opportunity to Discussion Stage
    # ─────────────────────────────────────────────────────────────
    opp_stage_res = client.patch(
        f"/api/business-development/opportunities/{opp_id}/stage",
        headers=bd_headers,
        json={"stage": "Discussion"},
    )
    assert opp_stage_res.status_code == 200
    assert opp_stage_res.json()["stage"] == "Discussion"

    # ─────────────────────────────────────────────────────────────
    # STEP 13: Convert Opportunity to Partnership
    # ─────────────────────────────────────────────────────────────
    convert_part_res = client.post(
        f"/api/business-development/opportunities/{opp_id}/convert-to-partnership",
        headers=bd_headers,
        json={
            "name": "Apex Healthcare Strategic Alliance",
            "partnership_type": "Strategic Partnership",
            "start_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "commercial_value": 750000.0,
            "objectives": "Deploy enterprise infrastructure across all locations.",
        },
    )
    assert convert_part_res.status_code == 201
    part_data = convert_part_res.json()
    partnership_id = part_data["id"]
    assert part_data["name"] == "Apex Healthcare Strategic Alliance"
    assert part_data["status"] == "Active"

    # ─────────────────────────────────────────────────────────────
    # STEP 14: Manage Partnership Details
    # ─────────────────────────────────────────────────────────────
    part_detail_res = client.get(
        f"/api/business-development/partnerships/{partnership_id}",
        headers=bd_headers,
    )
    assert part_detail_res.status_code == 200
    assert part_detail_res.json()["organization_id"] == org_id
    assert part_detail_res.json()["primary_contact_id"] == contact_id

    # ─────────────────────────────────────────────────────────────
    # STEP 15: Verify Real Analytics Aggregation
    # ─────────────────────────────────────────────────────────────
    analytics_res = client.get("/api/business-development/analytics/overview", headers=bd_headers)
    assert analytics_res.status_code == 200
    summary = analytics_res.json()["overview"]
    assert summary["total_organizations"] >= 1
    assert summary["total_contacts"] >= 1
    assert summary["partnerships_established"] >= 1

    # ─────────────────────────────────────────────────────────────
    # STEP 16: Admin Governance & Security Audit
    # ─────────────────────────────────────────────────────────────
    admin_token = get_token(client, "admin@test.local", "password123")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Verify admin dashboard stats reflect newly added records
    admin_dash_res = client.get("/api/admin/dashboard", headers=admin_headers)
    assert admin_dash_res.status_code == 200
    dash_data = admin_dash_res.json()
    assert dash_data["active_organizations"] >= 1
    assert dash_data["active_partnerships"] >= 1

    # Verify audit logs captured transactions
    audit_res = client.get("/api/admin/audit-logs", headers=admin_headers)
    assert audit_res.status_code == 200
    assert audit_res.json()["total"] > 0

    # Verify BD user is blocked from Admin Console APIs
    bd_admin_attempt = client.get("/api/admin/dashboard", headers=bd_headers)
    assert bd_admin_attempt.status_code == 403
