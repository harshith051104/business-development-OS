"""
ELLY BD OS — Database Reset Script

Removes ALL test data. Keeps only user accounts and ELLY showcase projects.
Run this before first real usage.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine, Base
from app.models.organization import Organization
from app.models.contact import Contact
from app.models.opportunity import Opportunity
from app.models.meeting import Meeting
from app.models.demo import Demo
from app.models.proposal import Proposal
from app.models.negotiation import Negotiation
from app.models.customer import Customer
from app.models.followup import FollowUp
from app.models.communication import Communication
from app.models.campaign import Campaign, CampaignContact
from app.models.partnership import Partnership
from app.models.activity import ContactActivity
from app.models.discovery import DiscoveredOrganization, DiscoveredContact, DiscoverySearchHistory
from app.models.audit import AuditLog, GmailRateLimit
from app.models.copilot import CopilotConfirmationAction
from app.models.project import Project
from app.models.user import User


# Tables to wipe (in order to respect FK constraints)
TABLES_TO_WIPE = [
    CopilotConfirmationAction,
    GmailRateLimit,
    AuditLog,
    CampaignContact,
    Campaign,
    Communication,
    FollowUp,
    Demo,
    Negotiation,
    Proposal,
    Meeting,
    Opportunity,
    Customer,
    Partnership,
    ContactActivity,
    Contact,
    DiscoveredContact,
    DiscoveredOrganization,
    DiscoverySearchHistory,
    Organization,
]

# Tables to KEEP
# - User (we want to keep login accounts)
# - Project (we want to keep ELLY showcase projects)


def reset_database():
    db = SessionLocal()
    try:
        print("=" * 60)
        print("ELLY BD OS — Database Reset")
        print("=" * 60)

        for model in TABLES_TO_WIPE:
            count = db.query(model).count()
            if count > 0:
                db.query(model).delete()
                db.commit()
                print(f"  Deleted {count} rows from {model.__tablename__}")
            else:
                print(f"  {model.__tablename__}: empty (skipped)")

        users = db.query(User).count()
        projects = db.query(Project).count()
        print(f"\n  Preserved: {users} users, {projects} projects")
        print("=" * 60)
        print("DATABASE CLEAN — Ready for real prospects")
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    confirm = input("This will DELETE all prospect data. Type 'yes' to confirm: ")
    if confirm.strip().lower() == "yes":
        reset_database()
    else:
        print("Aborted.")
