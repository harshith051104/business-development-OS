from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text
import logging

from app.core.config import settings
from app.core.database import Base, engine, get_db
from app.routers.auth import router as auth_router
from app.routers.business_development import router as bd_router
from app.routers.organizations import router as organizations_router
from app.routers.contacts import router as contacts_router
from app.routers.showcase import router as showcase_router
from app.routers.meetings import router as meetings_router
from app.routers.followups import router as followups_router
from app.routers.opportunities import router as opportunities_router
from app.routers.connections import router as connections_router
from app.routers.communications import router as communications_router
from app.routers.analytics import router as analytics_router
from app.routers.audit import router as audit_router
from app.routers.discovery import router as discovery_router
from app.routers.outreach import router as outreach_router
from app.routers.partnerships import router as partnerships_router
from app.routers.admin import router as admin_router
from app.routers.copilot import router as copilot_router
from app.routers.daily_priorities import router as daily_priorities_router
from app.routers.customers import router as customers_router
from app.routers.demos import router as demos_router
from app.routers.proposals import router as proposals_router
from app.routers.negotiations import router as negotiations_router
from app.routers.tasks import router as tasks_router
from app.routers.calls import router as calls_router
from app.routers.integrations import router as integrations_router
from app.routers.reports import router as reports_router
from app.routers.geocoding import router as geocoding_router
from app.routers.calendar import router as calendar_router
from app.routers.config import router as config_router
from app.routers.gmail import router as gmail_router
from app.routers.campaigns import router as campaigns_router

import app.models.user  # noqa: F401
import app.models.organization  # noqa: F401
import app.models.contact  # noqa: F401
import app.models.activity  # noqa: F401
import app.models.project  # noqa: F401
import app.models.meeting  # noqa: F401
import app.models.followup  # noqa: F401
import app.models.opportunity  # noqa: F401
import app.models.communication  # noqa: F401
import app.models.audit  # noqa: F401
import app.models.discovery  # noqa: F401
import app.models.outreach  # noqa: F401
import app.models.partnership  # noqa: F401
import app.models.setting  # noqa: F401
import app.models.copilot  # noqa: F401
import app.models.customer  # noqa: F401
import app.models.demo  # noqa: F401
import app.models.proposal  # noqa: F401
import app.models.negotiation  # noqa: F401
import app.models.task  # noqa: F401
import app.models.campaign  # noqa: F401

logger = logging.getLogger("elly.bd_portal")

# Create tables
Base.metadata.create_all(bind=engine)

# Ensure newly added SQLite columns exist on existing databases
try:
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(organizations)"))
        existing_cols = [row[1] for row in result.fetchall()]
        changed = False
        org_cols_needed = [
            ("owner_id", "INTEGER"),
            ("latitude", "REAL"),
            ("longitude", "REAL"),
            ("location_precision", "VARCHAR(50)"),
            ("location_source", "VARCHAR(50)"),
            ("country", "VARCHAR(100)"),
            ("industry", "VARCHAR(100)"),
            ("size", "VARCHAR(50)"),
            ("is_deleted", "BOOLEAN DEFAULT 0"),
        ]
        for col_name, col_type in org_cols_needed:
            if existing_cols and col_name not in existing_cols:
                conn.execute(text(f"ALTER TABLE organizations ADD COLUMN {col_name} {col_type}"))
                changed = True
        if changed:
            conn.commit()

        # Check contacts columns
        c_result = conn.execute(text("PRAGMA table_info(contacts)"))
        c_cols = [row[1] for row in c_result.fetchall()]
        if c_cols:
            c_changed = False
            for col_name, col_type in [
                ("owner_id", "INTEGER"),
                ("preferred_channel", "VARCHAR(50) DEFAULT 'Email'"),
                ("do_not_contact", "BOOLEAN DEFAULT 0"),
                ("first_contacted_at", "DATETIME"),
                ("last_contacted_at", "DATETIME"),
                ("next_followup_at", "DATETIME"),
                ("is_deleted", "BOOLEAN DEFAULT 0"),
            ]:
                if col_name not in c_cols:
                    conn.execute(text(f"ALTER TABLE contacts ADD COLUMN {col_name} {col_type}"))
                    c_changed = True
            if c_changed:
                conn.commit()

        # Check discovered_organizations columns
        disc_result = conn.execute(text("PRAGMA table_info(discovered_organizations)"))
        disc_cols = [row[1] for row in disc_result.fetchall()]
        if disc_cols:
            disc_changed = False
            if "product_description" not in disc_cols:
                conn.execute(text("ALTER TABLE discovered_organizations ADD COLUMN product_description TEXT"))
                disc_changed = True
            if "target_icp" not in disc_cols:
                conn.execute(text("ALTER TABLE discovered_organizations ADD COLUMN target_icp TEXT"))
                disc_changed = True
            if "discovery_objective" not in disc_cols:
                conn.execute(text("ALTER TABLE discovered_organizations ADD COLUMN discovery_objective TEXT"))
                disc_changed = True
            if "potential_fit_score" not in disc_cols:
                conn.execute(text("ALTER TABLE discovered_organizations ADD COLUMN potential_fit_score INTEGER DEFAULT 75"))
                disc_changed = True
            if "matched_existing_org_id" not in disc_cols:
                conn.execute(text("ALTER TABLE discovered_organizations ADD COLUMN matched_existing_org_id INTEGER"))
                disc_changed = True
            if disc_changed:
                conn.commit()

        # Check discovery_search_history columns
        hist_result = conn.execute(text("PRAGMA table_info(discovery_search_history)"))
        hist_cols = [row[1] for row in hist_result.fetchall()]
        if hist_cols:
            hist_changed = False
            if "product_description" not in hist_cols:
                conn.execute(text("ALTER TABLE discovery_search_history ADD COLUMN product_description TEXT"))
                hist_changed = True
            if "target_icp" not in hist_cols:
                conn.execute(text("ALTER TABLE discovery_search_history ADD COLUMN target_icp TEXT"))
                hist_changed = True
            if "discovery_objective" not in hist_cols:
                conn.execute(text("ALTER TABLE discovery_search_history ADD COLUMN discovery_objective TEXT"))
                hist_changed = True
            if "provider_used" not in hist_cols:
                conn.execute(text("ALTER TABLE discovery_search_history ADD COLUMN provider_used VARCHAR(100) DEFAULT 'Curated Directory'"))
                hist_changed = True
            if "contacts_found" not in hist_cols:
                conn.execute(text("ALTER TABLE discovery_search_history ADD COLUMN contacts_found INTEGER DEFAULT 0"))
                hist_changed = True
            if hist_changed:
                conn.commit()
