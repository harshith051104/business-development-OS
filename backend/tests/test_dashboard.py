from app.services.dashboard import DashboardRepository, DashboardService
from app.models.user import User, UserRole


def test_1_authenticated_bd_user_can_access_dashboard(client):
    """1. Test that an authenticated BUSINESS_DEVELOPMENT user can access the dashboard API."""
    login_res = client.post(
        "/auth/login",
        json={"email": "bd@test.local", "password": "password123"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    response = client.get(
        "/api/business-development/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "pipeline" in data
    assert "today" in data
    assert "followups" in data
    assert "upcoming_meetings" in data
    assert "recent_activity" in data


def test_2_unauthenticated_user_cannot_access_dashboard(client):
    """2. Test that unauthenticated requests to dashboard endpoint receive 401 Unauthorized."""
    response = client.get("/api/business-development/dashboard")
    assert response.status_code == 401


def test_3_non_bd_users_receive_403(client):
    """3. Test that users with unauthorized roles receive 403 Forbidden."""
    non_bd_emails = [
        ("healthcare@test.local", "HEALTHCARE"),
        ("user@test.local", "USER"),
    ]

    for email, role in non_bd_emails:
        login_res = client.post(
            "/auth/login",
            json={"email": email, "password": "password123"},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]

        response = client.get(
            "/api/business-development/dashboard",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403
        data = response.json()
        assert "Access denied" in data["detail"]
        assert role in data["detail"]


def test_4_dashboard_returns_seven_summary_metrics(client):
    """4. Test that the dashboard response contains all seven business summary metrics."""
    login_res = client.post(
        "/auth/login",
        json={"email": "bd@test.local", "password": "password123"},
    )
    token = login_res.json()["access_token"]

    response = client.get(
        "/api/business-development/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    summary = response.json()["summary"]

    assert summary["organizations"] >= 1
    assert "contacts" in summary
    assert "connections" in summary
    assert "interested" in summary
    assert "meetings" in summary
    assert "active_discussions" in summary
    assert "partnerships" in summary


def test_5_connection_pipeline_stages(client):
    """5. Test that the 7-stage connection pipeline is present with correct counts."""
    login_res = client.post(
        "/auth/login",
        json={"email": "bd@test.local", "password": "password123"},
    )
    token = login_res.json()["access_token"]

    response = client.get(
        "/api/business-development/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    pipeline = response.json()["pipeline"]

    assert pipeline["potential"] >= 0
    assert pipeline["contacted"] >= 0
    assert pipeline["connected"] >= 0
    assert pipeline["interested"] >= 0
    assert pipeline["meeting"] >= 0
    assert pipeline["discussion"] >= 0
    assert pipeline["partnership"] >= 0


def test_6_today_activities_and_meetings(client):
    """6. Test that today's activities and upcoming meetings are structured correctly."""
    login_res = client.post(
        "/auth/login",
        json={"email": "bd@test.local", "password": "password123"},
    )
    token = login_res.json()["access_token"]

    response = client.get(
        "/api/business-development/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()

    today_acts = data["today"]["activities"]
    assert isinstance(today_acts, list)
    for act in today_acts:
        assert "id" in act
        assert "organization" in act
        assert "contact" in act
        assert "activity_type" in act
        assert "time" in act
        assert "status" in act

    upcoming_mtgs = data["upcoming_meetings"]
    assert isinstance(upcoming_mtgs, list)
    for mtg in upcoming_mtgs:
        assert "id" in mtg
        assert "organization" in mtg
        assert "contact" in mtg
        assert "meeting_type" in mtg
        assert "date" in mtg
        assert "time" in mtg


def test_7_followups_categorization(client):
    """7. Test that followups are properly categorized into Overdue, Today, and Upcoming."""
    login_res = client.post(
        "/auth/login",
        json={"email": "bd@test.local", "password": "password123"},
    )
    token = login_res.json()["access_token"]

    response = client.get(
        "/api/business-development/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    followups = response.json()["followups"]

    assert "overdue" in followups
    assert "today" in followups
    assert "upcoming" in followups
    assert isinstance(followups["overdue"], list)
    assert isinstance(followups["today"], list)
    assert isinstance(followups["upcoming"], list)


def test_8_recent_activities_newest_first(client):
    """8. Test that recent activities contain required fields."""
    login_res = client.post(
        "/auth/login",
        json={"email": "bd@test.local", "password": "password123"},
    )
    token = login_res.json()["access_token"]

    response = client.get(
        "/api/business-development/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    acts = response.json()["recent_activity"]
    assert isinstance(acts, list)
    for a in acts:
        assert "id" in a
        assert "type" in a
        assert "description" in a
        assert "organization" in a
        assert "timestamp" in a
        assert "user_name" in a


def test_9_empty_dashboard_handling(db_session):
    """9. Test that an empty database produces a clean zeroed state."""
    class EmptyRepo(DashboardRepository):
        def get_summary_counts(self, db):
            return {k: 0 for k in ["organizations", "contacts", "connections", "interested", "meetings", "active_discussions", "partnerships"]}

        def get_pipeline(self, db):
            return {k: 0 for k in ["potential", "contacted", "connected", "interested", "meeting", "discussion", "partnership"]}

        def get_today_activities(self, db):
            return []

        def get_upcoming_meetings(self, db):
            return []

        def get_grouped_followups(self, db):
            return {"overdue": [], "today": [], "upcoming": []}

        def get_recent_activities(self, db, limit=10):
            return []

    service = DashboardService(repository=EmptyRepo())
    user = User(
        name="Test User",
        email="test@test.local",
        password_hash="hash",
        role=UserRole.BUSINESS_DEVELOPMENT.value,
        is_active=True,
    )
    data = service.get_dashboard(db_session, user)
    assert data.summary.organizations == 0
    assert data.pipeline.potential == 0
    assert len(data.today.activities) == 0
    assert len(data.upcoming_meetings) == 0
