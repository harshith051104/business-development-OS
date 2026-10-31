# Executive Report Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a DEV-role-only Copilot tool that generates a CEO-facing team activity/performance report, downloadable as DOCX and PDF from the chat message that produces it.

**Architecture:** New `report_agent_service.py` extracts/extends the existing analytics team-performance query with a period filter and BDTask stats; `report_render_service.py` turns that data into a narrative via the existing `llm_router` with a template-only fallback; `python-docx`/`reportlab` render both files to `backend/reports/`; a new `ReportGeneration` row tracks them; the existing Copilot tool-dispatch/regex-intent/engine pipeline gets one new tool wired through at every layer (schema, registry, intent, engine dispatch, system prompt); a new `require_role("DEV")` download router serves the files; frontend gets a DEV-only chip and download buttons.

**Tech Stack:** FastAPI, SQLAlchemy (no Alembic — startup `ALTER TABLE` migration block), pytest/httpx, python-docx, reportlab, React 19/TS.

**Spec:** `docs/superpowers/specs/2026-10-31-report-agent-design.md`

## Global Constraints

- No Alembic — all schema changes via `app/main.py`'s startup `PRAGMA table_info` / `ALTER TABLE` block, following the existing per-table pattern.
- Reuse `app/services/copilot/llm_router.py`'s existing LLM client — no second LLM client.
- Reuse the existing analytics team-performance query as the single source of truth — do not duplicate it.
- Both DOCX and PDF are always generated together on every run — no "pick one format" option.
- Restricted to `UserRole.DEV` via the existing `require_role(...)` dependency pattern (`app/auth/deps.py`) — non-DEV callers get a friendly refusal, never a stack trace, and no DB row/files are written for them.
- New dependencies limited to `python-docx` and `reportlab` (pure-Python wheels) added to `backend/requirements.txt`.
- `backend/reports/` must be gitignored, same bare-relative style as the existing `backups/` line in `backend/.gitignore`.
- No new ownership/visibility partitioning between DEV accounts — any DEV user can download any report.
- No scheduling/recurring generation — on-demand only.

## Review Focus

- **Non-DEV user calls the tool directly (not via chip):** spec requires a friendly refusal message with no `ReportGeneration` row and no files written — a test must prove nothing lands on disk or in the DB for this path, not just that the message reads as a refusal.
- **Zero users / zero activity in the period:** spec says the report must still generate with a "quiet period" narrative, not an empty or crashing report — a test must call `gather_report_data`/the tool with a period containing no activity and assert both files are still produced.
- **Unrecognized period phrase (e.g. "last fortnight"):** spec requires silent fallback to the 30-day default, not an error — a test must assert the resolver returns the default bounds for a nonsense phrase.
- **Download endpoint with a `report_id` that exists but whose file is missing/deleted from disk:** spec's error table only covers "unknown id" and role; a stale DB row with a missing file must still 404, not 500 — a test must delete/rename a file on disk after creating the row and assert 404.
- **LLM call raising `AllProvidersExhausted` mid-report:** must fall back to the template-only render (headline + metrics table, no prose) rather than propagating the exception up through the tool call — a test must force the LLM stub to raise and assert the tool still returns a successful `report_id` with both files written.

---

## Task 1: `UserRole.DEV` + test fixture

**Files:**
- Modify: `backend/app/models/user.py:7-11`
- Modify: `backend/tests/conftest.py` (seed a DEV user in `seed_test_data`)
- Test: `backend/tests/test_access_control.py`

**Interfaces:**
- Produces: `UserRole.DEV` (value `"DEV"`), usable by every later task's `require_role("DEV")` checks and by tests needing a DEV-authenticated client.

- [ ] **Step 1: Write the failing test**

In `backend/tests/test_access_control.py`, add:

```python
def test_dev_role_login_and_role_value(client, db_session):
    from app.models.user import UserRole
    assert UserRole.DEV.value == "DEV"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_access_control.py::test_dev_role_login_and_role_value -v`
Expected: FAIL with `AttributeError: DEV`

- [ ] **Step 3: Add `DEV = "DEV"` to `UserRole` in `app/models/user.py:7-11`**

- [ ] **Step 4: Seed a DEV test user in `backend/tests/conftest.py`'s `seed_test_data(db)`**

Follow the existing seeded-user pattern in that function (same shape as the existing BD/Healthcare/Standard/Admin/Inactive users: `User(name=..., email=..., hashed_password=..., role=UserRole.DEV.value, is_active=True)`). Use email `dev@elly.test` and a name like `"Dev User"`, committed the same way the other seeded users are.

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest backend/tests/test_access_control.py::test_dev_role_login_and_role_value -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/user.py backend/tests/conftest.py backend/tests/test_access_control.py
git commit -m "feat: add DEV user role"
```

---

## Task 2: `ReportGeneration` model + schema migration

**Files:**
- Create: `backend/app/models/report.py`
- Modify: `backend/app/main.py:70` (model import), `backend/app/main.py:228-237` area (new ALTER block for `copilot_messages.report_ready`, inserted before the `except Exception as e:` at line 249)
- Modify: `backend/.gitignore` (add `reports/`)
- Test: `backend/tests/test_report_agent.py` (new file)

**Interfaces:**
- Produces: `ReportGeneration` model with columns `id, requested_by_id, period_start, period_end, docx_path, pdf_path, created_at`, importable as `from app.models.report import ReportGeneration`.
- Produces: `copilot_messages.report_ready` column (JSON, nullable) for Task 6 to use via SQLAlchemy `Column(JSON, nullable=True)` on `CopilotMessage`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_report_agent.py`:

