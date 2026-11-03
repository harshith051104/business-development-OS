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

1. **CEO** — full organization-wide read access to every employee's records,
   **including records that existed before the CEO role was introduced or
   before a given user was promoted to CEO** (rule 1 in §4.2 is unconditional
   and carries no "created after X" qualifier) — plus a private workspace for
   the CEO's own records. The CEO-private-by-default behavior in §4.3 only
   governs which of the *CEO's own* records start out private; it never
   narrows what the CEO themself can see.
2. **ADMIN** — manages users and system settings, and retains access to all
   non-private company records exactly as today, but can never automatically see
   a CEO-private record.
3. **Employees** — see only their own records, plus anything explicitly shared with
   them. (This is tightened from current behavior — see §4.2.)
4. **Explicit sharing** — the CEO can share a specific private record with a named
   admin or employee. Revocation takes effect immediately.
5. **Audit logging** — every share grant, share revocation, privileged
   (shared-record) access, and **denied attempt to access a CEO-private
   record** is recorded in the existing `AuditLog`. Log entries never contain
   passwords, tokens, or the record's own field values — only actor, action,
   resource identifiers, and timestamp/route metadata.

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

This non-retroactivity rule is about *privacy flags on the promoted user's own
past records*, not about *what the CEO role can see*. The two are independent:
a promoted CEO's old `BUSINESS_DEVELOPMENT`-era records stay `is_private=False`
(so they look exactly as they did before promotion to everyone who could see
them then) — but the CEO's organization-wide visibility (§4.2 rule 1) already
covers every existing record in the system, historical or new, private or not,
from day one of the role existing. Nothing about Phase 1 limits CEO visibility
to records created after the role was introduced.

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
6. Otherwise → not visible. If the reason is specifically that `record.is_private
   is True` (i.e. the request was denied *because* it hit a CEO-private record,
   not just ordinary non-ownership), `get_visible_or_404` additionally writes
   `AuditLog(action="ceo_private_access_denied", actor_id, resource_type,
   resource_id, route)` before raising 404 — a failed privileged-access attempt
   is itself a signal worth recording. `apply_visibility_filter` does not emit
   this per-row (it filters silently, as a list query touching N private rows
   isn't N attack attempts), but logs one `ceo_private_access_denied_bulk` event
   per request when it actually excluded at least one private row, with a count
   and no row identifiers. As with every other audit entry in this spec: never
   log request/response bodies, passwords, tokens, or other record field values
   — only identifiers, actor, action, and route/timestamp metadata.

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

Leakage is not only direct list/detail responses — a private record's existence
or data can leak through narrower, easy-to-miss surfaces that read the same
tables but don't look like a "list endpoint." The implementation plan's router
audit explicitly includes:

- **Dashboard counts/widgets** — any aggregate number (e.g. "12 open
  opportunities") must be computed from an already-filtered query, not a raw
  `COUNT(*)`, or a non-CEO's dashboard will indirectly reveal how many private
  records exist.
- **Dropdowns / autocomplete / typeahead** — org, contact, and campaign pickers
  used when creating other records (e.g. "link this task to an organization")
  must not list CEO-private organizations/contacts to non-CEO users.
- **Notifications** — any notification payload referencing a record (follow-up
  due, task assigned) must check visibility before being generated for a
  non-owning user; a notification is itself a leak if it names a private record.
- **Nested/embedded responses** — e.g. a `Contact` detail response that embeds
  its parent `Organization` summary, or a `Meeting` response embedding attendee
  `Contact` records, must apply the same visibility check to the embedded
  object, not just the top-level one.
- **Search suggestions** — "did you mean" / fuzzy-match suggestions must come
  from the visibility-filtered set, not the full table.
- **Exports** (already listed above) and **relationship/analytics queries**
  (already listed above) are repeated here because they're the two surfaces
  most likely to join across tables and reintroduce an unfiltered subquery.

The expanded testing matrix in §6 adds a row for this category.

### 4.3 CEO-owned records default private

One helper, `set_ownership_defaults(record, current_user)`, called at every
record-creation site for the 13 models: if `current_user.role == "CEO"`, set
`record.is_private = True`. For every other role this is a no-op — zero behavior
change for existing ADMIN/employee creation flows.

### 4.4 Sharing API

`backend/app/routers/ceo.py` adds:

- `POST /api/ceo/shares` — body `{resource_type, resource_id, shared_with_user_id}`.
  Server validates, in order, rejecting on the first failure:
  1. `resource_type` is one of the 13 known models (reject unknown types —
     prevents probing for tables outside this feature's scope).
  2. The resource exists (404 if not — same "don't confirm existence" posture
     as `get_visible_or_404`).
  3. `current_user.id == resource.owner_id` (only the owner can share their own
     record — the CEO, for Phase 1, since CEO is the only role whose records
     route through this flow in practice; the check is by ownership, not by
     hardcoding "CEO", so it stays correct if sharing is ever opened to other
     owners later). 403 otherwise.
  4. `shared_with_user_id` refers to a **real, currently active** user account
     (exists, not soft-deleted/disabled if the codebase has such a flag). 404/
     422 if not — sharing to a nonexistent or deactivated account is rejected,
     not silently accepted as a no-op row.
  5. `shared_with_user_id` holds a role Phase 1 actually supports sharing *to*
     — i.e. not another `CEO` (a second CEO already has unconditional
     visibility via rule 1 in §4.2, so a share row would be meaningless and is
     rejected as 422 rather than silently accepted as dead data).
  6. `shared_with_user_id != current_user.id` — **self-sharing is rejected**
     (422): the owner already has unconditional access via rule 2 in §4.2, so
     a self-share is either a no-op or a client bug, and allowing it would
     create a confusing, meaningless audit trail entry.
  7. No existing *active* share for the same `(resource_type, resource_id,
     shared_with_user_id)` triple (409 if so — prevents duplicate active
     shares).
  On success, writes `AuditLog(action="share_granted", actor_id, resource_type,
  resource_id, shared_with_user_id)`.
- `DELETE /api/ceo/shares/{share_id}` — only `granted_by_user_id == current_user.id`
  may revoke (owner-only, same as granting — 403 otherwise, 404 if the share
  doesn't exist). Sets `revoked_at = now()`. Writes `AuditLog(action="share_revoked",
  ...)`. Because `apply_visibility_filter`/`get_visible_or_404` check
  `revoked_at IS NULL` live on every request (no caching), revocation is effective
  immediately on the next request — no separate invalidation step needed. There
  is no code path that reads a share row without also checking `revoked_at`, so
  a revoked share granting access would only be possible through a bug in that
  check, not a missing invalidation step — this is exactly why the testing plan
  (§6) requires a dedicated test calling the *same* visibility check twice,
  before and after revocation, in the same test run, rather than trusting that
  "revocation exists" implies "revocation works."
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

**Clock precision and timezone handling (must be exact, not "close enough"):**

- `iat` is a standard JWT numeric claim: integer seconds since the Unix epoch,
  UTC, no timezone component — set as `int(datetime.now(timezone.utc).timestamp())`
  at token issuance. This matches the JWT spec (RFC 7519 §4.1.6) and avoids any
  ambiguity about which timezone an `iat` value is "in."
- `password_changed_at` is stored as a UTC-aware `DateTime` column (the codebase
  must be checked for whether existing datetime columns are naive-UTC or
  timezone-aware, and the comparison written to match that convention exactly —
  mixing naive and aware datetimes is the most common way this kind of check
  silently always-passes or always-fails). The comparison in `get_current_user`
  converts both sides to integer UTC epoch seconds before comparing, so the
  seconds-vs-microseconds precision mismatch between a JWT's integer `iat` and a
  database timestamp's sub-second precision never causes a false result.
- **Boundary rule:** reject the token if `token_iat <= floor(password_changed_at)`.
  Use `<=`, not strict `<` — a token issued in the *same* second as the password
  change must be rejected too, and `<=` is the only comparison that does that:
  plain `<` only rejects a token whose `iat` is strictly earlier, so a token
  stamped with the exact same epoch second as `password_changed_at` would
  satisfy `token_iat < password_changed_at_epoch` as `False` and incorrectly be
  accepted. `change-password` sets `password_changed_at` *after* reading the
  request, so any token whose `iat` falls in or before that second was
  necessarily issued before the change completed and must not survive it.
  This is the one deliberately conservative edge case in the design: it can very
  rarely reject a token that was technically issued after the change within the
  same wall-clock second, which just forces an extra re-login — acceptable,
  since the alternative (a stale token surviving a password change) is the
  actual security property being enforced here.
- A new `User.must_change_password = False`/no password change yet means
  `password_changed_at IS NULL`; in that case the `iat` check is skipped
  entirely (nothing to invalidate against) and only the `must_change_password`
  check applies.
- This logic lives in one place (`backend/app/core/security.py` or
  `backend/app/auth/deps.py`, wherever `get_current_user` already lives) and is
  unit-tested directly — not only through integration tests — with explicit
  cases: token issued 1 second before change (rejected, `token_iat <
  password_changed_at_epoch`), token issued in the *same* second as change
  (rejected, `token_iat == password_changed_at_epoch`, caught by the `<=`
  specifically — this is the case a plain `<` would get wrong and must be
  asserted explicitly), token issued 1 second after change (accepted,
  `token_iat > password_changed_at_epoch`), and `password_changed_at IS NULL`
  (iat check skipped entirely, only `must_change_password` gates).

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
| Revoked share | Access removed immediately after revoke, same session, no caching — checked via one test that calls the visibility helper before and after revocation |
| CEO-private record | Owner (CEO) always sees it; ADMIN and employees never see it unless shared |
| CEO visibility of historical records | A CEO sees records created before the CEO role/account existed, including other users' pre-existing private-irrelevant data, without any "created after" cutoff |
| Relationship/analytics leakage | Aggregation/insights endpoints that join these 13 tables don't surface private records' data (e.g. counts, names) to someone who shouldn't see the underlying record |
| Indirect leakage surfaces | Dashboard counts, dropdown/autocomplete pickers, notifications, nested/embedded responses, and search suggestions each respect visibility — a non-CEO's org picker never lists a CEO-private organization, a dashboard count never includes private rows, etc. |
| `owner_scope=all` regression | Employee sending this param no longer sees other employees' records (confirms the bug is closed) |
| Existing ADMIN/employee behavior | No regression on pre-existing non-private data for either role |
| Sharing validation | Reject: unknown `resource_type`, nonexistent/deactivated recipient, recipient role `CEO`, self-share, non-owner caller granting or revoking, duplicate active share |
| Forced password change | Protected routes return 403 until changed; `/change-password`, `/logout`, `/me` remain reachable; old token rejected (401) immediately after a successful change |
| JWT `iat` boundary cases | Token issued 1s before password change (rejected), same second — `token_iat == password_changed_at_epoch` (rejected by the `<=` comparison in §4.7, the case plain `<` would wrongly accept), 1s after (accepted), `password_changed_at IS NULL` (iat check skipped) |
| Privileged-access audit | `ceo_private_access_denied` / `_bulk` entries are written on denied access to a private record, with no field values in the log payload |
| Provisioning script | Idempotent on second run without `--rotate`; `--rotate` resets password and `must_change_password` |
| Migration | Existing rows' `is_private` stay `False` after running the migration script; no existing row changes ownership/visibility |
| Full regression suite | The existing backend test suite (all pre-Phase-1 tests, not just the new authorization tests above) passes unchanged, confirming no existing ELLY functionality regressed |

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

Phase 1 is not "done" on new-test-green alone: the full pre-existing backend
test suite must also be run and pass before Phase 1 is reported complete (last
row of §6), since the safeguards above (deleting the six `owner_scope` blocks,
changing what every role-gated dependency depends on) touch shared code paths
widely enough that a passing new-test suite alone would not catch an
unintended behavior change in an unrelated existing test.
