import os
import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.organization import (
    Organization,
    OrganizationType,
    ConnectionStatus,
    PriorityLevel,
)
from app.models.project import Project, ProjectCategory, ProjectStatus
from app.main import app

TEST_DB_FILE = "test_bd.db"
TEST_DATABASE_URL = f"sqlite:///./{TEST_DB_FILE}"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def seed_test_data(db):
    # 1. Seed Users
    users = [
        User(
            name="BD Test User",
            email="bd@test.local",
            password_hash=hash_password("password123"),
            role=UserRole.BUSINESS_DEVELOPMENT.value,
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        ),
        User(
            name="Healthcare Test User",
            email="healthcare@test.local",
            password_hash=hash_password("password123"),
            role=UserRole.HEALTHCARE.value,
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        ),
        User(
            name="Standard Test User",
            email="user@test.local",
            password_hash=hash_password("password123"),
            role=UserRole.USER.value,
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        ),
        User(
            name="Admin Test User",
            email="admin@test.local",
            password_hash=hash_password("password123"),
            role=UserRole.ADMIN.value,
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        ),
        User(
            name="Inactive BD User",
            email="inactive_bd@test.local",
            password_hash=hash_password("password123"),
            role=UserRole.BUSINESS_DEVELOPMENT.value,
            is_active=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        ),
    ]
    db.add_all(users)

    # 2. Seed Initial Pipeline Organizations for Testing
    # Pipeline stages: 34 Potential, 21 Contacted, 15 Connected, 10 Interested, 8 Meeting, 5 Discussion, 2 Partnership = 95 total
    org_distribution = [
        ("Potential", 34),
        ("Contacted", 21),
        ("Connected", 15),
        ("Interested", 10),
        ("Meeting", 8),
        ("Discussion", 5),
        ("Partnership", 2),
    ]

    org_list = []
    counter = 1
    for stg, count in org_distribution:
        for i in range(count):
            org_list.append(
                Organization(
                    name=f"Test Healthcare Entity {counter}",
                    organization_type="Hospital",
                    city="Hyderabad" if counter % 2 == 0 else "Bangalore",
                    state="Telangana" if counter % 2 == 0 else "Karnataka",
                    country="India",
                    status=stg,
                    priority="High" if counter % 3 == 0 else "Medium",
                    is_deleted=False,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
            )
            counter += 1

    db.add_all(org_list)

    # 3. Seed Showcase Projects for Testing
    projects = [
        Project(
            name="ELLY Hospital Intelligence Platform",
            slug="elly-hospital-intelligence-platform",
            short_description="AI-powered hospital intelligence ecosystem for acute clinical decision support.",
            description="Comprehensive hospital intelligence platform overview for executive stakeholders.",
            category=ProjectCategory.HEALTHCARE.value,
            status=ProjectStatus.ACTIVE.value,
            demo_url="https://demo.ellyhealth.local/platform",
            website_url="https://www.ellyhealth.local",
            key_features=["Bed Management", "Decision Support", "Workflow Optimization"],
            business_value={
                "problem_solved": "Emergency bottlenecks and fragmented clinical silos.",
                "target_audience": "Hospital Directors and CIOs.",
                "value_proposition": "Reduces turnaround times by 28%.",
                "target_organizations": "Tertiary Care Hospitals.",
            },
            business_use_cases=[
                {
                    "title": "Hospital-Wide Bed Management",
                    "description": "Predictively forecast bed vacancies 4-8 hours in advance.",
                }
            ],
            tags=["Healthcare", "Artificial Intelligence", "Hospital", "Clinical"],
            sort_order=1,
            is_featured=True,
            is_deleted=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        ),
        Project(
            name="OmniConnect Health Communication Suite",
            slug="omniconnect-health-communication-suite",
            short_description="Automated omni-channel patient engagement platform.",
            description="Enterprise patient messaging and specialist coordination platform.",
            category=ProjectCategory.COMMUNICATION.value,
            status=ProjectStatus.ACTIVE.value,
            demo_url="https://demo.ellyhealth.local/omniconnect",
            tags=["Communication", "Automation", "Messaging"],
            sort_order=2,
            is_featured=True,
            is_deleted=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        ),
    ]
    db.add_all(projects)
    db.commit()

    # 4. Seed Contacts, Meetings, and Follow-ups for Testing
    from app.models.contact import Contact
    from app.models.meeting import Meeting, MeetingType, MeetingStatus
    from app.models.followup import FollowUp, FollowUpPriority, FollowUpStatus

    c1 = Contact(
        organization_id=1,
        first_name="Sangita",
        last_name="Reddy",
        designation="Joint Managing Director",
        email="sangita.reddy@apollo.test",
        phone="+91 40 2360 8888",
        is_decision_maker=True,
        is_primary_contact=True,
        connection_status="Connected",
        is_deleted=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    c2 = Contact(
        organization_id=2,
        first_name="Ashutosh",
        last_name="Raghuvanshi",
        designation="MD & CEO",
        email="dr.ashutosh@fortis.test",
        phone="+91 124 4921050",
        is_decision_maker=True,
        is_primary_contact=True,
        connection_status="Interested",
        is_deleted=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add_all([c1, c2])
    db.commit()

    m1 = Meeting(
        organization_id=1,
        primary_contact_id=c1.id,
        contact_ids=[c1.id],
        title="ELLY Platform Executive Showcase",
        meeting_type=MeetingType.PROJECT_SHOWCASE.value,
        scheduled_at=datetime(2026, 8, 25, 11, 0, 0, tzinfo=timezone.utc),
        duration_minutes=45,
        status=MeetingStatus.SCHEDULED.value,
        agenda="1. Platform Overview\n2. Q&A",
        is_deleted=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(m1)

    f1 = FollowUp(
        organization_id=1,
        contact_id=c1.id,
        title="Send ELLY Platform Whitepaper",
        due_at=datetime(2026, 8, 18, 17, 0, 0, tzinfo=timezone.utc),  # Overdue
        priority=FollowUpPriority.HIGH.value,
        status=FollowUpStatus.PENDING.value,
        is_deleted=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    f2 = FollowUp(
        organization_id=2,
        contact_id=c2.id,
        title="Follow up on preliminary terms",
        due_at=datetime(2026, 8, 28, 15, 0, 0, tzinfo=timezone.utc),  # Upcoming
        priority=FollowUpPriority.MEDIUM.value,
        status=FollowUpStatus.PENDING.value,
        is_deleted=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add_all([f1, f2])

    # Seed templates for testing
    from app.models.outreach import OutreachTemplate
    t1 = OutreachTemplate(
        name="General Company Introduction",
        category="Introduction",
        channel="Email",
        subject="Introduction to ELLY",
        body="Hello {{contact_name}}, reaching out regarding {{organization_name}}.",
        is_active=True,
    )
    t2 = OutreachTemplate(
        name="Executive Meeting Request",
        category="Meeting Request",
        channel="Email",
        subject="Meeting Request: {{project_name}}",
        body="Dear {{contact_name}}, let's meet to discuss {{project_name}}.",
        is_active=True,
    )
    db.add_all([t1, t2])
    db.commit()


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    
    db = TestingSessionLocal()
    seed_test_data(db)
    db.close()
    
    yield
    
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