```python
def test_report_generation_table_exists(db_session):
    from app.models.report import ReportGeneration
    from datetime import datetime, timezone
    row = ReportGeneration(
        requested_by_id=None,
        period_start=datetime.now(timezone.utc),
        period_end=datetime.now(timezone.utc),
        docx_path="x.docx",
        pdf_path="x.pdf",
    )
    db_session.add(row)
    db_session.commit()
    assert row.id is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_report_agent.py::test_report_generation_table_exists -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.models.report'`

- [ ] **Step 3: Create `app/models/report.py`**

Exact model per the spec (copy verbatim):

```python
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.core.database import Base


class ReportGeneration(Base):
    __tablename__ = "report_generations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    requested_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    docx_path = Column(String(500), nullable=False)
    pdf_path = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
```

- [ ] **Step 4: Add `import app.models.report  # noqa: F401` to `app/main.py` after line 70**

- [ ] **Step 5: Add the `copilot_messages.report_ready` migration block to `app/main.py`**

Insert before the `except Exception as e:` currently at line 249, following the exact `PRAGMA table_info` / `ALTER TABLE` / `conn.commit()` shape used by the adjacent `meetings` block (lines 239-248):

```python
        # Check copilot_messages columns (report agent)
        cm_result = conn.execute(text("PRAGMA table_info(copilot_messages)"))
        cm_cols = [row[1] for row in cm_result.fetchall()]
        if cm_cols:
            cm_changed = False
            if "report_ready" not in cm_cols:
                conn.execute(text("ALTER TABLE copilot_messages ADD COLUMN report_ready TEXT"))
                cm_changed = True
            if cm_changed:
                conn.commit()
```

- [ ] **Step 6: Add `reports/` to `backend/.gitignore`**, same bare-relative style as the existing `backups/` line.

- [ ] **Step 7: Run test to verify it passes**

Run: `pytest backend/tests/test_report_agent.py::test_report_generation_table_exists -v`
Expected: PASS

- [ ] **Step 8: Verify the app still wires cleanly**

Run (from `backend/`): `python -c "from app.main import app; print(len(app.routes))"`
Expected: prints a route count, no traceback

- [ ] **Step 9: Commit**

```bash
git add backend/app/models/report.py backend/app/main.py backend/.gitignore backend/tests/test_report_agent.py
git commit -m "feat: add ReportGeneration model and report_ready migration"
```

---

## Task 3: `report_agent_service.py` — metrics gathering

**Files:**
- Create: `backend/app/services/report_agent_service.py`
- Modify: `backend/app/routers/analytics.py:353-377` (replace inline block with a call to the extracted function)
- Test: `backend/tests/test_report_agent.py`

**Interfaces:**
- Consumes: `TeamMemberPerformanceOut` schema (`backend/app/schemas/...`, existing — same fields as used in `analytics.py:365-377`); `User`, `Organization`, `Contact`, `Communication`, `Meeting`, `MeetingStatus`, `Opportunity`, `FollowUp`, `FollowUpStatus` models (existing imports already present in `analytics.py`); `BDTask` model from `app.models.task` (fields: `due_date`, `status`, `assigned_to_id` or equivalent owner field — read `app/models/task.py` for the exact field name before writing the query body).
- Produces:
  - `get_team_performance(db: Session, period_start: datetime, period_end: datetime) -> list[TeamMemberPerformanceOut]` in `report_agent_service.py`, consumed by both `analytics.py` and Task 4's `gather_report_data`.
  - `resolve_period(period_text: str) -> tuple[datetime, datetime]` — maps known phrases ("this week", "last 30 days"/"", "this month", "last quarter") to `(period_start, period_end)` in UTC; any unrecognized phrase (including empty string) returns the last-30-days default. Consumed by Task 5's tool function.
  - `gather_report_data(db: Session, period_start: datetime, period_end: datetime) -> ReportData` — a dataclass (defined in this file) with fields: `period_start: datetime`, `period_end: datetime`, `team: list[TeamMemberPerformanceOut]`, `task_stats: dict[int, dict]` (keyed by user id, each value `{"completed": int, "open": int, "overdue": int}`), `company_totals: dict` (reuse the same headline totals analytics.py already computes — `organizations_added`, `contacts_added`, `communications_recorded`, `meetings_completed`, `followups_completed`, `opportunities_created` — for context). Consumed by Task 4's `report_render_service.py` and Task 5's tool function.

