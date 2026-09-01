"""
ELLY BD OS — Production Seed Script

Creates only the admin user and first BD user from environment variables.
All test/mock data has been removed.

Usage:
  python seed.py                      # Create admin + BD user from defaults
  ADMIN_EMAIL=you@company.com ADMIN_PASSWORD=yourpass python seed.py
"""
import sys
import os
import getpass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timezone
from app.core.database import SessionLocal, Base, engine
from app.core.security import hash_password
from app.models.user import User, UserRole

Base.metadata.create_all(bind=engine)


def create_user(db, name: str, email: str, password: str, role: UserRole) -> User:
    """Create user if not exists."""
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        print(f"  [SKIP] User {email} already exists (role={existing.role})")
        return existing
    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
        role=role.value,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"  [OK] Created {role.value} user: {email} (id={user.id})")
    return user


def seed():
    db = SessionLocal()
    try:
        print("=" * 60)
        print("ELLY BD OS — Production Seed")
        print("=" * 60)

        # Admin user
        admin_email = os.environ.get("ADMIN_EMAIL", "admin@ellybd.com")
        admin_password = os.environ.get("ADMIN_PASSWORD")
        if not admin_password:
            admin_password = getpass.getpass(f"Password for {admin_email}: ")

        admin = create_user(
            db,
            name="Admin",
            email=admin_email,
            password=admin_password,
            role=UserRole.ADMIN,
        )

        # BD user
        bd_email = os.environ.get("BD_EMAIL", "bd@ellybd.com")
        bd_password = os.environ.get("BD_PASSWORD")
        if not bd_password:
            bd_password = getpass.getpass(f"Password for {bd_email}: ")

        bd = create_user(
            db,
            name="BD Rep",
            email=bd_email,
            password=bd_password,
            role=UserRole.BUSINESS_DEVELOPMENT,
        )

        print("\n" + "=" * 60)
        print("SEED COMPLETE")
        print("=" * 60)
        print(f"  Admin:  {admin.email}")
        print(f"  BD:     {bd.email}")
        print("\nNext steps:")
        print("  1. Start the backend:  uvicorn app.main:app --reload")
        print("  2. Login and use Discovery to find prospects")
        print("  3. Connect Gmail OAuth for real email sending")
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    seed()
