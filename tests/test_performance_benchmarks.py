import time
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.models.organization import Organization, ConnectionStatus, PriorityLevel
from app.models.contact import Contact
from app.models.opportunity import Opportunity, OpportunityStage, OpportunityPriority


def get_token(client: TestClient, email: str = "bd@test.local") -> str:
    res = client.post("/auth/login", json={"email": email, "password": "password123"})
    return res.json()["access_token"]


def test_pagination_and_search_performance_with_bulk_dataset(client: TestClient, db_session: Session):
    """
    Validates API performance, pagination, search filtering, and query response time with bulk data.
    """
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Bulk insert test organizations
    orgs = []
    now = datetime.now(timezone.utc)
    for i in range(150):
        orgs.append(
            Organization(
                name=f"Performance Test Healthcare Center {i:04d}",
                organization_type="Hospital" if i % 2 == 0 else "Diagnostic Center",
                city="Bengaluru" if i % 3 == 0 else "Mumbai",
                state="Karnataka" if i % 3 == 0 else "Maharashtra",
                status=ConnectionStatus.CONNECTED.value if i % 4 == 0 else ConnectionStatus.POTENTIAL.value,
                priority=PriorityLevel.HIGH.value if i % 2 == 0 else PriorityLevel.MEDIUM.value,
                is_deleted=False,
                created_at=now - timedelta(days=i),
                updated_at=now,
            )
        )
    db_session.bulk_save_objects(orgs)
    db_session.commit()

    # 2. Test paginated listing response time
    t0 = time.perf_counter()
    list_res = client.get("/api/business-development/organizations?page=1&page_size=25", headers=headers)
    t1 = time.perf_counter()
    elapsed_list_ms = (t1 - t0) * 1000

    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] >= 150
    assert len(list_data["items"]) == 25
    # Performance requirement: under 300ms for paginated list
    assert elapsed_list_ms < 500, f"Paginated listing took {elapsed_list_ms:.2f}ms"

    # 3. Test indexed text search query
    t0 = time.perf_counter()
    search_res = client.get("/api/business-development/organizations?search=Center 0050", headers=headers)
    t1 = time.perf_counter()
    elapsed_search_ms = (t1 - t0) * 1000

    assert search_res.status_code == 200
    search_data = search_res.json()
    assert search_data["total"] >= 1
    assert "0050" in search_data["items"][0]["name"]
    assert elapsed_search_ms < 500, f"Search took {elapsed_search_ms:.2f}ms"

    # 4. Test multi-criteria filter query
    t0 = time.perf_counter()
    filter_res = client.get(
        "/api/business-development/organizations?organization_type=Hospital&city=Bengaluru&priority=High",
        headers=headers,
    )
    t1 = time.perf_counter()
    elapsed_filter_ms = (t1 - t0) * 1000

    assert filter_res.status_code == 200
    assert elapsed_filter_ms < 500, f"Filtered query took {elapsed_filter_ms:.2f}ms"

    # 5. Test Analytics Aggregation performance
    t0 = time.perf_counter()
    analytics_res = client.get("/api/business-development/analytics/overview", headers=headers)
    t1 = time.perf_counter()
    elapsed_analytics_ms = (t1 - t0) * 1000

    assert analytics_res.status_code == 200
    assert elapsed_analytics_ms < 800, f"Analytics query took {elapsed_analytics_ms:.2f}ms"

    # 6. Test CSV Export streaming performance
    t0 = time.perf_counter()
    export_res = client.get("/api/business-development/analytics/export", headers=headers)
    t1 = time.perf_counter()
    elapsed_export_ms = (t1 - t0) * 1000

    assert export_res.status_code == 200
    assert "text/csv" in export_res.headers["content-type"]
    assert elapsed_export_ms < 1000, f"CSV export took {elapsed_export_ms:.2f}ms"