- [ ] **Step 1: Write the failing tests**

```python
def test_resolve_period_defaults_to_30_days_on_unknown_phrase():
    from app.services.report_agent_service import resolve_period
    from datetime import datetime, timezone
    start, end = resolve_period("last fortnight")
    assert (end - start).days == 30

def test_resolve_period_empty_string_defaults_to_30_days():
    from app.services.report_agent_service import resolve_period
    start, end = resolve_period("")
    assert (end - start).days == 30

def test_get_team_performance_filters_by_period(db_session):
    from app.services.report_agent_service import get_team_performance
    from datetime import datetime, timezone, timedelta
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=30)
    result = get_team_performance(db_session, start, end)
    assert isinstance(result, list)

def test_gather_report_data_shape(db_session):
    from app.services.report_agent_service import gather_report_data
    from datetime import datetime, timezone, timedelta
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=30)
    data = gather_report_data(db_session, start, end)
    assert data.period_start == start
    assert data.period_end == end
    assert isinstance(data.team, list)
    assert isinstance(data.task_stats, dict)
    assert isinstance(data.company_totals, dict)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_report_agent.py -k "resolve_period or get_team_performance or gather_report_data" -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Read `backend/app/models/task.py` to confirm `BDTask`'s exact owner/assignee field name and `due_date`/`status` types**, then implement `report_agent_service.py`:

- `get_team_performance`: copy the body from `analytics.py:354-377`, adding `created_at >= period_start` / `created_at <= period_end` filters (matching the style already used in `_get_date_bounds`'s callers at `analytics.py:136-140`) to each of the five per-user sub-queries (`Organization`, `Contact`, `Communication`, `Meeting`, `Opportunity`, `FollowUp` — whichever of these have a `created_at` column; use each model's existing timestamp field).
- `resolve_period`: dict-or-if-chain mapping lowercased, stripped phrase substrings to bound calculations against `datetime.now(timezone.utc)`, mirroring `analytics.py`'s `_get_date_bounds` structure; default branch (including empty/unrecognized input) returns `(now - timedelta(days=30), now)`.
- `gather_report_data`: calls `get_team_performance`, builds `task_stats` by querying `BDTask` per user (completed-in-period: `status == Completed` and timestamp within period; open: `status != Completed`; overdue: `due_date < now and status != Completed`), and computes `company_totals` by copying analytics.py's existing headline-total queries (lines preceding the team_performance block) filtered to the same period.

- [ ] **Step 4: Replace the inline block in `analytics.py:353-377` with a call to the new function**

```python
team_perf = get_team_performance(db, period_start, period_end)
```

(Import `get_team_performance` from `app.services.report_agent_service` at the top of `analytics.py`. Use whatever `period_start`/`period_end` values `_get_date_bounds` already produced for `get_comprehensive_analytics`'s own date_range, so the CSV export's behavior changes from all-time counts to period-filtered counts as a side effect — this is intentional per Review Focus/spec precedent, not a regression to guard against.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest backend/tests/test_report_agent.py -k "resolve_period or get_team_performance or gather_report_data" -v`
Expected: PASS

- [ ] **Step 6: Run the existing analytics test suite to confirm no regression**

Run: `pytest backend/tests/test_analytics.py -v`
Expected: PASS (update any test asserting all-time counts if it now legitimately expects period-filtered counts — note the change in the commit message)

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/report_agent_service.py backend/app/routers/analytics.py backend/tests/test_report_agent.py
git commit -m "feat: extract team performance query into report_agent_service with period filtering"
```

---

## Task 4: `report_render_service.py` — narrative + fallback

**Files:**
- Create: `backend/app/services/report_render_service.py`
- Test: `backend/tests/test_report_agent.py`

**Interfaces:**
- Consumes: `ReportData` (Task 3); `_get_llm_router` from `app.services.copilot.engine` (existing, returns an `LLMRouter` instance exposing a chat-completion method — confirm the exact method name/signature by reading `app/services/copilot/llm_router.py`'s `LLMRouter` class before writing the call site); `AllProvidersExhausted` exception (existing, raised by the router on total failure — confirm its import path, likely `app.services.copilot.llm_router`).
- Produces: `render_narrative(data: ReportData) -> str` — calls the LLM router with a dedicated system prompt (CEO audience, plain English, sections: Overview, Team Highlights, Per-Person Summary, Watch Items) and the serialized `ReportData` as input; on any `AllProvidersExhausted` (or other router exception), logs via `logger.error` and returns a template-only string (headline + metrics rendered as plain text, no prose) instead of raising. Consumed by Task 5's tool function and Task 7's docx/pdf renderers (which take the returned string plus the raw `ReportData`).
- Module-level reference point for test mocking: this file must call `_get_llm_router()` via a module-level import (`from app.services.copilot.engine import _get_llm_router`) so tests can monkeypatch `app.services.report_render_service._get_llm_router`.

- [ ] **Step 1: Write the failing tests**

```python
def test_render_narrative_success(monkeypatch):
    from app.services import report_render_service
    from app.services.report_agent_service import ReportData
    class StubResponse:
        content = "Overview: things are fine."
    class StubRouter:
        def chat(self, *args, **kwargs):
            return StubResponse()
    monkeypatch.setattr(report_render_service, "_get_llm_router", lambda: StubRouter())
    data = ReportData(period_start=None, period_end=None, team=[], task_stats={}, company_totals={})
    result = report_render_service.render_narrative(data)
    assert "Overview" in result

