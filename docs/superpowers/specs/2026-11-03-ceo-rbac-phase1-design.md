# CEO Assignment — Phase 1: CEO Role, RBAC, Account Provisioning, Executive Dashboard Shell

Status: approved for implementation (writing-plans next)
Depends on: `docs/PROJECT_AUDIT_2026-10-31.md`, `docs/CEO_REQUIREMENTS_GAP_ANALYSIS_2026-10-31.md`
Supersedes nothing; purely additive to the existing ELLY BD platform.

## 1. Context and objective

The CEO Assignment brief ("ELLY – CEO Assignment: Personal AI Business Development
& Executive Management System") asks for a large system spanning a new CEO role,
an executive dashboard, a personal AI assistant, multi-channel outreach integrations,
workflow visualization, knowledge-base separation, and automation safety limits.
This is too large for a single spec and has been decomposed into phases. This
document covers **Phase 1 only**:

1. A distinct `CEO` role in auth/RBAC — not a reuse of `ADMIN`.
2. Secure CEO account provisioning (no hardcoded credentials, forced first-login
   password change).
3. Organization-wide visibility for the CEO, with the CEO's own records private by
   default from everyone else, including ADMIN, unless explicitly shared.
4. A CEO-only executive dashboard **shell** (route, nav, basic org-wide counts).
   Full widget content (team drill-down, pipeline detail, workflow visualization)
   is out of scope for Phase 1 and belongs to later phases.

Everything else in the brief (AI assistant, email/LinkedIn/WhatsApp, workflow
visualization, KB split, automation limits) is explicitly out of scope here and
will get its own spec once Phase 1 ships and its authorization tests pass.

## 2. Access policy (confirmed)

1. **CEO** — full organization-wide read access to every employee's records, plus
   a private workspace for the CEO's own records.
2. **ADMIN** — manages users and system settings, and retains access to all
   non-private company records exactly as today, but can never automatically see
   a CEO-private record.
3. **Employees** — see only their own records, plus anything explicitly shared with
   them. (This is tightened from current behavior — see §4.2.)
4. **Explicit sharing** — the CEO can share a specific private record with a named
   admin or employee. Revocation takes effect immediately.
5. **Audit logging** — every share grant, share revocation, and privileged
   (shared-record) access is recorded in the existing `AuditLog`.

Existing non-CEO data and existing ADMIN/employee behavior must not regress.

## 3. Current-state findings (independently verified this session)

- `UserRole` already has five values: `BUSINESS_DEVELOPMENT`, `HEALTHCARE`, `ADMIN`,
  `USER`, `DEV` (`backend/app/models/user.py`). No `CEO` value exists.
- `require_role`, `require_business_development`, `require_admin` already exist as
  a generic FastAPI dependency pattern (`backend/app/auth/deps.py`) — easy to extend,
  not a rebuild.
- `owner_id` (FK to `users.id`) already exists on 13 models: `Organization`,
  `Contact`, `Opportunity`, `Task` (`BDTask`), `FollowUp`, `Meeting`, `Demo`,
  `Proposal`, `Negotiation`, `Partnership`, `Customer`, `Communication`, `Campaign`.
- An `owner_scope` query param pattern exists in 6 routers (`organizations.py`,
  `contacts.py`, `meetings.py`, `campaigns.py`, `followups.py`, `insights.py`), e.g.:
  ```python
  if owner_scope == "mine" and current_user.role != "ADMIN":
      query = query.filter(Organization.owner_id == current_user.id)
  ```
- **Bug found and in scope to fix:** the condition above only filters when
  `owner_scope == "mine"`. Sending `owner_scope=all` skips the filter entirely for
  *any* authenticated role, not just ADMIN — today, any BD employee can see every
  other employee's organizations/contacts/meetings/campaigns/follow-ups by setting
  this query param. This directly contradicts the brief's "keep employee workspaces
  separate" requirement and must be closed as part of this phase, not deferred.
- `User` has no `must_change_password` or `password_changed_at` column, and there is
  no `/api/auth/change-password` endpoint today.
- `AuditLog` (`backend/app/models/audit.py`) is real and already written to from 6
  files — reused as-is, no new audit infrastructure needed.
- `backend/seed.py` is the existing account-provisioning pattern: env var or
  `getpass`-prompted password, never hardcoded, idempotent per email. Used as the
  template for CEO provisioning.
- No Alembic in this repo — schema changes ship as one-off scripts issuing
  `ALTER TABLE` against the SQLite DB, consistent with the existing shim in
  `backend/app/main.py`.

## 4. Design

### 4.1 Data model changes

- Add `is_private BOOLEAN NOT NULL DEFAULT 0` to all 13 models listed in §3.
  Default `False` is backward compatible: no existing row's visibility changes.
- Add to `User`: `must_change_password BOOLEAN NOT NULL DEFAULT 0`,
  `password_changed_at DATETIME NULL`.
- New table `record_shares`: `id, resource_type (str), resource_id (int),
  shared_with_user_id (FK users), granted_by_user_id (FK users),
  granted_at (datetime), revoked_at (datetime, nullable)`. One row per grant;
  revocation sets `revoked_at` rather than deleting, preserving an audit trail.
  A partial-unique constraint (enforced in code, since SQLite partial unique
  indexes need an explicit `WHERE revoked_at IS NULL` index) prevents a duplicate
  *active* share for the same `(resource_type, resource_id, shared_with_user_id)`.

Migration ships as `backend/scripts/migrate_ceo_rbac_phase1.py`, following the
existing manual-ALTER-TABLE shim pattern. It only adds columns/tables with safe
defaults — it never rewrites or flips any existing row's `is_private` value.
Promoting an existing user to `CEO` later does **not** retroactively privatize
their historical records; only records created *after* the promotion, by that CEO,
default to private. This is a deliberate non-goal, stated explicitly per the
"protect existing data" safeguard.

### 4.2 Visibility enforcement — one generic layer, applied everywhere

A single module, `backend/app/core/visibility.py`, exposes:

- `apply_visibility_filter(query, model, current_user) -> query` — for list/search/
  export/analytics/relationship queries.
- `get_visible_or_404(db, model, record_id, current_user) -> instance` — for
  detail/update/delete, raising 404 (not 403, to avoid confirming a private
  record's existence to someone who can't see it) when not visible.

Rule, evaluated in this order:

1. `current_user.role == "CEO"` → always visible, full stop. The CEO's
   organization-wide visibility is unconditional and never scoped by
   `owner_scope`.
2. `record.owner_id == current_user.id` → always visible (you always see your own).
3. An active `record_shares` row exists for `(model_name, record.id,
   current_user.id)` → visible (and this specific access is written to
   `AuditLog` as `shared_record_access`).
4. `record.is_private is False` and `current_user.role == "ADMIN"` → visible
   (ADMIN keeps today's full non-private access, unchanged).
5. `record.is_private is False` and `current_user.role` is a non-admin employee
   role → visible only if `record.owner_id == current_user.id` (already covered
   by rule 2) — **employees never get an "all" view**. This replaces the old
   `owner_scope` bypass. `owner_scope` becomes advisory UI only for ADMIN/CEO
   (toggle between "mine" and "all" when both are already visible to them) and is
   ignored for employee roles — the backend no longer trusts a client-supplied
   scope value to decide visibility for anyone.
6. Otherwise → not visible.

This closes the `owner_scope=all` bug as the same change, not a separate patch:
the new helper is the only code path allowed to decide visibility; the six
existing routers' manual `if owner_scope == "mine"...` blocks are deleted and
replaced with a call to `apply_visibility_filter`.

**Every** endpoint touching the 13 models — list, detail (`GET /{id}`), update,
delete, search, CSV/export endpoints, and any analytics/aggregation query that
reads these tables directly (e.g. pipeline counts, insights) — must route through
one of the two helper functions. Phase 1's implementation plan enumerates every
router file touching these 13 models (not just the 6 with `owner_scope` today) as
a concrete checklist, since this is explicitly called out as a required safeguard,
not an optional cleanup.

### 4.3 CEO-owned records default private

One helper, `set_ownership_defaults(record, current_user)`, called at every
record-creation site for the 13 models: if `current_user.role == "CEO"`, set
`record.is_private = True`. For every other role this is a no-op — zero behavior
change for existing ADMIN/employee creation flows.

### 4.4 Sharing API

`backend/app/routers/ceo.py` adds:

- `POST /api/ceo/shares` — body `{resource_type, resource_id, shared_with_user_id}`.
  Server validates: (a) resource exists, (b) `current_user.id == resource.owner_id`
  (only the owner can share their own record — the CEO, for Phase 1, since CEO is
  the only role whose records route through this flow in practice; the check is by
  ownership, not by hardcoding "CEO", so it stays correct if sharing is ever opened
  to other owners later), (c) no existing *active* share for the same triple (409 if
  so). Writes `AuditLog(action="share_granted", ...)`.
- `DELETE /api/ceo/shares/{share_id}` — only `granted_by_user_id == current_user.id`
  may revoke. Sets `revoked_at = now()`. Writes `AuditLog(action="share_revoked",
  ...)`. Because `apply_visibility_filter`/`get_visible_or_404` check
  `revoked_at IS NULL` live on every request (no caching), revocation is effective
  immediately on the next request — no separate invalidation step needed.
- `GET /api/ceo/shares` — list shares the CEO has granted (and their status).

### 4.5 CEO role wiring

- Add `CEO = "CEO"` to `UserRole`.
- Add `require_ceo` dependency (same shape as `require_admin`).
- Add `CEO` to the allowed-roles list inside `require_business_development`, so the
  CEO can use all existing BD/CRM screens and endpoints (reuses existing modules
  per the brief's "do not duplicate" instruction). Deliberately **not** added to
  `require_admin` — per the confirmed policy, CEO does not inherit user-management
  or system-settings capability; that stays ADMIN-only.

### 4.6 Account provisioning

`backend/scripts/provision_ceo.py`, modeled on `seed.py`:

- Reads `CEO_NAME`, `CEO_EMAIL`, `CEO_PASSWORD` from environment; if `CEO_PASSWORD`
  is unset, prompts via `getpass` (never hardcoded, never printed, never logged).
- Idempotent: refuses to run if a `CEO`-role user already exists, unless `--rotate`
  is passed (rotates the password and re-sets `must_change_password`, for a
  CEO-forgot-password recovery path operated by whoever has server/CLI access).
- Always sets `must_change_password = True` on create or rotate.
- Writes `AuditLog(action="ceo_account_provisioned" | "ceo_account_rotated", ...)`.

### 4.7 Forced password change — enforced server-side, not just via JWT claim

Safeguard requirement: don't trust a JWT claim alone, since a token issued before
a password change could otherwise remain valid forever (this hand-rolled JWT setup
has no server-side session store to revoke against today).

- Add `iat` (issued-at) to the JWT payload at login (`core/security.py` already
  signs/verifies manually — this is one more payload field).
- `get_current_user` (the lowest-level, always-DB-backed dependency used by every
  protected route) additionally compares the token's `iat` against the user's live
  `password_changed_at` from the database on every request. If the token was
  issued before the last password change, reject with 401 — this is the actual
  session-revocation mechanism: changing the password invalidates every
  previously issued token immediately, without needing a token blacklist table.
- A second dependency, `require_password_already_set`, wraps `get_current_user`
  and raises 403 (`PASSWORD_CHANGE_REQUIRED`) if `user.must_change_password` is
  true. Critically, `require_role`, `require_business_development`, `require_admin`,
  and `require_ceo` are changed to depend on `require_password_already_set` instead
  of `get_current_user` directly — so this is enforced automatically on every
  route that already gates by role, present or future, with no per-router allow-list
  to maintain and no "alternative access path" that silently skips it. Only
  `POST /api/auth/change-password`, `POST /api/auth/logout`, and `GET /api/auth/me`
  depend on bare `get_current_user`, since they must remain reachable while a
  forced change is pending.
- `POST /api/auth/change-password`: validates current password, sets new password
  hash, sets `password_changed_at = now()`, clears `must_change_password`. Because
  of the `iat` check above, this alone invalidates the token that was just used to
  call it — the frontend must treat the response as "log in again," not "continue
  using the old token."
- Login response includes `must_change_password` so the frontend can route
  straight to the change-password screen without an extra round trip.

### 4.8 CEO executive dashboard shell

- `GET /api/ceo/overview` (CEO-only): org-wide counts only — total employees, total
  active users, total organizations, total opportunities, total open tasks. No
  per-employee drill-down, no pipeline/workflow detail — that's a later phase.
- Frontend: new `/ceo` route, gated by `role === 'CEO'` in the route guard, nav
  entry visible only to the CEO role, post-login redirect sends `CEO` role to
  `/ceo` instead of the default BD portal landing page. Minimal layout — a handful
  of stat cards reading `/api/ceo/overview`. No duplicate CRM screens; the CEO
  reaches existing Organizations/Contacts/etc. pages the same way ADMIN does today.

## 5. Explicitly out of scope for Phase 1

- Full executive dashboard content (team drill-down, pipeline detail, per-employee
  inspection) — brief §6/§7, later phase.
- Workflow automation visualization — brief §8, later phase.
- AI assistant, voice, Email/LinkedIn/WhatsApp integrations — brief §3-5, later
  phases.
- Knowledge base split — brief §9, later phase.
- Automation safety limits — brief §12, later phase.
- Extending the sharing/privacy mechanism's UI to non-CEO owners (the backend rule
  is owner-based, not CEO-hardcoded, so this is cheap to open up later, but no UI
  work for it ships in Phase 1).

## 6. Testing plan

Authorization/regression matrix, run for **all 13 entities** (not just
Organizations/Contacts):

| Check | What it verifies |
|---|---|
| List | Employee sees only own; ADMIN sees all non-private; CEO sees all including private |
| Detail (`GET /{id}`) | Same as list, plus 404 (not 403) for invisible records |
| Update / Delete | Attempting to mutate an invisible record is rejected the same as detail |
| Search | Search results respect the same visibility rule, no leakage via query params |
| Export (CSV/etc.) | Exported rows respect visibility — no private-record leakage through a bulk path |
| Shared record | Named admin/employee gains access after grant |
| Revoked share | Access removed immediately after revoke, same session, no caching |
| CEO-private record | Owner (CEO) always sees it; ADMIN and employees never see it unless shared |
| Relationship/analytics leakage | Aggregation/insights endpoints that join these 13 tables don't surface private records' data (e.g. counts, names) to someone who shouldn't see the underlying record |
| `owner_scope=all` regression | Employee sending this param no longer sees other employees' records (confirms the bug is closed) |
| Existing ADMIN/employee behavior | No regression on pre-existing non-private data for either role |
| Forced password change | Protected routes return 403 until changed; `/change-password`, `/logout`, `/me` remain reachable; old token rejected (401) immediately after a successful change |
| Provisioning script | Idempotent on second run without `--rotate`; `--rotate` resets password and `must_change_password` |
| Migration | Existing rows' `is_private` stay `False` after running the migration script; no existing row changes ownership/visibility |

## 7. Non-goals / explicit "do not" constraints carried from the brief

- Do not rebuild existing modules — the 13-model visibility layer wraps existing
  routers, it doesn't replace them.
- Do not duplicate CRM functionality — CEO reuses existing BD screens via
  `require_business_development`.
- Do not hardcode CEO credentials — provisioning is env-var/`getpass`-only.
- Do not break existing employee accounts — `is_private` defaults `False`;
  `ADMIN`'s existing non-private access is unchanged; employees keep today's
  "mine" behavior (the only change for employees is that the `owner_scope=all`
  loophole closes).
- Do not expose private CEO information — enforced by the single shared
  visibility layer, not per-router judgment calls.
- Do not claim successful external actions without verification — not yet
  applicable in Phase 1 (no external actions here); binding for later phases.
