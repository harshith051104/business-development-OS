# Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical/high-priority issues found in `docs/PROJECT_AUDIT_2026-10-31.md`: remove the corrupted Connections/Kanban board, fix CEO analytics data filtering, fix Copilot AI false-success reporting, close RBAC/ownership gaps on BD resource endpoints.

**Architecture:** Backend is FastAPI + SQLAlchemy + SQLite (no Alembic — schema changes are additive only, no migrations needed since no columns are added/removed in this plan). Frontend is React 19/TS/Vite. Changes are surgical: delete dead/broken subsystem (Kanban), fix query filters (analytics), fix one confirm-action handler and one tool registry (Copilot), and swap a FastAPI dependency + add an ownership-check helper across existing routers (RBAC). No new models, no new infra.

**Tech Stack:** FastAPI, SQLAlchemy ORM, Pydantic schemas, pytest + TestClient, React 19 + TypeScript + Vite.

**Spec:** `docs/PROJECT_AUDIT_2026-10-31.md`

## Global Constraints

- No Alembic — this plan adds/removes no DB columns, so no migration step is needed.
- Never commit without being asked (task Commit steps below are the implementer's own commits during plan execution — this is the standing exception already covered by the plan-execution skill, not a new blanket permission to push).
- `backend/tests/conftest.py` seeds 6 users (`bd@test.local`, `healthcare@test.local`, `user@test.local`, `admin@test.local`, `inactive_bd@test.local`, `dev@elly.test`), all password `password123`. Login via `POST /auth/login`. Use `bd@test.local` as the acting BD user and `admin@test.local` as a stand-in "other owner" for cross-ownership tests (no second seeded BD user exists).
- Preserve `Organization.status` field and every other module that writes to it (lead tracker, admin, analytics) — only the Kanban-specific endpoints/UI are removed, per user decision.
- Brand name is "ELLY" — any user-facing/email-facing string must say ELLY, never "Electra".
- `User` model has `name`/`email`, no `full_name` attribute — never reference `user.full_name`.

## Review Focus

- A non-owner, non-admin BD user hitting a newly ownership-checked PUT/DELETE endpoint on a resource they don't own must get 403, not 404 or 500 — tasks 8-9 must each test this, not just the happy path.
- An owner_id of `None` (unassigned resource) must remain editable by any BD user — ownership checks must treat `None` as "unowned", not "owned by nobody, so nobody but admin."
- Deleting the Kanban router must not 500 any other router that imports from `connections.py` or the deleted schemas — Task 1 must grep for importers before deleting, not just delete and hope.
- The Copilot `send_email` confirm handler must surface a real send failure (e.g. `assert_send_allowed` raising because of opt-out/bounce) as `success=False` with the real reason, not swallow it into a fake "Successfully dispatched" message — Task 4 must test the failure path, not just the happy path.
- `auto_generate_followups`' new `due_at < now` filter must use a timezone-aware `now` consistent with how `due_at` is stored (`datetime.now(timezone.utc)`), or every comparison will raise/silently misbehave on naive-vs-aware datetimes — Task 6 must assert on both an overdue and a not-yet-due seeded follow-up.

---

## File Structure

**Delete:**
- `backend/app/routers/connections.py`
- `frontend/src/pages/connections/ConnectionsBoardPage.tsx`
- `frontend/src/services/connections.ts`

**Modify (backend):**
- `backend/app/main.py` — remove connections router import/include
- `backend/app/schemas/opportunity.py` — remove `KanbanBoardOut`, `KanbanColumnOut`, `KanbanCardOut`, `MoveStageInput`
- `backend/tests/test_opportunities.py` — remove Kanban tests
- `backend/tests/test_enhancements_suite.py` — remove Kanban tests
- `backend/app/services/report_agent_service.py` — fix owner_id filters (lines 43, 48, 58, 69)
- `backend/app/services/copilot/engine.py` — fix send_email confirm handler (~line 1380-1406)
- `backend/app/services/copilot/agent_tools.py` — add `update_organization_status` to `TOOL_REGISTRY`
- `backend/app/services/copilot/tools.py` — fix brand/full_name bugs in `draft_outreach_email`; add confirmation gate to `send_funding_outreach`; fix overdue filter in `auto_generate_followups`
- `backend/app/auth/deps.py` — add `ensure_owner_or_admin` helper
- `backend/app/routers/organizations.py`, `opportunities.py`, `customers.py`, `demos.py`, `proposals.py`, `negotiations.py`, `tasks.py`, `calls.py`, `integrations.py` — RBAC dependency swap + ownership checks
- `backend/app/routers/admin.py` — fix `Meeting.organizer_id` → `Meeting.owner_id` (line 247)

**Modify (frontend):**
- `frontend/src/App.tsx` — remove Connections route/import (lines 22, 234-237)
- `frontend/src/components/Navbar.tsx` — remove Connections nav link (line 154)
- `frontend/src/components/QuickActions.tsx` — remove Connections quick action (lines 39-42)
- `frontend/src/pages/BusinessDevelopmentPortal.tsx` — redirect fallback links (~302-307, 371-378) to `/business-development/organizations`

**Test:**
- `backend/tests/test_report_agent.py` — CEO analytics owner_id regression tests
- `backend/tests/test_copilot.py` — send_email honesty, overdue-filter, tool-registry tests
- `backend/tests/test_rbac_ownership.py` (new) — RBAC + ownership tests for all touched routers
- `backend/tests/test_admin.py` — admin.py Meeting field fix regression test (create if none exists covering this endpoint)

---

### Task 1: Remove Connections/Kanban backend

**Files:**
- Delete: `backend/app/routers/connections.py`
- Modify: `backend/app/main.py:18` (import), `backend/app/main.py:374` (`include_router`)
- Modify: `backend/app/schemas/opportunity.py` (remove `KanbanBoardOut`, `KanbanColumnOut`, `KanbanCardOut`, `MoveStageInput`)
- Modify: `backend/tests/test_opportunities.py:345-365,368-381` (remove)
- Modify: `backend/tests/test_enhancements_suite.py:87-93` (remove)
- Test: `backend/tests/test_opportunities.py`, `backend/tests/test_enhancements_suite.py` (post-removal, must still pass)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: no more `/connections/*` routes; `Organization.status` field untouched and still writable by every other module.

- [ ] **Step 1: Grep for every importer of `connections.py` and of the four Kanban schemas, to confirm nothing else depends on them**

Run: `grep -rn "from app.routers.connections\|from app.schemas.opportunity import.*Kanban\|MoveStageInput" backend/app --include=*.py`
Expected: only `main.py` imports the router; only `connections.py` imports the four schemas.

- [ ] **Step 2: Delete `backend/app/routers/connections.py`**

- [ ] **Step 3: Remove the import and `include_router` call for connections in `backend/app/main.py`**

- [ ] **Step 4: Remove `KanbanBoardOut`, `KanbanColumnOut`, `KanbanCardOut`, `MoveStageInput` from `backend/app/schemas/opportunity.py`**

- [ ] **Step 5: Remove the Kanban-specific test functions from `backend/tests/test_opportunities.py` (lines ~345-381) and `backend/tests/test_enhancements_suite.py` (lines ~87-93)**

- [ ] **Step 6: Run the backend test suite and confirm it collects and passes with no import errors**

Run: `cd backend && python -m pytest -q`
Expected: no `ImportError`/`ModuleNotFoundError` referencing `connections` or `Kanban`; same pass count as baseline minus the removed tests.

- [ ] **Step 7: Commit**

```bash
git add backend/app/main.py backend/app/schemas/opportunity.py backend/tests/test_opportunities.py backend/tests/test_enhancements_suite.py
git rm backend/app/routers/connections.py
git commit -m "fix: remove broken Connections/Kanban board backend"
```

---

### Task 2: Remove Connections/Kanban frontend

**Files:**
- Delete: `frontend/src/pages/connections/ConnectionsBoardPage.tsx`, `frontend/src/services/connections.ts`
- Modify: `frontend/src/App.tsx:22,234-237`
- Modify: `frontend/src/components/Navbar.tsx:154`
- Modify: `frontend/src/components/QuickActions.tsx:39-42`
- Modify: `frontend/src/pages/BusinessDevelopmentPortal.tsx:~302-307,~371-378` (redirect to `/business-development/organizations`)
- Modify: `frontend/src/pages/AnalyticsPage.tsx` — leave `total_connections` stat as-is UNLESS Step 1 below shows its backend source lives in the deleted router (it does not: it's a different, independent query — verify, don't assume)

**Interfaces:**
- Consumes: Task 1's removal of `/connections/*` backend routes (frontend must not call them).
- Produces: no dangling route/nav/import referencing the removed page or service.

- [ ] **Step 1: Confirm `BusinessDevelopmentPortal.tsx`'s and `AnalyticsPage.tsx`'s "connections" summary stats are independent of the deleted Kanban endpoints**

Run: `grep -rn "total_connections\|summary.connections" backend/app frontend/src`
Expected: the backend field is computed from an `Organization`/`Contact` count query elsewhere (e.g. analytics/dashboard router), not from `connections.py`. If it IS sourced from the deleted router, add a fallback query to whatever router this plan did not delete — do not leave a broken stat.

- [ ] **Step 2: Delete `ConnectionsBoardPage.tsx` and `connections.ts`**

- [ ] **Step 3: Remove the Connections import and route from `App.tsx`**

- [ ] **Step 4: Remove the Connections nav link from `Navbar.tsx`**

- [ ] **Step 5: Remove the Connections quick action from `QuickActions.tsx`**

- [ ] **Step 6: Point the two fallback links in `BusinessDevelopmentPortal.tsx` at `/business-development/organizations`**

- [ ] **Step 7: Type-check and build**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors referencing `connections` or `Kanban`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Navbar.tsx frontend/src/components/QuickActions.tsx frontend/src/pages/BusinessDevelopmentPortal.tsx
git rm frontend/src/pages/connections/ConnectionsBoardPage.tsx frontend/src/services/connections.ts
git commit -m "fix: remove broken Connections/Kanban board frontend"
```

---

### Task 3: Fix CEO analytics owner_id filtering bug

**Files:**
- Modify: `backend/app/services/report_agent_service.py:43,48,58,69`
- Test: `backend/tests/test_report_agent.py`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: per-user CEO report data that actually reflects that user's records (currently always empty/wrong for Organization, Contact, Meeting, FollowUp because the filter compares an Integer column to a String).

- [ ] **Step 1: Write a failing test proving the bug**

```python
def test_report_agent_counts_organizations_by_owner_id(db_session):
    from app.models.user import User
    from app.models.organization import Organization
    u = db_session.query(User).filter(User.email == "bd@test.local").first()
    org = Organization(name="Owner Filter Test Org", organization_type="Hospital",
                        created_by=u.id, is_deleted=False)
    db_session.add(org)
    db_session.commit()
    from app.services.report_agent_service import build_user_activity_summary  # adjust to actual function name
    summary = build_user_activity_summary(db_session, u)
    assert summary["organizations_created"] >= 1
```

(Use the actual function/entry point name in `report_agent_service.py` — read the file to confirm; the plan does not rename it.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_report_agent.py::test_report_agent_counts_organizations_by_owner_id -v`
Expected: FAIL (count is 0 because `Organization.created_by == u_name` compares Integer to String and never matches).

- [ ] **Step 3: Fix the four Integer-column filters in `report_agent_service.py`**

- Line 43: `Organization.created_by == u_name` → `Organization.created_by == u.id`
- Line 48: `Contact.created_by == u_name` → `Contact.created_by == u.id`
- Line 58: `Meeting.created_by == u_name` → `Meeting.created_by == u.id`
- Line 69: `FollowUp.created_by == u_name` → `FollowUp.created_by == u.id`
- Leave line 53 (`Communication.created_by == u_name`, String column — correct) and line 64 (`Opportunity` or-clause — correct) unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_report_agent.py::test_report_agent_counts_organizations_by_owner_id -v`
Expected: PASS

- [ ] **Step 5: Add the same pattern of regression test for Contact, Meeting, and FollowUp counts (one test each, same shape as Step 1) and confirm all pass**

Run: `cd backend && python -m pytest tests/test_report_agent.py -v`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/report_agent_service.py backend/tests/test_report_agent.py
git commit -m "fix: correct owner_id type mismatch in CEO analytics report filters"
```

---

### Task 4: Fix Copilot send_email false-success reporting

**Files:**
- Modify: `backend/app/services/copilot/engine.py:1380-1406` (`execute_confirmed_action`'s `elif action_type == "send_email":` block)
- Test: `backend/tests/test_copilot.py`

**Interfaces:**
- Consumes: `GmailService.send_email(db, gmail_account_id, to_email, subject, body_html, thread_id=None, user_id=None, campaign_contact_id=None) -> Dict[str, Any]` (`backend/app/services/gmail_service.py:282`) — already used by `POST /api/gmail/send` (`backend/app/routers/gmail.py:60-83`). It raises on `assert_send_allowed` gate failure (opt-out, bounce, unresolved placeholders, recipient mismatch).
- Produces: `send_email` confirm action that actually sends mail (or honestly reports failure) instead of only writing a `Communication` row and claiming "dispatched".

- [ ] **Step 1: Write a failing test for the happy path**

```python
def test_copilot_confirm_send_email_actually_sends(client, db_session, monkeypatch):
    sent = {}
    def fake_send_email(**kwargs):
        sent.update(kwargs)
        return {"status": "sent", "message_id": "fake123"}
    monkeypatch.setattr("app.services.gmail_service.GmailService.send_email", staticmethod(fake_send_email))
    # ... log in as bd@test.local, create a pending send_email confirmation via the
    # existing confirmation flow (reuse _save_confirmation / the draft_outreach_email
    # tool path), then POST /api/copilot/confirm with that action_id
    # assert response.json()["success"] is True
    # assert sent.get("to_email") == <expected contact email>
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_copilot.py::test_copilot_confirm_send_email_actually_sends -v`
Expected: FAIL (monkeypatched `GmailService.send_email` never called — current code only writes a `Communication` row).

- [ ] **Step 3: Rewrite the `send_email` branch in `execute_confirmed_action` (engine.py ~1380-1406) to call `GmailService.send_email` before logging the `Communication` row**

- Call `GmailService.send_email(db=db, gmail_account_id=payload.get("gmail_account_id"), to_email=payload.get("contact_email"), subject=payload.get("subject", "Outreach Email"), body_html=payload.get("body", ""), user_id=user.id)` inside a `try/except`.
- On success: write the `Communication` row as today (status="Completed"), log the audit event, delete the confirmation, return `success=True` with message `f"Sent outreach email to **{payload.get('contact_name', 'prospect')}**."` (drop "dispatched and recorded" — say what happened).
- On exception (e.g. `assert_send_allowed` raising, or any other failure): still delete the confirmation (it's resolved, not re-offerable), do NOT write a `Communication` row claiming success, and return `CopilotConfirmResponse(action_id=..., approved=True, success=False, message=f"Could not send the email: {exc}")`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_copilot.py::test_copilot_confirm_send_email_actually_sends -v`
Expected: PASS

- [ ] **Step 5: Write and pass a failure-path test — `GmailService.send_email` raises (simulate opt-out/bounce gate) and the response must be `success=False` with the real reason, no `Communication` row written**

```python
def test_copilot_confirm_send_email_reports_real_failure(client, db_session, monkeypatch):
    def fake_send_email(**kwargs):
        raise ValueError("recipient has opted out")
    monkeypatch.setattr("app.services.gmail_service.GmailService.send_email", staticmethod(fake_send_email))
    # ... same confirm flow as Step 1 ...
    # assert response.json()["success"] is False
    # assert "opted out" in response.json()["message"]
```

Run: `cd backend && python -m pytest tests/test_copilot.py::test_copilot_confirm_send_email_reports_real_failure -v`
Expected: PASS

- [ ] **Step 6: Run full copilot test file**

Run: `cd backend && python -m pytest tests/test_copilot.py -v`
Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/copilot/engine.py backend/tests/test_copilot.py
git commit -m "fix: Copilot send_email now actually sends mail instead of faking success"
```

---

### Task 5: Fix Copilot tool registry gap and draft_outreach_email bugs

**Files:**
- Modify: `backend/app/services/copilot/agent_tools.py` (add `update_organization_status` to `TOOL_REGISTRY`, ~line 679)
- Modify: `backend/app/services/copilot/tools.py:2075,2084-2085,2093,2098-2099` (`draft_outreach_email`)
- Test: `backend/tests/test_copilot.py`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `update_organization_status` tool is dispatchable (was silently failing with "Unknown tool"); `draft_outreach_email` output says "ELLY" not "Electra" and uses the real sender name.

- [ ] **Step 1: Write a failing test for the tool registry gap**

```python
def test_update_organization_status_tool_is_registered():
    from app.services.copilot.agent_tools import TOOL_REGISTRY
    assert "update_organization_status" in TOOL_REGISTRY
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_copilot.py::test_update_organization_status_tool_is_registered -v`
Expected: FAIL (`KeyError`/`AssertionError` — not in registry)

- [ ] **Step 3: Add `update_organization_status` to `TOOL_REGISTRY` in `agent_tools.py`, pointing at the existing handler function for this schema (read the file to find the function the `update_organization_status` tool schema at line 224 implies — it must already exist as a plain function in `tools.py`/`agent_tools.py`; wire it in, do not write a new handler)**

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_copilot.py::test_update_organization_status_tool_is_registered -v`
Expected: PASS

- [ ] **Step 5: Write a failing test for the brand/name bugs in `draft_outreach_email`**

```python
def test_draft_outreach_email_uses_elly_brand_and_real_sender_name(db_session):
    from app.services.copilot.tools import draft_outreach_email
    # build minimal org/contact/user fixtures as the function signature requires
    result = draft_outreach_email(db=db_session, organization_id=<org>.id, user=<bd_user>)
    assert "Electra" not in result["subject"]
    assert "Electra" not in result["body"]
    assert "ELLY" in result["subject"]
    assert <bd_user>.name in result["body"]
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_copilot.py::test_draft_outreach_email_uses_elly_brand_and_real_sender_name -v`
Expected: FAIL ("Electra" present, sender falls back to "Business Development Team")

- [ ] **Step 7: Fix `tools.py`**

- Lines 2075, 2085, 2093, 2099: replace literal `"Electra"` with `"ELLY"`.
- Lines 2084, 2098: replace `getattr(user, 'full_name', 'Business Development Team') if user else 'Business Development Team'` with `user.name if user else 'Business Development Team'`.

- [ ] **Step 8: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_copilot.py::test_draft_outreach_email_uses_elly_brand_and_real_sender_name -v`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/copilot/agent_tools.py backend/app/services/copilot/tools.py backend/tests/test_copilot.py
git commit -m "fix: register update_organization_status tool, fix brand/sender-name bugs in draft_outreach_email"
```

---

### Task 6: Fix auto_generate_followups overdue filter and gate send_funding_outreach

**Files:**
- Modify: `backend/app/services/copilot/tools.py:2185` (`auto_generate_followups`'s `overdue_q`)
- Modify: `backend/app/services/copilot/tools.py:2415+` (`send_funding_outreach`)
- Test: `backend/tests/test_copilot.py`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `auto_generate_followups` only flags genuinely-overdue follow-ups; `send_funding_outreach` requires a confirmation step before `CampaignService.quick_send`, matching every other mutating Copilot action's pattern (`requires_confirmation` dict, same as `send_email`/`schedule_meeting`).

- [ ] **Step 1: Write a failing test for the overdue filter, using conftest's seeded follow-ups (`f1` overdue 2026-08-18, `f2` upcoming 2026-08-28)**

```python
def test_auto_generate_followups_only_flags_truly_overdue(db_session):
    from app.services.copilot.tools import auto_generate_followups
    result = auto_generate_followups(db=db_session)
    overdue_ids = {item["id"] for item in result["items"]}
    from app.models.followup import FollowUp
    f1 = db_session.query(FollowUp).filter(FollowUp.title == "Send ELLY Platform Whitepaper").first()
    f2 = db_session.query(FollowUp).filter(FollowUp.title == "Follow up on preliminary terms").first()
    assert f1.id in overdue_ids
    assert f2.id not in overdue_ids
```

(Adjust to the function's actual return shape — read `auto_generate_followups` first.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_copilot.py::test_auto_generate_followups_only_flags_truly_overdue -v`
Expected: FAIL (f2 incorrectly included — filter only checks status, not due date)

- [ ] **Step 3: Add `FollowUp.due_at < datetime.now(timezone.utc)` to the `overdue_q` filter in `auto_generate_followups` (tools.py:2185); remove the now-used `seven_days_ago` dead variable at line 2180 if it stays unused, or wire it in if the intended behavior was "overdue by 7+ days" — read the surrounding code/audit note to decide which the function's docstring/callers expect, and ledger that decision**

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_copilot.py::test_auto_generate_followups_only_flags_truly_overdue -v`
Expected: PASS

- [ ] **Step 5: Write a failing test proving `send_funding_outreach` executes immediately with no confirmation gate**

```python
def test_send_funding_outreach_requires_confirmation(db_session):
    from app.services.copilot.tools import send_funding_outreach
    result = send_funding_outreach(db=db_session, ...)  # minimal required args
    assert result.get("requires_confirmation") is True
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_copilot.py::test_send_funding_outreach_requires_confirmation -v`
Expected: FAIL (function calls `CampaignService.quick_send` directly, no `requires_confirmation` key)

- [ ] **Step 7: Change `send_funding_outreach` to return a `requires_confirmation` payload (same shape as the other gated actions in `engine.py`'s confirmation-prep block, e.g. `action_type: "send_funding_outreach"`) instead of calling `CampaignService.quick_send` directly; wire the confirmed-execution branch into `engine.py`'s `execute_confirmed_action` (same elif-chain pattern as `send_email`/`schedule_meeting`) to actually call `CampaignService.quick_send` once confirmed**

- [ ] **Step 8: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_copilot.py::test_send_funding_outreach_requires_confirmation -v`
Expected: PASS

- [ ] **Step 9: Run full copilot test file**

Run: `cd backend && python -m pytest tests/test_copilot.py -v`
Expected: all PASS

- [ ] **Step 10: Commit**

```bash
git add backend/app/services/copilot/tools.py backend/app/services/copilot/engine.py backend/tests/test_copilot.py
git commit -m "fix: correct overdue-followup filter, add confirmation gate to send_funding_outreach"
```

---

### Task 7: Add ownership-check helper to auth/deps.py

**Files:**
- Modify: `backend/app/auth/deps.py` (add helper near `require_business_development`/`require_admin`, lines 82-101)
- Test: `backend/tests/test_rbac_ownership.py` (new)

**Interfaces:**
- Consumes: `UserRole` enum, `User` model (both already imported in `deps.py:8`).
- Produces: `ensure_owner_or_admin(resource_owner_id: Optional[int], current_user: User) -> None` — raises `HTTPException(403, detail="You do not have permission to modify this resource.")` when `resource_owner_id is not None and resource_owner_id != current_user.id and current_user.role != UserRole.ADMIN.value`; returns `None` (no-op) when `resource_owner_id is None` or the caller owns it or is ADMIN. Tasks 8 and 9 call this at the top of every PUT/DELETE handler they touch, right after the existing 404 check.

- [ ] **Step 1: Write a failing unit test**

```python
def test_ensure_owner_or_admin_allows_owner_blocks_others_allows_admin_allows_unowned():
    from app.auth.deps import ensure_owner_or_admin
    from fastapi import HTTPException
    class FakeUser:
        def __init__(self, id, role):
            self.id = id
            self.role = role
    owner = FakeUser(1, "BUSINESS_DEVELOPMENT")
    other = FakeUser(2, "BUSINESS_DEVELOPMENT")
    admin = FakeUser(3, "ADMIN")
    ensure_owner_or_admin(1, owner)      # no raise
    ensure_owner_or_admin(None, other)   # no raise (unowned)
    ensure_owner_or_admin(1, admin)      # no raise (admin override)
    try:
        ensure_owner_or_admin(1, other)
        assert False, "expected HTTPException"
    except HTTPException as e:
        assert e.status_code == 403
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_rbac_ownership.py::test_ensure_owner_or_admin_allows_owner_blocks_others_allows_admin_allows_unowned -v`
Expected: FAIL (`ImportError` — function doesn't exist yet)

- [ ] **Step 3: Implement `ensure_owner_or_admin` in `backend/app/auth/deps.py`**

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_rbac_ownership.py::test_ensure_owner_or_admin_allows_owner_blocks_others_allows_admin_allows_unowned -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/auth/deps.py backend/tests/test_rbac_ownership.py
git commit -m "feat: add ensure_owner_or_admin ownership-check helper"
```

---

### Task 8: Wire ownership checks into organizations.py and opportunities.py

**Files:**
- Modify: `backend/app/routers/organizations.py` — `update_organization` (260-304, insert after 404 check ending line 273), `delete_organization` (392-419, insert after 404 check ending line 404)
- Modify: `backend/app/routers/opportunities.py` — `update_opportunity` (381-398ish, insert after 404 check ending line 393), `delete_opportunity` (601-629, insert after 404 check ending line 612)
- Test: `backend/tests/test_rbac_ownership.py`

**Interfaces:**
- Consumes: `ensure_owner_or_admin` from Task 7 (`backend/app/auth/deps.py`).
- Produces: a BD user who does not own an organization/opportunity gets 403 on update/delete; the owner and ADMIN still succeed; `update_organization_status`/`update_organization_priority` (lines 307-338, 341+) are explicitly left unchanged — out of scope per the audit's own findings, not touched here.

- [ ] **Step 1: Write failing tests — non-owner BD user blocked, owner allowed, admin allowed, on both organizations and opportunities update+delete**

```python
def _login(client, email):
    r = client.post("/auth/login", json={"email": email, "password": "password123"})
    return r.json()["access_token"]

def test_non_owner_bd_user_cannot_update_organization(client):
    admin_token = _login(client, "admin@test.local")
    create_resp = client.post("/organizations", json={"name": "Owned By Admin", "organization_type": "Hospital"},
                               headers={"Authorization": f"Bearer {admin_token}"})
    org_id = create_resp.json()["id"]
    bd_token = _login(client, "bd@test.local")
    update_resp = client.put(f"/organizations/{org_id}", json={"name": "Hijacked"},
                              headers={"Authorization": f"Bearer {bd_token}"})
    assert update_resp.status_code == 403
```

(Mirror this shape for `delete_organization`, `update_opportunity`, `delete_opportunity` — 4 tests total this task. Adjust create payload fields to each schema's required fields; read the schema first.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_rbac_ownership.py -k "organization or opportunity" -v`
Expected: FAIL (currently any BD user can edit any org/opportunity — no ownership check exists)

- [ ] **Step 3: Insert `ensure_owner_or_admin(org.owner_id, current_user)` right after each 404 check in `update_organization`/`delete_organization`/`update_opportunity`/`delete_opportunity`**

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_rbac_ownership.py -k "organization or opportunity" -v`
Expected: PASS

- [ ] **Step 5: Run full organizations/opportunities test files to confirm no regression on the owner's own successful update/delete path**

Run: `cd backend && python -m pytest tests/test_organizations.py tests/test_opportunities.py tests/test_tier0_ownership.py -v`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/organizations.py backend/app/routers/opportunities.py backend/tests/test_rbac_ownership.py
git commit -m "fix: add ownership checks to organization and opportunity update/delete"
```

---

### Task 9: Wire RBAC + ownership checks into customers/demos/proposals/negotiations/tasks/calls/integrations

**Files:**
- Modify: `backend/app/routers/customers.py` (lines 89, 138, 196+200, 220+224)
- Modify: `backend/app/routers/demos.py` (lines 85, 139+143, 167)
- Modify: `backend/app/routers/proposals.py` (lines 84, 142+146, 166)
- Modify: `backend/app/routers/negotiations.py` (lines 82, 138+142, 162+166)
- Modify: `backend/app/routers/tasks.py` (lines 144, 178+182, 205+209, 249)
- Modify: `backend/app/routers/calls.py` (line 116)
- Modify: `backend/app/routers/integrations.py` (line 69, `ingest_external_lead`)
- Test: `backend/tests/test_rbac_ownership.py`

**Interfaces:**
- Consumes: `ensure_owner_or_admin` from Task 7, `require_business_development` from `app/auth/deps.py` (already imported in each of these routers).
- Produces: every create endpoint in this list requires BD/ADMIN/DEV role (was `get_current_user`, any authenticated role); every update/delete on customers, demos, proposals, negotiations, tasks additionally enforces ownership. `calls.py:log_call` and `integrations.py:ingest_external_lead` get the role swap only (no ownership concept). `tasks.py:list_task_comments` (226-230, read-only) is explicitly left on `get_current_user` — not a mutation, out of scope.

- [ ] **Step 1: Write failing tests — non-BD role (`healthcare@test.local` or `user@test.local`) gets 403 creating a customer/demo/proposal/negotiation/task/call/integration-ingest; a non-owner BD user gets 403 updating/deleting a customer/demo/proposal/negotiation/task they don't own**

```python
def test_non_bd_role_cannot_create_customer(client):
    token = _login(client, "user@test.local")
    resp = client.post("/customers", json={"organization_id": 1}, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
```

(One create-role test per router: customers, demos, proposals, negotiations, tasks, calls, integrations/ingest — 7 tests. One ownership test per router with update+delete: customers, demos, proposals, negotiations, tasks — 5 tests, same admin-creates/bd-user-blocked shape as Task 8 Step 1. Read each schema's required create fields first.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_rbac_ownership.py -v`
Expected: FAIL on every new test (role swap and ownership checks don't exist yet on these routers)

- [ ] **Step 3: In each router, swap `current_user: User = Depends(get_current_user)` to `Depends(require_business_development)` on every create/update/delete endpoint listed above (including `calls.py:log_call` and `integrations.py:ingest_external_lead`)**

- [ ] **Step 4: In `customers.py`, `demos.py`, `proposals.py`, `negotiations.py`, `tasks.py`, insert `ensure_owner_or_admin(<resource>.owner_id, current_user)` immediately after each update/delete handler's existing 404 check**

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_rbac_ownership.py -v`
Expected: all PASS

- [ ] **Step 6: Run the full backend suite to confirm no regression (role swap doesn't break any existing test that assumed `get_current_user` was sufficient)**

Run: `cd backend && python -m pytest -q`
Expected: pass count ≥ baseline minus Kanban tests removed in Task 1, plus all new tests from Tasks 3-9

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/customers.py backend/app/routers/demos.py backend/app/routers/proposals.py backend/app/routers/negotiations.py backend/app/routers/tasks.py backend/app/routers/calls.py backend/app/routers/integrations.py backend/tests/test_rbac_ownership.py
git commit -m "fix: enforce BD role and resource ownership across customers/demos/proposals/negotiations/tasks/calls/integrations"
```

---

### Task 10: Fix admin.py Meeting.organizer_id AttributeError

**Files:**
- Modify: `backend/app/routers/admin.py:247`
- Test: `backend/tests/test_admin.py`

**Interfaces:**
- Consumes: `Meeting.owner_id` (`backend/app/models/meeting.py:52`) — the model has no `organizer_id`.
- Produces: the admin endpoint containing this query no longer raises `AttributeError` at runtime.

- [ ] **Step 1: Read `admin.py` around line 240-250 to identify the exact endpoint function and write a failing test that calls it as `admin@test.local`**

```python
def test_admin_endpoint_with_meeting_query_does_not_500(client):
    token = _login(client, "admin@test.local")
    resp = client.get("/admin/<the-actual-path>", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_admin.py::test_admin_endpoint_with_meeting_query_does_not_500 -v`
Expected: FAIL with `AttributeError: type object 'Meeting' has no attribute 'organizer_id'`

- [ ] **Step 3: Change `Meeting.organizer_id` to `Meeting.owner_id` at `admin.py:247`**

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_admin.py::test_admin_endpoint_with_meeting_query_does_not_500 -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/admin.py backend/tests/test_admin.py
git commit -m "fix: correct Meeting.organizer_id to Meeting.owner_id in admin endpoint"
```

---

## Self-Review Notes

- **Spec coverage:** all four audit areas named in the goal (Kanban removal, CEO analytics, Copilot honesty, RBAC) have at least one task each; Tasks 1-2 (Kanban), 3 (analytics), 4-6 (Copilot), 7-9 (RBAC), 10 (admin bug) = 10 tasks, no gaps against the areas investigated this session.
- **Step scan:** steps that touch code not yet read verbatim by this plan (Task 5's tool-registry handler lookup, Task 6's `seven_days_ago` disposition, Task 10's exact admin endpoint path/name) are flagged as implementer decisions with explicit instruction to read first and ledger the call — not left as silent TBDs.
- **Type consistency:** `ensure_owner_or_admin(resource_owner_id: Optional[int], current_user: User) -> None` (Task 7) is the single signature Tasks 8-9 both call — same name, same argument order, throughout.
- **Review Focus:** covered inline per task (ownership None-case, non-owner 403, Kanban-importer grep, send_email failure path, timezone-aware overdue filter).
- **Proportion:** this plan is longer than the audit's own prose because it pins exact file/line targets across 9 routers — each task's steps stay at signature/assertion granularity, no full function bodies transcribed.