def test_render_narrative_falls_back_on_llm_failure(monkeypatch):
    from app.services import report_render_service
    from app.services.report_agent_service import ReportData
    from app.services.copilot.llm_router import AllProvidersExhausted
    class StubRouter:
        def chat(self, *args, **kwargs):
            raise AllProvidersExhausted("all providers failed")
    monkeypatch.setattr(report_render_service, "_get_llm_router", lambda: StubRouter())
    data = ReportData(period_start=None, period_end=None, team=[], task_stats={}, company_totals={})
    result = report_render_service.render_narrative(data)
    assert isinstance(result, str) and len(result) > 0
```

(Adjust the stub's `chat(...)` signature/`StubResponse.content` attribute to match whatever `LLMRouter`'s real chat method actually returns, confirmed by reading `llm_router.py` in Step 3 below — update these tests' stub shape accordingly before running.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_report_agent.py -k "render_narrative" -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Read `app/services/copilot/llm_router.py`'s `LLMRouter` class and `AllProvidersExhausted` to confirm the exact chat-call method name, its parameters, and its return type**, then implement `report_render_service.py`:

```python
import logging
from app.services.copilot.engine import _get_llm_router
from app.services.copilot.llm_router import AllProvidersExhausted
from app.services.report_agent_service import ReportData

logger = logging.getLogger("elly.bd_portal")

REPORT_SYSTEM_PROMPT = "..."  # CEO audience, plain English, Overview/Team Highlights/Per-Person Summary/Watch Items sections — exact copy per spec section "Narrative generation"

def render_narrative(data: ReportData) -> str:
    try:
        router = _get_llm_router()
        response = router.<confirmed_chat_method>(...)  # pass REPORT_SYSTEM_PROMPT + serialized data
        return response.<confirmed_content_attribute>
    except Exception as exc:
        logger.error("Report narrative LLM call failed, falling back to template: %s", exc)
        return _render_template_fallback(data)

def _render_template_fallback(data: ReportData) -> str:
    ...  # plain headline + metrics as text, no prose
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/test_report_agent.py -k "render_narrative" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/report_render_service.py backend/tests/test_report_agent.py
git commit -m "feat: add report narrative rendering with template fallback"
```

---

## Task 5: Document rendering (DOCX + PDF) + `generate_executive_report` tool function

**Files:**
- Modify: `backend/requirements.txt` (add `python-docx`, `reportlab`)
- Create: `backend/app/services/report_render_service.py` additions (same file as Task 4 — add the render-to-disk functions here) OR a new `backend/app/services/report_document_service.py` if `report_render_service.py` is getting large — prefer keeping narrative and document rendering in the same file unless it exceeds ~200 lines, per this codebase's existing file-size norms.
- Modify: `backend/app/services/copilot/tools.py` (add `generate_executive_report`)
- Test: `backend/tests/test_report_agent.py`

**Interfaces:**
- Consumes: `render_narrative` (Task 4), `gather_report_data`/`resolve_period` (Task 3), `ReportGeneration` (Task 2), `User`/`UserRole` (Task 1).
- Produces:
  - `render_docx(narrative: str, data: ReportData, path: str) -> None` — writes a `.docx` to `path` using `python-docx`: narrative sections as headings/paragraphs, per-person metrics as a table.
  - `render_pdf(narrative: str, data: ReportData, path: str) -> None` — writes a `.pdf` to `path` using `reportlab`'s `SimpleDocTemplate` + `Paragraph`/`Table` flowables, independently built (not a docx conversion).
  - `generate_executive_report(db: Session, user: User, period: str = "") -> Dict[str, Any]` in `tools.py`, matching the signature style of `get_dashboard_summary(db: Session, user: User)` at `tools.py:77`. Logic: if `user.role != UserRole.DEV.value`, return `{"error": "..."}` refusal dict (no DB write, no files) immediately; else call `resolve_period(period)`, `gather_report_data(...)`, `render_narrative(...)`, write both files to `backend/reports/<generated-id-placeholder>_report.docx`/`.pdf` (write after creating the `ReportGeneration` row so the real `id` is known for the filename), persist the `ReportGeneration` row (`requested_by_id=user.id`), and return `{"report_id": row.id, "period_start": ..., "period_end": ..., "formats": ["docx", "pdf"]}`. On any disk-write exception, catch it, log via `logger.error`, do not persist the DB row (or roll it back if already added), and return an error dict — no partial state.

- [ ] **Step 1: Write the failing tests**

```python
def test_generate_executive_report_refuses_non_dev(db_session):
    from app.services.copilot.tools import generate_executive_report
    from app.models.user import User, UserRole
    non_dev = db_session.query(User).filter(User.role == UserRole.BUSINESS_DEVELOPMENT.value).first()
    result = generate_executive_report(db_session, non_dev, period="")
    assert "report_id" not in result
    from app.models.report import ReportGeneration
    assert db_session.query(ReportGeneration).count() == 0

