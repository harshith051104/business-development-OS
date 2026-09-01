import pytest
from datetime import datetime, timezone
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


def test_1_bd_user_can_access_analytics(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/analytics/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "overview" in data
    assert "pipeline" in data
    assert "conversion_rates" in data
    assert "meetings" in data
    assert "followups" in data
    assert "opportunities" in data
    assert "communications" in data
    assert "attention_required" in data


def test_2_non_bd_user_receives_403(client: TestClient):
    token = get_non_bd_token(client)
    res = client.get(
        "/api/business-development/analytics/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_3_unauthenticated_user_receives_401(client: TestClient):
    res = client.get("/api/business-development/analytics/overview")
    assert res.status_code == 401


def test_4_overview_metrics_are_correct(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/analytics/overview?date_range=all_time",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    overview = res.json()["overview"]
    assert overview["total_organizations"] >= 1
    assert overview["total_contacts"] >= 1
    assert overview["total_connections"] >= 0
    assert overview["total_meetings"] >= 0
    assert overview["active_opportunities"] >= 0


def test_5_pipeline_counts_and_percentages(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/analytics/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    pipeline = res.json()["pipeline"]
    assert len(pipeline) == 7
    stages = [p["stage"] for p in pipeline]
    assert stages == [
        "Potential",
        "Contacted",
        "Connected",
        "Interested",
        "Meeting",
        "Discussion",
        "Partnership",
    ]
    # Sum of percentages should be approximately 100%
    total_pct = sum(p["percentage"] for p in pipeline)
    assert 99.0 <= total_pct <= 101.0


def test_6_conversion_rates_calculations(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/analytics/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    conversions = res.json()["conversion_rates"]
    assert "contacted_to_connected" in conversions
    assert "connected_to_interested" in conversions
    assert "interested_to_meeting" in conversions
    assert "meeting_to_discussion" in conversions
    assert "discussion_to_partnership" in conversions
    assert "overall_funnel" in conversions

    for key, item in conversions.items():
        assert "from_stage" in item
        assert "to_stage" in item
        if item["is_sufficient_data"]:
            assert isinstance(item["rate"], (int, float))
            assert 0 <= item["rate"] <= 100
        else:
            assert item["rate"] is None


def test_7_date_filtering_works(client: TestClient):
    token = get_bd_token(client)
    # Test this_month vs today
    res_month = client.get(
        "/api/business-development/analytics/overview?date_range=this_month",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_month.status_code == 200

    res_today = client.get(
        "/api/business-development/analytics/overview?date_range=today",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_today.status_code == 200
    assert res_today.json()["date_range"] == "today"


def test_8_meeting_analytics(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/analytics/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    mtg = res.json()["meetings"]
    assert "total" in mtg
    assert "completed" in mtg
    assert "scheduled" in mtg
    assert "cancelled" in mtg
    assert mtg["total"] == mtg["completed"] + mtg["scheduled"] + mtg["cancelled"] + mtg["rescheduled"]


def test_9_followup_analytics(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/analytics/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    fol = res.json()["followups"]
    assert "total" in fol
    assert "completed" in fol
    assert "overdue" in fol
    assert "pending" in fol
    assert "completion_rate" in fol


def test_10_opportunity_analytics(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/analytics/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    opps = res.json()["opportunities"]
    assert "active" in opps
    assert "high_priority" in opps
    assert "no_next_action" in opps
    assert "stage_distribution" in opps


def test_11_communication_analytics(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/analytics/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    comms = res.json()["communications"]
    assert "total" in comms
    assert "channel_counts" in comms
    assert "direction_counts" in comms


def test_12_team_performance_operational_visibility(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/analytics/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    team = res.json()["team_performance"]
    assert isinstance(team, list)
    assert len(team) >= 1
    assert "name" in team[0]
    assert "organizations_added" in team[0]


def test_13_attention_required_calculations(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/analytics/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    attention = res.json()["attention_required"]
    assert "overdue_followups_count" in attention
    assert "opportunities_no_next_action_count" in attention
    assert "interested_no_meeting_count" in attention
    assert "stale_organizations_count" in attention
    assert isinstance(attention["overdue_followups"], list)
    assert isinstance(attention["opportunities_no_next_action"], list)


def test_14_stale_accounts_detection(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/analytics/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    stale = res.json()["attention_required"]["stale_organizations"]
    assert isinstance(stale, list)
    if len(stale) > 0:
        assert "days_since_last_activity" in stale[0]
        assert stale[0]["days_since_last_activity"] >= 0


def test_15_estimated_value_handling(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/analytics/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    opps = res.json()["opportunities"]
    if opps["has_financial_data"]:
        assert opps["total_estimated_value"] > 0
    else:
        assert opps["total_estimated_value"] is None


def test_16_csv_export_endpoint(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/analytics/export?date_range=this_month",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "attachment; filename=" in res.headers.get("content-disposition", "")
    content = res.text
    assert "ELLY INTERNAL BUSINESS DEVELOPMENT REPORT" in content
    assert "EXECUTIVE OVERVIEW METRICS" in content
    assert "CONNECTION PIPELINE DISTRIBUTION" in content
    assert "STAGE CONVERSION EFFICIENCY" in content


def test_17_non_bd_cannot_access_csv_export(client: TestClient):
    token = get_non_bd_token(client)
    res = client.get(
        "/api/business-development/analytics/export",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403
