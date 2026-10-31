
# Executive Report Agent — Design Spec

Date: 2026-10-31
Status: Approved for planning

## Context

User wants a "report agent" reachable from the existing Ask Elly copilot
that generates a CEO-facing, non-technical report covering every user's
tasks, performance, and recent activity, downloadable as both DOCX and
PDF. This is the first of three sub-projects (dev console + roles,
backend log visibility, report agent) decomposed from a larger request.
This spec covers only the report agent. The dev console and log
visibility work are separate, later specs — this spec adds only the one
piece they depend on: a new `UserRole.DEV` enum value.

## Goals

- A new Copilot tool, triggerable from Ask Elly, that produces a
  plain-English report of team activity/performance over a user-picked
  or default time range.
- Report available as both a DOCX and a PDF, downloadable from the chat
  message that reports it's ready.
- Restricted to users with the `DEV` role.
- Reuses existing data/aggregation (analytics team-performance query,
  `BDTask` completion stats) rather than building new tracking.
- Reuses the existing `llm_router` for narrative generation rather than
  adding a second LLM client.

## Non-goals (explicitly out of scope for this spec)

- The dev console UI/shell itself (separate spec).
- Per-user API key configuration management (separate spec, dev console).
- Backend log capture/persistence/viewer (separate spec — currently logs
  only go to stdout, nothing persisted).
- Scheduling/automatic recurring report generation (on-demand only).
- Any ownership/visibility restriction between multiple DEV accounts —
  any `DEV` user can download any generated report (company-wide data by
  design, no per-DEV partitioning needed at this scale).

## Access control

- Add `DEV = "DEV"` to `UserRole` enum in `app/models/user.py`.
- No new role-management endpoint needed: `app/routers/admin.py` already
  accepts arbitrary role strings on its user-update endpoint, so an
  existing ADMIN can promote a user to `DEV` once the enum value exists.
- New tool and new download endpoint both gated via the existing
  `require_role("DEV")` dependency pattern (see `app/auth/deps.py`).
- Non-DEV callers get a friendly refusal message, not a stack trace; no
  file is written.

## Data model

New file `app/models/report.py`:

