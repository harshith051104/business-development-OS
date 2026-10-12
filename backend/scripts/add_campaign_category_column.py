"""
One-off migration: adds Campaign.category (default 'client') to an existing DB.

This app has no Alembic — app/main.py only runs Base.metadata.create_all, which
creates missing tables but never alters existing ones. Run this once after pulling
the funding-module change, before using the new Funding campaigns.

    python scripts/add_campaign_category_column.py
"""
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings  # noqa: E402

DB_URL = settings.DATABASE_URL


def main():
    if not DB_URL.startswith("sqlite"):
        print(f"DATABASE_URL is not SQLite ({DB_URL}); run the equivalent ALTER TABLE "
              f"manually for your database engine: "
              f"ALTER TABLE campaigns ADD COLUMN category VARCHAR(50) DEFAULT 'client';")
        return

    db_path = DB_URL.split("sqlite:///")[-1]
    conn = sqlite3.connect(db_path)
    try:
        cols = [row[1] for row in conn.execute("PRAGMA table_info(campaigns)").fetchall()]
        if "category" in cols:
            print("campaigns.category already exists — nothing to do.")
            return
        conn.execute("ALTER TABLE campaigns ADD COLUMN category VARCHAR(50) DEFAULT 'client'")
        conn.execute("UPDATE campaigns SET category = 'client' WHERE category IS NULL")
        conn.commit()
        print("Added campaigns.category (default 'client').")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