def test_generate_executive_report_dev_creates_files_and_row(db_session, monkeypatch, tmp_path):
    from app.services.copilot import tools as tools_module
    from app.services import report_render_service
    from app.models.user import User, UserRole
    monkeypatch.setattr(report_render_service, "_get_llm_router", lambda: (_ for _ in ()).throw(Exception("skip llm in test")))
    dev_user = db_session.query(User).filter(User.role == UserRole.DEV.value).first()
    result = tools_module.generate_executive_report(db_session, dev_user, period="last 30 days")
    assert "report_id" in result
    assert result["formats"] == ["docx", "pdf"]
    from app.models.report import ReportGeneration
    row = db_session.query(ReportGeneration).get(result["report_id"])
    import os
    assert os.path.exists(row.docx_path)
    assert os.path.getsize(row.docx_path) > 0
    assert os.path.exists(row.pdf_path)
    assert os.path.getsize(row.pdf_path) > 0

def test_generate_executive_report_quiet_period_still_generates(db_session):
    from app.services.copilot.tools import generate_executive_report
    from app.models.user import User, UserRole
    from datetime import datetime, timezone, timedelta
    dev_user = db_session.query(User).filter(User.role == UserRole.DEV.value).first()
    far_future_period = (datetime.now(timezone.utc) + timedelta(days=3650)).isoformat()
    result = generate_executive_report(db_session, dev_user, period="this week")
    assert "report_id" in result
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_report_agent.py -k "generate_executive_report" -v`
Expected: FAIL with `ImportError`/`AttributeError`

- [ ] **Step 3: Add `python-docx` and `reportlab` to `backend/requirements.txt`, then `pip install python-docx reportlab` into the active backend environment**

- [ ] **Step 4: Implement `render_docx`/`render_pdf` in `report_render_service.py` and `generate_executive_report` in `tools.py`** per the signatures above. Ensure `backend/reports/` is created with `os.makedirs(..., exist_ok=True)` before writing.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest backend/tests/test_report_agent.py -k "generate_executive_report" -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/app/services/report_render_service.py backend/app/services/copilot/tools.py backend/tests/test_report_agent.py
git commit -m "feat: add docx/pdf rendering and generate_executive_report tool"
```

---

## Task 6: Copilot wiring — schema, registry, intent, engine dispatch, system prompt

**Files:**
- Modify: `backend/app/services/copilot/agent_tools.py` (new entry in `AGENT_TOOL_SCHEMAS` before the closing bracket preceding line ~613, and in `TOOL_REGISTRY` before line 663/664)
- Modify: `backend/app/services/copilot/intent_router.py` (new `SIMPLE_INTENTS` tuple inserted immediately before the `funnel_reports` entry at line ~62; new `if intent_name == "generate_executive_report": args["period"] = msg` block in `route()`, alongside the existing `meetings_list` time-filter block at lines 300-311)
- Modify: `backend/app/services/copilot/engine.py` (new `elif route_result.tool_name == "generate_executive_report":` branch before the generic regex-dispatch block at lines 250-261; new `_handle_generate_executive_report` classmethod; new `report_ready` param on `_save_and_return_response` at lines 1435-1465; one new `SYSTEM_PROMPT` bullet line before line 144)
- Modify: `backend/app/models/copilot.py:28-48` (`report_ready = Column(JSON, nullable=True)` on `CopilotMessage`)
- Modify: `backend/app/schemas/copilot.py:45-54,72-84` (`report_id: Optional[int] = None`, `formats: Optional[List[str]] = None` on `CopilotChatResponse` and `CopilotMessageOut`)
- Test: `backend/tests/test_copilot.py`, `backend/tests/test_report_agent.py`

**Interfaces:**
- Consumes: `generate_executive_report` (Task 5); `TOOL_REGISTRY`, `execute_tool` (existing, unchanged — confirms new tool works through Tier-2 LLM dispatch with zero special-casing); `_save_and_return_response` (existing, extended).
- Produces: `CopilotEngine._handle_generate_executive_report(cls, db, user, args, conversation_id) -> CopilotChatResponse` — calls `tools.generate_executive_report(db, user, args.get("period", ""))`, builds a reply string, a `tools_executed` list, and (on success) a `report_ready` dict `{"report_id": ..., "formats": [...]LIST}`, then calls `cls._save_and_return_response(db, conversation_id, reply, intent="generate_executive_report", tools_executed=tools_exec, report_ready=report_ready)`. On refusal (non-DEV), `report_ready=None` and the reply is the friendly refusal text. Consumed by Task 8's frontend types matching `report_id`/`formats` on `CopilotChatResponse`/`CopilotMessageOut`.

