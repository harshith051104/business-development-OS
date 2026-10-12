import contextlib
import logging
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from sqlalchemy.pool import NullPool

from app.core.config import settings

logger = logging.getLogger("elly.database")

# SQLite: use NullPool (no pool_size/max_overflow — SQLite doesn't support them)
# pool_pre_ping validates connections before use (supported on all dialects)
if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 30},
        echo=settings.DEBUG,
        pool_pre_ping=True,
        poolclass=NullPool,
    )

    from sqlalchemy import event

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()
else:
    # PostgreSQL with configurable connection pooling
    engine = create_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        pool_pre_ping=True,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


@contextlib.contextmanager
def db_transaction(db: Session):
    """
    Atomic transaction context manager.
    COMMIT on success, ROLLBACK on any exception, session always cleaned up.
    Usage:
        with db_transaction(db):
            db.add(obj)
            db.commit()  # optional — auto-commits on exit if no prior commit
    """
    committed = False
    try:
        yield db
        if not committed:
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        pass  # session lifecycle managed by FastAPI get_db dependency


def migrate_db_columns():
    """Add missing columns to existing tables for SQLite upgrade path."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(campaign_contacts)"))
            cols = [row[1] for row in result.fetchall()]
            if cols:
                changed = False
                if "opened_at" not in cols:
                    conn.execute(text("ALTER TABLE campaign_contacts ADD COLUMN opened_at DATETIME;"))
                    changed = True
                if "open_count" not in cols:
                    conn.execute(text("ALTER TABLE campaign_contacts ADD COLUMN open_count INTEGER DEFAULT 0;"))
                    changed = True
                if "replied_at" not in cols:
                    conn.execute(text("ALTER TABLE campaign_contacts ADD COLUMN replied_at DATETIME;"))
                    changed = True
                if "whatsapp_message_sent" not in cols:
                    conn.execute(text("ALTER TABLE campaign_contacts ADD COLUMN whatsapp_message_sent BOOLEAN DEFAULT 0;"))
                    changed = True
                if "whatsapp_sent_at" not in cols:
                    conn.execute(text("ALTER TABLE campaign_contacts ADD COLUMN whatsapp_sent_at DATETIME;"))
                    changed = True
                if "whatsapp_invalid_number" not in cols:
                    conn.execute(text("ALTER TABLE campaign_contacts ADD COLUMN whatsapp_invalid_number BOOLEAN DEFAULT 0;"))
                    changed = True
                if "whatsapp_failed_attempts" not in cols:
                    conn.execute(text("ALTER TABLE campaign_contacts ADD COLUMN whatsapp_failed_attempts INTEGER DEFAULT 0;"))
                    changed = True
                if "whatsapp_last_attempt_at" not in cols:
                    conn.execute(text("ALTER TABLE campaign_contacts ADD COLUMN whatsapp_last_attempt_at DATETIME;"))
                    changed = True
                if "linkedin_failed_attempts" not in cols:
                    conn.execute(text("ALTER TABLE campaign_contacts ADD COLUMN linkedin_failed_attempts INTEGER DEFAULT 0;"))
                    changed = True
                if "linkedin_last_attempt_at" not in cols:
                    conn.execute(text("ALTER TABLE campaign_contacts ADD COLUMN linkedin_last_attempt_at DATETIME;"))
                    changed = True
                if "linkedin_unavailable" not in cols:
                    conn.execute(text("ALTER TABLE campaign_contacts ADD COLUMN linkedin_unavailable BOOLEAN DEFAULT 0;"))
                    changed = True
                if changed:
                    conn.commit()

            res_disc = conn.execute(text("PRAGMA table_info(discovered_organizations)"))
            disc_cols = [row[1] for row in res_disc.fetchall()]
            if disc_cols and "search_history_id" not in disc_cols:
                conn.execute(text("ALTER TABLE discovered_organizations ADD COLUMN search_history_id INTEGER;"))
                conn.commit()

            res_camp = conn.execute(text("PRAGMA table_info(campaigns)"))
            camp_cols = [row[1] for row in res_camp.fetchall()]
            camp_changed = False
            if camp_cols and "whatsapp_message_template" not in camp_cols:
                conn.execute(text("ALTER TABLE campaigns ADD COLUMN whatsapp_message_template TEXT;"))
                camp_changed = True
            if camp_cols and "linkedin_connection_note_template" not in camp_cols:
                conn.execute(text("ALTER TABLE campaigns ADD COLUMN linkedin_connection_note_template TEXT;"))
                camp_changed = True
            if camp_cols and "linkedin_first_message_template" not in camp_cols:
                conn.execute(text("ALTER TABLE campaigns ADD COLUMN linkedin_first_message_template TEXT;"))
                camp_changed = True
            if camp_changed:
                conn.commit()
    except Exception as e:
        logger.error("Schema migration failed: %s", e)


migrate_db_columns()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