```python
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

Follows this codebase's no-Alembic convention: add the
`PRAGMA table_info` / `ALTER TABLE` block for `report_generations` (and
any new column) in `app/main.py`'s startup schema-migration section, same
as every other model in this repo.

Files land in `backend/reports/<id>_report.docx` / `.pdf`. That directory
must be added to `.gitignore` (same treatment as `backend/backups/` from
the earlier scheduler/backup work, if that landed — check at
implementation time; add it either way).

## Metrics gathering

`app/services/report_agent_service.py`:

- Extract the per-user aggregation currently inlined in
  `app/routers/analytics.py` (the block building `team_performance`:
  organizations added, contacts added, communications logged, meetings
  completed, opportunities managed, follow-ups completed) into a
  standalone function, e.g. `get_team_performance(db, period_start,
  period_end) -> list[TeamMemberPerformanceOut]`, so both the CSV export
  and the report agent call the same source of truth instead of
  duplicating the query.
- Add task stats per user from `BDTask`: completed-in-period count,
  still-open count, overdue count (`due_date < now and status != Completed`).
- Function signature: `gather_report_data(db, period_start, period_end) ->
  ReportData` (a small dataclass/pydantic model bundling the above per
  user, plus a few headline company-wide totals already available from
  analytics for context).

## Period parsing

- Default: last 30 days if the user's message doesn't specify a range.
- Simple keyword parsing in the tool-call argument (the LLM/intent layer
  extracts `period` as free text like "this week", "last 30 days", "this
  month", "last quarter"); a small resolver function maps known phrases
  to `(period_start, period_end)`; anything unrecognized falls back to
  the 30-day default rather than erroring.

## Narrative generation

`app/services/report_render_service.py`:

- One call through the existing `llm_router` (same provider path
  `copilot/llm_router.py` already uses for chat) with a dedicated system
  prompt instructing: CEO audience, no technical/engineering language, no
  database/field names, plain business English, structure as short
  sections (Overview, Team Highlights, Per-Person Summary, Watch Items).
- Input to the prompt is the structured `ReportData` from the gathering
  step (serialized as compact JSON/text), not raw DB rows.
- If the LLM call fails or times out: fall back to a template-only
  render — a plain headline + the metrics as a table, no prose — so the
  download never hard-fails just because narration failed. Log the LLM
  failure via the existing `logger`.

## Document rendering

- New dependencies in `backend/requirements.txt`: `python-docx`,
  `reportlab`. Both pure-Python wheels, no native build step needed on
  Windows.
- DOCX: narrative sections as headings + paragraphs via `python-docx`,
  per-person metrics as a `python-docx` table.
- PDF: same content via `reportlab` (`SimpleDocTemplate` + `Paragraph`/
  `Table` flowables) — not a docx→pdf conversion, built independently
  from the same `ReportData`/narrative to avoid a second runtime
  dependency (e.g. LibreOffice headless) just for format conversion.
- Both formats always generated together on each run (per explicit
  request — no "pick one format" option).

## Copilot integration

- `app/services/copilot/agent_tools.py`: add `generate_executive_report`
  to `TOOL_REGISTRY`. Signature takes `db`, `user`, and `arguments`
  (containing the raw period text, optional).
- Inside the tool: role check first (return a refusal dict if not
  `DEV`), then `gather_report_data`, then `report_render_service`
  call, then persist `ReportGeneration` row, then return
  `{report_id, period_start, period_end, formats: ["docx", "pdf"]}`.
- `app/services/copilot/engine.py`: add dispatch case for
  `generate_executive_report` alongside the existing `if tool_name ==
  ...` blocks (same pattern as every other tool there).
- `app/services/copilot/intent_router.py`: add recognition for phrases
  like "executive report", "ceo report", "generate report" routing to
  this tool name, following the existing routing-method pattern used for
  other write/action tools.
- `SYSTEM_PROMPT` in `engine.py`: add one line making the LLM aware this
  tool exists and when to call it (user asking for a report/summary for
  leadership).
- Assistant message carrying `report_id`/`formats` needs a small
  addition to whatever shape `CopilotMessage` already uses for
  structured tool results (mirror however `pending_confirmation` is
  currently carried on messages, per `CopilotDrawer.tsx`), so the
  frontend can detect "this message has a report" and render buttons.

## Download endpoint

New `app/routers/reports.py`:

```
GET /api/reports/{report_id}/download?format=docx|pdf
```

- `require_role("DEV")`.
- 404 if `report_id` unknown or the requested format's file is missing
  on disk.
- `FileResponse` (or `StreamingResponse` reading the file) with the
  correct `Content-Disposition` attachment filename and media type
  (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  for docx, `application/pdf` for pdf).
- Mount the router in `app/main.py` alongside the other routers.

## Frontend

`frontend/src/components/copilot/CopilotDrawer.tsx`:

- Quick-action chip "Generate Executive Report" shown only when
  `user.role === 'DEV'` (mirrors how other role-gated UI in this app
  already checks `user.role`, e.g. `Navbar.tsx`'s admin-only settings
  link). Clicking it sends a canned prompt ("Generate an executive
  report for the last 30 days").
- When an assistant message includes `report_id`/`formats`, render two
  small download buttons under that message bubble, each pointing at
  `GET /api/reports/{report_id}/download?format=...` with the existing
  authenticated `api` client (so the auth token header is attached;
  likely needs a blob-download helper if the existing `api` wrapper
  doesn't already support binary responses — check `services/api.ts` at
  implementation time).
- `frontend/src/types/` — extend whatever type models `CopilotMessage`
  to optionally carry `report_id: number` and `formats: string[]`.

## Error handling summary

| Case | Behavior |
|---|---|
| Caller not `DEV` | Friendly refusal message, no DB row, no files written |
| No data in period | Report still generates; narrative says activity was quiet |
| LLM call fails | Falls back to template-only (metrics table, no prose) |
| Disk write fails | Chat error message, no DB row persisted, logged via `logger.error` |
| Unrecognized period phrase | Falls back to default 30-day window |

## Testing plan

- Backend `tests/test_report_agent.py`:
  - Non-DEV user gets refused, no `ReportGeneration` row created.
  - DEV user with mocked `llm_router` response gets a `ReportGeneration`
    row, non-empty docx and pdf files on disk.
  - Download endpoint: correct content-type per format, 404 for unknown
    id, 403/refusal for non-DEV caller.
  - LLM failure path produces the template-only fallback instead of
    raising.
- Frontend: `npx tsc --noEmit` clean; manual check — chip only visible
  to a `DEV`-role test account, clicking it produces two working
  download buttons, both files open correctly.
- Existing verification pattern for this repo also applies: `python -c
  "from app.main import app; print(len(app.routes))"` after the backend
  changes land, to confirm the new router/models wire cleanly.

## Open question deferred to implementation

Promoting the first real user to `DEV`: done manually via the existing
admin user-update endpoint/UI once this ships — no new provisioning flow
needed for this spec.