- [ ] **Step 1: Write the failing tests**

In `test_copilot.py`, following the existing `TOOL_REGISTRY` override-mocking pattern (save/restore `orig_func` in try/finally):

```python
def test_copilot_engine_dispatches_generate_executive_report(client, db_session, monkeypatch):
    from app.services.copilot import agent_tools
    orig_func = agent_tools.TOOL_REGISTRY.get("generate_executive_report")
    agent_tools.TOOL_REGISTRY["generate_executive_report"] = lambda db, **kwargs: {
        "report_id": 1, "formats": ["docx", "pdf"], "period_start": "x", "period_end": "y"
    }
    try:
        # log in as the seeded DEV user, POST /api/copilot/chat with message "Generate an executive report for the last 30 days"
        # assert response.json()["report_id"] == 1 and response.json()["formats"] == ["docx", "pdf"]
        pass
    finally:
        if orig_func is not None:
            agent_tools.TOOL_REGISTRY["generate_executive_report"] = orig_func
```

(Fill in the login + POST following `test_access_control.py`'s exact login-then-bearer-token convention and `test_copilot.py`'s existing chat-request assertion style — both already confirmed in this codebase.)

```python
def test_intent_router_routes_executive_report_phrase():
    from app.services.copilot.intent_router import route
    result = route("Generate an executive report for the last 30 days")
    assert result.tool_name == "generate_executive_report"
    assert "period" in result.args or hasattr(result, "args")
```

