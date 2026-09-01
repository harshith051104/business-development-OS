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
        connect_args={"check_same_thread": False},
        echo=settings.DEBUG,
        pool_pre_ping=True,
        poolclass=NullPool,
    )
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
                if changed:
                    conn.commit()
    except Exception as e:
        logger.error("Schema migration (campaign_contacts) failed: %s", e)


migrate_db_columns()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