except Exception as e:
    logger.error("Startup schema migration failed — database may be in an inconsistent state: %s", e)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Internal Business Development Portal API for ELLY Intelligence Platform outreach.",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
        except Exception as exc:
            logger.error("Unhandled exception reaching middleware on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
            response = JSONResponse(
                status_code=500,
                content={"detail": "Internal server error.", "path": request.url.path},
            )
        response.headers["X-Content-Type-Options"] = "nosniff"
        if request.url.path.startswith("/api/uploads") or request.url.path.startswith("/uploads"):
            # Allow uploaded presentation decks and media to be rendered inside our frontend viewer
            response.headers["X-Frame-Options"] = "SAMEORIGIN"
            response.headers["Content-Security-Policy"] = "frame-ancestors 'self' http://localhost:* http://127.0.0.1:*"
        else:
            response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Persistent rate limiter for Gmail send endpoints (DB-backed, survives restart)
from datetime import datetime, timezone, timedelta
from app.core.database import SessionLocal as _RateLimitSession
from app.models.audit import GmailRateLimit

class GmailRateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/api/gmail/send" and request.method == "POST":
            client_ip = request.client.host if request.client else "unknown"
            now = datetime.now(timezone.utc)
            one_hour_ago = now - timedelta(hours=1)

            db = _RateLimitSession()
            try:
                # Delete expired records and count current window
                db.query(GmailRateLimit).filter(
                    GmailRateLimit.sent_at < one_hour_ago
                ).delete()
                db.commit()

                current_count = db.query(GmailRateLimit).filter(
                    GmailRateLimit.ip_address == client_ip,
                    GmailRateLimit.sent_at >= one_hour_ago,
                ).count()

                if current_count >= settings.GMAIL_RATE_LIMIT_PER_HOUR:
                    return JSONResponse(
                        status_code=429,
                        content={"detail": f"Rate limit exceeded. Max {settings.GMAIL_RATE_LIMIT_PER_HOUR} emails per hour."},
                    )

                # Record this send attempt
                record = GmailRateLimit(ip_address=client_ip, sent_at=now)
                db.add(record)
                db.commit()
            finally:
                db.close()
        return await call_next(request)

app.add_middleware(GmailRateLimitMiddleware)

from app.core.middleware import RateLimitMiddleware
app.add_middleware(RateLimitMiddleware, requests_per_minute=120)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include core routers
app.include_router(auth_router)
app.include_router(bd_router)
app.include_router(organizations_router)
app.include_router(contacts_router)
app.include_router(showcase_router)
app.include_router(meetings_router)
app.include_router(followups_router)
app.include_router(opportunities_router)
app.include_router(connections_router)
app.include_router(communications_router)
app.include_router(analytics_router)
app.include_router(audit_router)
app.include_router(discovery_router)
app.include_router(outreach_router)
app.include_router(partnerships_router)
app.include_router(admin_router)
app.include_router(copilot_router)
app.include_router(daily_priorities_router)
app.include_router(customers_router)
app.include_router(demos_router)
app.include_router(proposals_router)
app.include_router(negotiations_router)
app.include_router(tasks_router)
app.include_router(calls_router)
app.include_router(integrations_router)
app.include_router(reports_router)
app.include_router(geocoding_router)
app.include_router(calendar_router)
app.include_router(config_router)
app.include_router(gmail_router)
app.include_router(campaigns_router)

# Mount uploads directory for showcase pitch decks, documents, and media
import os
from fastapi.staticfiles import StaticFiles

uploads_path = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads"))
os.makedirs(os.path.join(uploads_path, "presentations"), exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=uploads_path), name="api_uploads")
app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error.", "path": request.url.path},
    )


@app.get("/", tags=["Root"])
def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "phase": "PHASE 14 — Admin & Business Development Team Management",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    from app.core.database import SessionLocal as _SL
    db = _SL()
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        logger.warning("Health check DB probe failed: %s", e)
    finally:
        db.close()
    return {
        "status": "ok" if db_ok else "degraded",
        "service": "elly-bd-portal-api",
        "version": settings.APP_VERSION,
        "database": "ok" if db_ok else "unavailable",
    }


@app.get("/ready", tags=["Health"])
def readiness():
    from app.core.database import SessionLocal as _SL
    db = _SL()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready", "service": "elly-bd-portal-api"}
    except Exception as exc:
        logger.error("Readiness probe failed: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "error": "Database connection unavailable"},
        )
    finally:
        db.close()