(Adjust the assertion to match `route()`'s actual `RouteResult` shape, confirmed by reading `intent_router.py`'s `RouteResult` definition before writing.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_copilot.py -k "executive_report" -v`
Expected: FAIL (tool not recognized / 404-shaped response missing `report_id`)

- [ ] **Step 3: Add the `generate_executive_report` entry to `AGENT_TOOL_SCHEMAS`** in `agent_tools.py`, following the exact OpenAI function-schema shape of neighboring entries: `name: "generate_executive_report"`, description noting it generates a CEO-facing team activity report (DEV-only), `parameters.properties.period` (string, optional, description "free-text period like 'this week', 'last 30 days', 'this month', 'last quarter'").

- [ ] **Step 4: Add `"generate_executive_report": tools.generate_executive_report` to `TOOL_REGISTRY`** in `agent_tools.py`, immediately before the closing brace at line 664.

- [ ] **Step 5: Add the new `SIMPLE_INTENTS` tuple to `intent_router.py`**, inserted immediately before the `funnel_reports` entry (before line 62), matching the existing tuple shape `(intent_name, compiled_regex, tool_name, arg_extractor_or_None)`:

```python
("generate_executive_report", re.compile(r"\b(executive report|ceo report|leadership report|generate.*report)\b", re.IGNORECASE), "generate_executive_report", None),
```

Then add, in `route()` alongside the existing `meetings_list` time-filter block (lines 300-311):

```python
if intent_name == "generate_executive_report":
    args["period"] = msg
```

- [ ] **Step 6: Add the `report_ready` column to `CopilotMessage` in `models/copilot.py:28-48`**:

```python
report_ready = Column(JSON, nullable=True)
```

- [ ] **Step 7: Add `report_id`/`formats` fields to `CopilotChatResponse` and `CopilotMessageOut` in `schemas/copilot.py:45-54,72-84`**:

```python
report_id: Optional[int] = None
formats: Optional[List[str]] = None
```

- [ ] **Step 8: Add the new dispatch branch and handler to `engine.py`**

Before the generic regex-tool dispatch block (before line 250's existing `_write_move_stage`/`_write_log_call` special-case), add:

```python
elif route_result.tool_name == "generate_executive_report":
    return cls._handle_generate_executive_report(db, user, route_result.args, conversation_id)
```

Add the classmethod:

```python
@classmethod
def _handle_generate_executive_report(cls, db, user, args, conversation_id):
    result = tools.generate_executive_report(db, user, period=args.get("period", ""))
    if "report_id" not in result:
        reply = "Sorry, generating executive reports is restricted to DEV accounts."
        return cls._save_and_return_response(db, conversation_id, reply, intent="generate_executive_report")
    tools_exec = [ToolExecutionRecord(tool_name="generate_executive_report", arguments=args, status="success")]
    reply = f"Executive report ready for {result['period_start']} to {result['period_end']}."
    report_ready = {"report_id": result["report_id"], "formats": result["formats"]}
    return cls._save_and_return_response(db, conversation_id, reply, intent="generate_executive_report", tools_executed=tools_exec, report_ready=report_ready)
```

- [ ] **Step 9: Extend `_save_and_return_response` (lines 1435-1465) with a new `report_ready: Optional[dict] = None` parameter**, persisting it on the `CopilotMessage(report_ready=report_ready)` and unpacking `report_id`/`formats` onto the returned `CopilotChatResponse` when `report_ready` is truthy.

- [ ] **Step 10: Add one `SYSTEM_PROMPT` bullet line before line 144**:

```
- When the user asks for a leadership/CEO/executive report or summary of team activity, use generate_executive_report.
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `pytest backend/tests/test_copilot.py backend/tests/test_report_agent.py -v`
Expected: PASS

- [ ] **Step 12: Run full backend test suite to confirm no regression**

Run: `pytest backend/tests -v`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add backend/app/services/copilot/agent_tools.py backend/app/services/copilot/intent_router.py backend/app/services/copilot/engine.py backend/app/models/copilot.py backend/app/schemas/copilot.py backend/tests/test_copilot.py backend/tests/test_report_agent.py
git commit -m "feat: wire generate_executive_report tool through Copilot intent/engine/schema layers"
```

---

## Task 7: Download endpoint

**Files:**
- Create: `backend/app/routers/reports.py`
- Modify: `backend/app/main.py` (import + `app.include_router(reports_router)` alongside the other routers at lines 353-390)
- Test: `backend/tests/test_report_agent.py`

**Interfaces:**
- Consumes: `ReportGeneration` (Task 2), `require_role("DEV")` (existing, `app/auth/deps.py`).
- Produces: `GET /api/reports/{report_id}/download?format=docx|pdf`, gated by `require_role("DEV")`, returning `FileResponse` with correct media type (`application/vnd.openxmlformats-officedocument.wordprocessingml.document` for docx, `application/pdf` for pdf) and attachment filename; 404 if `report_id` unknown, format invalid, or the file is missing on disk.

- [ ] **Step 1: Write the failing tests**

Following `test_access_control.py`'s login-then-bearer-token convention:

```python
def test_download_report_requires_dev_role(client, db_session):
    # log in as non-DEV user, GET /api/reports/1/download?format=docx
    # assert response.status_code == 403
    pass

def test_download_report_404_for_unknown_id(client, db_session):
    # log in as DEV user, GET /api/reports/99999/download?format=docx
    # assert response.status_code == 404
    pass

def test_download_report_404_for_missing_file_on_disk(client, db_session):
    from app.models.report import ReportGeneration
    from datetime import datetime, timezone
    row = ReportGeneration(requested_by_id=None, period_start=datetime.now(timezone.utc), period_end=datetime.now(timezone.utc), docx_path="nonexistent/path.docx", pdf_path="nonexistent/path.pdf")
    db_session.add(row)
    db_session.commit()
    # log in as DEV user, GET /api/reports/{row.id}/download?format=docx
    # assert response.status_code == 404
    pass

def test_download_report_success_returns_correct_content_type(client, db_session):
    # use a ReportGeneration row created by Task 5's generate_executive_report flow with real files on disk
    # log in as DEV user, GET /api/reports/{report_id}/download?format=docx
    # assert response.status_code == 200
    # assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    pass
```

(Fill in the login/request calls using `client` fixture per `test_access_control.py`'s exact pattern.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_report_agent.py -k "download" -v`
Expected: FAIL with 404 (route not registered)

- [ ] **Step 3: Implement `routers/reports.py`**

```python
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.auth.deps import require_role
from app.models.report import ReportGeneration

router = APIRouter(prefix="/api/reports", tags=["Reports"])

MEDIA_TYPES = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pdf": "application/pdf",
}

@router.get("/{report_id}/download")
def download_report(report_id: int, format: str, db: Session = Depends(get_db), current_user=Depends(require_role("DEV"))):
    if format not in MEDIA_TYPES:
        raise HTTPException(status_code=404, detail="Unknown format")
    row = db.query(ReportGeneration).get(report_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Report not found")
    path = row.docx_path if format == "docx" else row.pdf_path
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Report file not found")
    filename = f"executive_report_{report_id}.{format}"
    return FileResponse(path, media_type=MEDIA_TYPES[format], filename=filename)
```

- [ ] **Step 4: Wire into `main.py`**: add `from app.routers.reports import router as reports_router` to the import list (after line 47) and `app.include_router(reports_router)` alongside the other `include_router` calls (lines 353-390).

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest backend/tests/test_report_agent.py -k "download" -v`
Expected: PASS

- [ ] **Step 6: Verify the app wires cleanly**

Run (from `backend/`): `python -c "from app.main import app; print(len(app.routes))"`
Expected: prints a route count, no traceback

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/reports.py backend/app/main.py backend/tests/test_report_agent.py
git commit -m "feat: add DEV-only report download endpoint"
```

---

## Task 8: Frontend — types, download helper, DEV chip, download buttons

**Files:**
- Modify: `frontend/src/types/copilot.ts:36-48,64-73` (`report_id?: number`, `formats?: string[]` on `CopilotMessage` and `CopilotChatResponse`)
- Modify: `frontend/src/services/api.ts` (new `downloadFile` export)
- Modify: `frontend/src/components/copilot/CopilotDrawer.tsx` (new `useAuth` import; DEV-gated quick-action chip; report-ready download-buttons block)

**Interfaces:**
- Consumes: `user?.role` from `useAuth()` (existing, `'../../context/AuthContext'`); `msg.report_id`/`msg.formats` on `CopilotMessage` (newly typed).
- Produces: `downloadFile(path: string, filename: string): Promise<void>` in `api.ts` — raw `fetch` with the same `Authorization: Bearer {token}` header `request()` uses (read from `localStorage.getItem('elly_bd_auth_token')`), `res.blob()`, temporary `<a>` + `URL.createObjectURL`/`revokeObjectURL`. Consumed by the new download-buttons block.

- [ ] **Step 1: Add `report_id?: number` and `formats?: string[]` to `CopilotMessage` (lines 36-48) and `CopilotChatResponse` (lines 64-73) in `types/copilot.ts`.**

- [ ] **Step 2: Add `downloadFile` to `services/api.ts`**:

```typescript
export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = localStorage.getItem('elly_bd_auth_token');
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: In `CopilotDrawer.tsx`, add `import { useAuth } from '../../context/AuthContext'` and `const { user } = useAuth()`** alongside the existing hooks.

- [ ] **Step 4: Add the DEV-only quick-action chip**, near the existing "Quick Contextual Suggestions" bar (line ~482-495) but as a separate, independently-rendered block (not reusing the `suggestions` state):

```tsx
{user?.role === 'DEV' && (
  <button onClick={() => handleSendMessage("Generate an executive report for the last 30 days")}>
    Generate Executive Report
  </button>
)}
```

- [ ] **Step 5: Add the report-ready download-buttons block**, mirroring the pending-confirmation card's JSX/Tailwind structure (lines 377-424), rendered when `msg.report_id` is set:

```tsx
{msg.report_id && msg.formats && (
  <div className="...">
    {msg.formats.map((fmt) => (
      <button key={fmt} onClick={() => downloadFile(`/api/reports/${msg.report_id}/download?format=${fmt}`, `executive_report_${msg.report_id}.${fmt}`)}>
        Download {fmt.toUpperCase()}
      </button>
    ))}
  </div>
)}
```

(Import `downloadFile` from `../../services/api` at the top of the file.)

- [ ] **Step 6: Run the TypeScript check**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Manual check**: log in as the seeded DEV test user (or an account promoted to DEV via the admin endpoint), open Ask Elly, confirm the "Generate Executive Report" chip appears only for that account, click it, confirm two download buttons appear and both files open correctly. Log in as a non-DEV account and confirm the chip is absent.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types/copilot.ts frontend/src/services/api.ts frontend/src/components/copilot/CopilotDrawer.tsx
git commit -m "feat: add DEV-only executive report chip and download buttons to Copilot drawer"
```

---

## Self-Review

**1. Spec coverage:** Access control (Task 1, 5, 7) — covered. Data model (Task 2) — covered. Metrics gathering incl. period parsing (Task 3) — covered. Narrative generation + fallback (Task 4) — covered. Document rendering (Task 5) — covered. Copilot integration: tool registry, engine dispatch, intent router, system prompt, message shape (Task 6) — covered. Download endpoint (Task 7) — covered. Frontend chip + buttons + types (Task 8) — covered. Error-handling table rows — each mapped: non-DEV refusal (Task 5/7), no-data-in-period (Review Focus test, Task 5), LLM failure (Task 4), disk-write failure (Task 5 Step 4 catch clause), unrecognized period (Task 3). DEV promotion — explicitly deferred per spec, no task needed.

**2. Step scan:** Passed — tool/library call signatures left open (e.g. `LLMRouter`'s exact chat method) are flagged as "read X before writing Y" steps rather than guessed bodies, since the summary's grounding didn't pin that one exact method name.

**3. Type consistency:** `generate_executive_report(db, user, period="")` signature used identically in Task 5 (tools.py), Task 6 (engine.py's `_handle_generate_executive_report`), and Task 6's `AGENT_TOOL_SCHEMAS`/`TOOL_REGISTRY` entries. `ReportData` fields (`period_start`, `period_end`, `team`, `task_stats`, `company_totals`) used identically across Tasks 3, 4, 5. `report_ready` dict shape (`{"report_id", "formats"}`) consistent across Task 6's engine code, Task 6's schema fields, and Task 8's frontend type/JSX.

**4. Review Focus:** All five lines have an owning task and test: non-DEV direct call → Task 5 Step 1; quiet period → Task 5 Step 1 (`test_generate_executive_report_quiet_period_still_generates`); unrecognized period phrase → Task 3 Step 1; stale DB row/missing file → Task 7 Step 1 (`test_download_report_404_for_missing_file_on_disk`); LLM exhaustion fallback → Task 4 Step 1 (`test_render_narrative_falls_back_on_llm_failure`) and re-exercised at the tool level in Task 5.

**5. Proportion:** Spec is 231 lines; this plan is longer because it carries exact file:line anchors, exact existing-code excerpts to splice around, and full test bodies per the project's established test-mocking conventions (TOOL_REGISTRY override, login-then-bearer-token) — proportionate to a codebase with no prior report/document-generation code to point at instead of transcribe.
