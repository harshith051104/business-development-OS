# CEO RBAC Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a distinct `CEO` role with org-wide visibility and a private-by-default workspace, close the existing `owner_scope=all` visibility bug across all 13 `owner_id`-bearing models, enforce forced first-login password change with real session invalidation, and ship a CEO account-provisioning script plus a minimal CEO dashboard shell.

**Architecture:** One generic visibility module (`backend/app/core/visibility.py`) becomes the single code path that decides whether any user can see any row of the 13 existing models; every router, service, and copilot tool touching those models is migrated to call it instead of and-rolling `owner_id`/`owner_scope` checks. A new `record_shares` table and `backend/app/routers/ceo.py` add explicit per-record sharing. JWT `iat` (already present in the token) gets a verification side in `get_current_user`, compared against a new `User.password_changed_at`, so changing a password invalidates every previously issued token without a blacklist table.

**Tech Stack:** FastAPI, SQLAlchemy (SQLite, no Alembic — manual `ALTER TABLE` shim in `backend/app/main.py`, matching the existing pattern), pytest, React + TypeScript + react-router-dom (frontend).

**Spec:** `docs/superpowers/specs/2026-11-03-ceo-rbac-phase1-design.md`

## Global Constraints

- Add `is_private BOOLEAN NOT NULL DEFAULT 0` to all 13 models: `Organization`, `Contact`, `Opportunity`, `BDTask` (table `tasks`), `FollowUp`, `Meeting`, `Demo`, `Proposal`, `Negotiation`, `Partnership`, `Customer`, `Communication`, `Campaign`.
- Add to `User`: `must_change_password BOOLEAN NOT NULL DEFAULT 0`, `password_changed_at DATETIME NULL`.
- New table `record_shares`: `id, resource_type (str), resource_id (int), shared_with_user_id (FK users), granted_by_user_id (FK users), granted_at (datetime), revoked_at (datetime, nullable)`. Active-share uniqueness on `(resource_type, resource_id, shared_with_user_id)` where `revoked_at IS NULL` is enforced in application code, not a DB constraint. Create the table with `RecordShare.__table__.create(bind=engine, checkfirst=True)`, never with a bare `Base.metadata.create_all()` call, so creating this one new table never has the side effect of touching every other model's table outside the places that already call `create_all` deliberately.
- No Alembic in this repo. Schema changes ship as `backend/scripts/migrate_ceo_rbac_phase1.py`, following the existing manual-`ALTER TABLE` shim pattern in `backend/app/main.py:81-266`. It only adds columns/tables with safe defaults; it never rewrites an existing row's `is_private`.
- **Rollback is destructive and manual-only.** `backend/scripts/rollback_ceo_rbac_phase1.py` drops `is_private`, `must_change_password`, `password_changed_at`, and the entire `record_shares` table — this discards every privacy setting, password-change timestamp, and sharing grant created after Phase 1 went live, with no way to recover them. The script must refuse to run unless called with an explicit `--confirm-backup-taken` flag, must print a clear warning before touching anything, and must never be invoked automatically by any exception handler, startup shim, or other failure-recovery code path anywhere in this plan — rollback is a human decision, not an automatic recovery step.
- `apply_visibility_filter(query, model, current_user, db, owner_scope=None)` and `get_visible_or_404(db, model, record_id, current_user)` in `backend/app/core/visibility.py` are the **only** code path allowed to decide visibility. Every list/detail/update/delete/search/autocomplete/export/notification/dashboard/timeline/analytics endpoint or service function touching the 13 models must route through one of them. `db` is a required parameter on `apply_visibility_filter` (not optional) because the helper itself writes the `ceo_private_access_denied_bulk` audit row — it cannot borrow a session from somewhere else.
- **`owner_scope` is a UI narrowing control, never an authorization widening control.** `apply_visibility_filter` first computes the caller's fully-authorized result set per the 6 rules below, then, only if `owner_scope == "own"`, narrows that already-authorized set to `model.owner_id == current_user.id`. `owner_scope == "all"` or `None` returns the full authorized set unchanged. For an employee, the authorized set is always "own + explicitly shared with me" regardless of what `owner_scope` value is sent — the parameter has no visible effect for that role, by construction, because narrowing a set that is already "own + shared" to "own" only removes rows; it can never add the all-employees view a forged `owner_scope=all` might otherwise try to request. Only `ADMIN` and `CEO` get a visible difference between `owner_scope=own` and `owner_scope=all`.
- JWT boundary rule: reject the token if `token_iat <= floor(password_changed_at_epoch)`. Use `<=`, not `<`.
- `CEO` is added to the allow-list inside `require_business_development`. `CEO` is deliberately **not** added to `require_admin`.
- `require_role`, `require_business_development`, `require_admin`, `require_ceo` all depend on `require_password_already_set` instead of `get_current_user` directly. Only `POST /api/auth/change-password`, `POST /api/auth/logout`, `GET /api/auth/me` depend on bare `get_current_user`.
- Audit actions to add, all via existing `log_audit_event` (`backend/app/core/audit.py:1-59`): `share_granted`, `share_revoked`, `shared_record_access`, `ceo_private_access_denied`, `ceo_private_access_denied_bulk`, `ceo_account_provisioned`, `ceo_account_rotated`. Never log passwords, tokens, or record field values. `ceo_private_access_denied_bulk`'s count must be computed as rows where `is_private IS TRUE AND owner_id != current_user.id AND no active record_shares row exists for current_user` — it must never include rows the caller owns or has an active share for, and it must never fire at all for a `CEO` caller (rule 1 bypasses every other rule, so there is nothing to deny). `shared_record_access` must be written **at most once per request**, regardless of how many shared records that request returns — one row naming the accessing user, the resource type, and the list of resource IDs actually shared-and-returned, written via `log_shared_access` (Task 2) — never once per row, and never including record field values.
- `set_ownership_defaults(record, current_user)` is a no-op for every role except `CEO`; zero behavior change for existing ADMIN/employee creation flows.
- **`UserRole` has five existing values, not two — re-verified directly against the model, not assumed.** `backend/app/models/user.py:7-12` defines `BUSINESS_DEVELOPMENT`, `HEALTHCARE`, `ADMIN`, `USER`, `DEV`; Task 3 adds a sixth, `CEO`. No task in this plan may assume a two-role system.
- **Dashboard counting is precisely scoped** (role groupings confirmed with the user, not guessed). In `GET /api/ceo/overview`, `total_employees` counts only `User.role == "BUSINESS_DEVELOPMENT" AND User.is_active IS TRUE` — it deliberately excludes `HEALTHCARE`, `USER`, `DEV`, `ADMIN`, and `CEO`, plus every inactive account regardless of role. The exclusion of `HEALTHCARE`/`USER`/`DEV` is intentional, confirmed with the user: this metric reports the BD sales workforce specifically, not every account that can log in. `total_active_users` counts every role (`BUSINESS_DEVELOPMENT` + `HEALTHCARE` + `ADMIN` + `USER` + `DEV` + `CEO`) where `is_active IS TRUE` — it is deliberately a different, larger number than `total_employees`, and the frontend must label the two distinctly rather than treating them as interchangeable headcounts.
- Phase 1 is not done until the **full pre-existing backend test suite** (not just new tests) passes — this is the final task, not optional.
- No Phase 2 work (AI assistant, Email/LinkedIn/WhatsApp, workflow visualization, KB split, automation limits) in any task below.

## Review Focus

- **`owner_scope=all` bypass must actually close for every one of the 6 routers that have it today**, not just the one the spec quotes (`organizations.py`) — each of `contacts.py`, `meetings.py`, `campaigns.py`, `followups.py`, `insights.py` has its own copy of the buggy block; a reviewer approving the router-migration task must see all six deleted, not a representative one. Covered by: Task 6.
- **Indirect leakage through admin's per-employee dashboard counts** (`backend/app/routers/admin.py:251-268,427-429`) — these run raw `db.query(Model).filter(Model.owner_id == user.id)` counts with no `is_private` exclusion, so an admin viewing a CEO's per-user stats would see counts that include CEO-private records. Covered by: Task 6.
- **JWT `iat` same-second boundary** — a token stamped with the exact same epoch second as `password_changed_at` must be rejected (`<=`), and this is the one case a naive `<` implementation gets wrong silently (tests still pass unless this exact case is asserted). Covered by: Task 3.
- **Sharing API edge cases that look like plausible "accept" but must reject**: self-share, share to another `CEO`, share to a deactivated/nonexistent user, duplicate active share, non-owner attempting to grant or revoke. A plan that only tests the happy path would miss all five. Covered by: Task 8.
- **CEO visibility of historical records has no "created after" cutoff** — a CEO must see every pre-existing record system-wide from the moment the role exists, and promoting an existing user to CEO must not retroactively flip `is_private` on that user's own past records. Both halves need their own test; it is easy to get only one right. Covered by: Task 1 (migration non-retroactivity) and Task 7 (CEO sees pre-existing records with no date filter).
- **A forged `owner_scope` value must never expand an employee's visibility.** An employee request with `owner_scope=all` (or any other value) must return the exact same rows as a request with no `owner_scope` at all — never the all-employees view that only `ADMIN`/`CEO` can reach. Covered by: Task 2.
- **Shared-record access must be audited on the read path, not just the grant/revoke path.** A test that only checks `share_granted`/`share_revoked` logging would miss whether anyone actually logs when the share is *used* — list, search, and detail reads of a shared record must each write `shared_record_access` exactly once per request. Covered by: Task 2 (unit), Task 6/7 (list-endpoint wiring).

---

## Task 1: Data model — `is_private`, password-change columns, `record_shares` table, migration script

**Files:**
- Create: `backend/app/models/record_share.py`
- Modify: `backend/app/models/user.py` (add two columns to `User`)
- Modify: `backend/app/models/organization.py`, `contact.py`, `opportunity.py`, `task.py`, `followup.py`, `meeting.py`, `demo.py`, `proposal.py`, `negotiation.py`, `partnership.py`, `customer.py`, `communication.py`, `campaign.py` (add `is_private` column to each)
- Modify: `backend/app/models/__init__.py` (export `RecordShare`)
- Modify: `backend/app/main.py` — add `import app.models.record_share  # noqa: F401` after line 74 (last existing side-effect import, `app.models.report`); add a new `ALTER TABLE` block per table inside the `try:` block at lines 81-266, following the existing per-table pattern (e.g. the `organizations` block at lines 86-104); call `RecordShare.__table__.create(bind=engine, checkfirst=True)` explicitly rather than relying on the broader `Base.metadata.create_all(bind=engine)` at line 79 to pick it up incidentally
- Create: `backend/scripts/migrate_ceo_rbac_phase1.py`
- Create: `backend/scripts/rollback_ceo_rbac_phase1.py`
- Test: `backend/tests/test_migration_ceo_rbac_phase1.py`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `RecordShare` model (`id, resource_type: str, resource_id: int, shared_with_user_id: int, granted_by_user_id: int, granted_at: datetime, revoked_at: Optional[datetime]`); `User.must_change_password: bool`, `User.password_changed_at: Optional[datetime]`; `is_private: bool` column present on all 13 models, default `False`. All later tasks rely on these exact names.

- [ ] **Step 1: Write the failing migration test**

```python
def test_migration_adds_columns_without_changing_existing_rows(tmp_sqlite_db):
    # seed an Organization row before migration, assert is_private column
    # does not exist yet, run migrate_ceo_rbac_phase1.main(), then assert
    # the row's is_private reads False and owner_id/other fields are unchanged.
def test_migration_is_idempotent_on_second_run(tmp_sqlite_db):
    # running migrate twice does not raise and does not duplicate columns/tables.
def test_rollback_refuses_without_confirm_flag(tmp_sqlite_db):
    # calling rollback main() with no --confirm-backup-taken flag raises/exits
    # non-zero and makes no schema change at all.
def test_rollback_drops_added_columns_and_table_when_confirmed(tmp_sqlite_db):
    # run migrate, then rollback with --confirm-backup-taken; assert
    # record_shares table is gone and is_private/must_change_password/
    # password_changed_at columns are gone.
def test_promoting_existing_user_to_ceo_does_not_retroactively_privatize_past_records(tmp_sqlite_db):
    # seed a BUSINESS_DEVELOPMENT user with existing non-private records, run
    # the migration, then flip that user's role to CEO directly in the DB —
    # assert their pre-existing records still read is_private == False.
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_migration_ceo_rbac_phase1.py -v`
Expected: FAIL (`migrate_ceo_rbac_phase1` module not found)

- [ ] **Step 3: Implement the model and column changes**

`RecordShare` in `backend/app/models/record_share.py` — standard SQLAlchemy model, `__tablename__ = "record_shares"`, columns as listed in Interfaces. Add `is_private = Column(Boolean, nullable=False, default=False, server_default="0")` to each of the 13 model files, following each file's existing column style. Add `must_change_password = Column(Boolean, nullable=False, default=False, server_default="0")` and `password_changed_at = Column(DateTime, nullable=True)` to `User` in `user.py`, next to the existing `created_at`/`updated_at` columns (same `datetime.now(timezone.utc)`-style convention already used there).

- [ ] **Step 4: Implement `migrate_ceo_rbac_phase1.py`**

Mirror `backend/app/main.py`'s existing shim exactly: for each of the 13 tables, `PRAGMA table_info(<table>)`, and if `is_private` is missing, `ALTER TABLE <table> ADD COLUMN is_private BOOLEAN DEFAULT 0`. Same for `users.must_change_password` / `users.password_changed_at`. For `record_shares`, call `RecordShare.__table__.create(bind=engine, checkfirst=True)` after importing `app.models.record_share` — this creates only that one table, never the whole app's metadata. Script is runnable standalone (`python backend/scripts/migrate_ceo_rbac_phase1.py`) and importable as `main()` for the test.

- [ ] **Step 5: Implement `rollback_ceo_rbac_phase1.py`**

`argparse` with a required `--confirm-backup-taken` flag; if absent, print the destructive-action warning (lists exactly what will be lost: `is_private` settings, `password_changed_at`/`must_change_password` state, every `record_shares` row) and exit non-zero without touching the database. If present, `ALTER TABLE ... DROP COLUMN` for each added column (SQLite 3.35+ supports `DROP COLUMN` directly; this repo's SQLite version should be checked — if older, document the rename-and-recreate fallback in the script's docstring) and `DROP TABLE record_shares`. The module-level docstring states plainly that this script is destructive, irreversible, and must only be run manually by a human who has already taken a backup — never from code. Also runnable standalone and importable as `main(argv)` for the test.

- [ ] **Step 6: Also add the matching `ALTER TABLE` blocks into `backend/app/main.py`'s startup shim**

So a developer running the app fresh (not via the migration script) still gets the columns — same reasoning as every other block already in that `try:`. Add `import app.models.record_share  # noqa: F401` at line 75, and the `RecordShare.__table__.create(bind=engine, checkfirst=True)` call near the existing `Base.metadata.create_all(bind=engine)` at line 79 (immediately after it, not as a replacement for it).

- [ ] **Step 7: Run tests to verify they pass**

Run: `pytest backend/tests/test_migration_ceo_rbac_phase1.py -v`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/app/models/record_share.py backend/app/models/user.py backend/app/models/organization.py backend/app/models/contact.py backend/app/models/opportunity.py backend/app/models/task.py backend/app/models/followup.py backend/app/models/meeting.py backend/app/models/demo.py backend/app/models/proposal.py backend/app/models/negotiation.py backend/app/models/partnership.py backend/app/models/customer.py backend/app/models/communication.py backend/app/models/campaign.py backend/app/models/__init__.py backend/scripts/migrate_ceo_rbac_phase1.py backend/scripts/rollback_ceo_rbac_phase1.py backend/tests/test_migration_ceo_rbac_phase1.py
git commit -m "feat: add is_private, password-change columns, and record_shares table"
```

Note: `backend/app/main.py` already has unrelated uncommitted changes (SEC EDGAR feature) at the time of writing this plan. Stage only the specific added lines from `main.py` (the import addition, the `RecordShare.__table__.create` call, and the new `ALTER TABLE` block) — use `git add -p backend/app/main.py` if a plain `git add` would sweep in the unrelated diff, and confirm with `git diff --cached backend/app/main.py` before committing.

---

## Task 2: Generic visibility module

**Files:**
- Create: `backend/app/core/visibility.py`
- Test: `backend/tests/test_visibility.py`

**Interfaces:**
- Consumes: `RecordShare`, `is_private` column, `User.role` (from Task 1).
- Produces: `apply_visibility_filter(query: Query, model: Type, current_user: User, db: Session, owner_scope: Optional[str] = None) -> Query`; `get_visible_or_404(db: Session, model: Type, record_id: int, current_user: User) -> Any` (raises `HTTPException(404)`); `set_ownership_defaults(record: Any, current_user: User) -> None`; `log_shared_access(db: Session, model: Type, current_user: User, resource_ids: List[int]) -> None`. Tasks 6, 7, 8, 10 call these by exact name and signature — `db` is a required positional/keyword parameter on `apply_visibility_filter`, not optional.

- [ ] **Step 1: Write failing tests for the 6-rule order from spec §4.2, plus the audit-count and owner_scope semantics**

```python
def test_ceo_sees_private_record_owned_by_other_user(db_session, ...):
    # rule 1: CEO always visible regardless of owner/is_private.
def test_owner_always_sees_own_private_record(db_session, ...):
    # rule 2.
def test_shared_user_sees_private_record_and_logs_shared_record_access(db_session, ...):
    # rule 3: active record_shares row grants access; AuditLog row written.
def test_revoked_share_no_longer_grants_access(db_session, ...):
    # same helper called before and after setting revoked_at — must flip from visible to not.
def test_admin_sees_non_private_but_not_private(db_session, ...):
    # rule 4.
def test_employee_never_sees_other_employees_non_private_record(db_session, ...):
    # rule 5: owner_scope has no bearing — tests apply_visibility_filter directly
    # with no owner_scope param passed at all.
def test_employee_forged_owner_scope_all_does_not_expand_visibility(db_session, ...):
    # same employee, same query, owner_scope="all" explicitly passed — result set
    # is identical to the no-param case above, never the all-employees view.
def test_admin_owner_scope_own_narrows_to_only_their_own_records(db_session, ...):
    # ADMIN with two non-private records (own + another employee's): owner_scope="own"
    # returns only the ADMIN's own row; owner_scope="all"/None returns both.
def test_ceo_owner_scope_own_narrows_to_only_their_own_records(db_session, ...):
    # same narrowing behavior for CEO.
def test_get_visible_or_404_raises_404_not_403_for_invisible_record(db_session, ...):
    # rule 6, first half.
def test_get_visible_or_404_denied_private_access_writes_audit_log(db_session, ...):
    # rule 6, second half: AuditLog(action="ceo_private_access_denied", ...).
def test_bulk_audit_log_counts_only_private_rows_excluded_from_result(db_session, ...):
    # seed: one private row owned by current_user (visible), one private row
    # shared with current_user (visible), one private row owned by someone else
    # with no share (excluded). Assert ceo_private_access_denied_bulk count == 1,
    # not 3 — owned and shared rows must never be counted as denied.
def test_bulk_audit_log_never_fires_for_ceo_caller(db_session, ...):
    # same seed, current_user.role == "CEO" — no AuditLog row written at all.
def test_set_ownership_defaults_sets_is_private_true_only_for_ceo(db_session, ...):
    # no-op for every other role.
def test_log_shared_access_logs_once_for_ids_actually_shared(db_session, ...):
    # two shared ids + one non-shared id passed in one call -> exactly one
    # AuditLog(action="shared_record_access") row, metadata lists only the two shared ids.
def test_log_shared_access_writes_nothing_when_no_id_in_the_list_is_shared(db_session, ...):
def test_get_visible_or_404_logs_shared_record_access_on_successful_share_based_view(db_session, ...):
    # rule-3-only grant (not owner, not CEO, not ADMIN-non-private) -> one
    # shared_record_access row naming that single resource_id.
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_visibility.py -v`
Expected: FAIL (`backend.app.core.visibility` not found)

- [ ] **Step 3: Implement `apply_visibility_filter`, `get_visible_or_404`, `set_ownership_defaults`**

Implement the 6 rules in the exact order given in spec §4.2. `apply_visibility_filter` builds an `or_()` of: `current_user.role == "CEO"`; `model.owner_id == current_user.id`; an `EXISTS` subquery against `RecordShare` for `(model.__name__, model.id, current_user.id)` with `revoked_at IS NULL`; `and_(model.is_private.is_(False), current_user.role == "ADMIN")`; `and_(model.is_private.is_(False), model.owner_id == current_user.id)` (redundant with rule 2 but kept for rule-order fidelity to the spec) — call this the *authorized query*. If `owner_scope == "own"`, apply `.filter(model.owner_id == current_user.id)` on top of the authorized query before returning it; any other value of `owner_scope` (including `"all"` or `None`) returns the authorized query unchanged. After building the authorized query, if `current_user.role != "CEO"`, compute `excluded_count = db.query(model).filter(model.is_private.is_(True), model.owner_id != current_user.id).filter(~exists_active_share_subquery).count()` and call `log_audit_event(db, action="ceo_private_access_denied_bulk", ...)` once if `excluded_count > 0` — this count must exclude rows the caller owns or has an active share for, matching the test in Step 1. `get_visible_or_404` fetches the row by id, re-checks the same 6 rules for a single row, and on rule-6 denial where `record.is_private is True`, calls `log_audit_event(db, action="ceo_private_access_denied", resource_type=model.__name__, resource_id=record_id, user=current_user)` before raising `HTTPException(404)`. If the row is instead granted by rule 3 (an active share, not ownership, not CEO, not ADMIN-non-private), `get_visible_or_404` calls `log_shared_access(db, model, current_user, [record_id])` before returning the row.

`log_shared_access(db, model, current_user, resource_ids)` queries `RecordShare` for rows where `resource_type == model.__name__`, `resource_id.in_(resource_ids)`, `shared_with_user_id == current_user.id`, `revoked_at IS NULL`; if any match, calls `log_audit_event(db, action="shared_record_access", user=current_user, resource_type=model.__name__, resource_id=None, metadata={"resource_ids": [the matched ids]})` exactly once — one row naming every shared id in the call, never one row per id. If no id in `resource_ids` is actively shared with `current_user`, it writes nothing. List/search endpoints (Tasks 6, 7) call this once per request, after pagination, with the ids of the page actually returned, right before sending the response — this is what keeps the audit trail at one row per request regardless of how many shared records that page contains.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/test_visibility.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/visibility.py backend/tests/test_visibility.py
git commit -m "feat: add generic record-visibility module"
```

---

## Task 3: CEO role, `require_ceo`, forced-password-change dependency, JWT `iat` verification

**Files:**
- Modify: `backend/app/models/user.py` (add `CEO = "CEO"` to `UserRole`)
- Modify: `backend/app/auth/deps.py` (add `require_ceo`, `require_password_already_set`; change `get_current_user` to verify `iat`; change `require_role`/`require_business_development`/`require_admin` to depend on `require_password_already_set`)
- Modify: `backend/app/core/security.py` (no change to `create_access_token` — `iat` is already written at `security.py:110`; add a small helper for the epoch-seconds comparison if useful)
- Test: `backend/tests/test_auth_deps.py` (new cases added to existing file if present, else created)

**Interfaces:**
- Consumes: `User.password_changed_at`, `User.must_change_password` (Task 1).
- Produces: `require_ceo` (FastAPI dependency, same shape as `require_admin`); `require_password_already_set` (dependency wrapping `get_current_user`, raises 403 `PASSWORD_CHANGE_REQUIRED`). Task 4 and Task 10 depend on `require_ceo`; Task 4's endpoints depend on bare `get_current_user`.

- [ ] **Step 1: Write failing unit tests for the `iat` boundary, directly on the comparison logic**

```python
def test_token_issued_one_second_before_password_change_is_rejected():
    # token_iat = epoch; password_changed_at epoch = epoch + 1 -> rejected.
def test_token_issued_same_second_as_password_change_is_rejected():
    # token_iat == password_changed_at_epoch -> rejected by <=, the case a plain < would wrongly accept.
def test_token_issued_one_second_after_password_change_is_accepted():
    # token_iat == password_changed_at_epoch + 1 -> accepted.
def test_iat_check_skipped_when_password_changed_at_is_null():
    # password_changed_at is None -> no iat comparison performed, only must_change_password gates.
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_auth_deps.py -v`
Expected: FAIL

- [ ] **Step 3: Implement `UserRole.CEO`, `require_ceo`, `require_password_already_set`, and the `iat` check in `get_current_user`**

`UserRole` gets a sixth value, `CEO = "CEO"` (today it has five: `BUSINESS_DEVELOPMENT`, `HEALTHCARE`, `ADMIN`, `USER`, `DEV`, `user.py:7-12`). `require_ceo(current_user: User = Depends(require_password_already_set)) -> User`, mirroring `require_admin` at `deps.py:93-101` but checking `current_user.role == "CEO"`. `require_password_already_set(current_user: User = Depends(get_current_user)) -> User`: raise `HTTPException(403, detail="PASSWORD_CHANGE_REQUIRED")` if `current_user.must_change_password`, else return `current_user`. In `get_current_user` (`deps.py:14-60`), after the existing payload/user lookups succeed, add: if `user.password_changed_at is not None`, compute `password_changed_epoch = int(user.password_changed_at.replace(tzinfo=timezone.utc).timestamp())` if the column is naive-UTC (confirm against the convention already used for `User.created_at` in Task 1), compare `payload["iat"] <= password_changed_epoch` → raise 401 if true. Change `require_role`, `require_business_development` (`deps.py:82-90`), `require_admin` (`deps.py:93-101`) to depend on `require_password_already_set` instead of `get_current_user`. Add `CEO` to the allowed-roles set inside `require_business_development`; do not add it to `require_admin`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/test_auth_deps.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/user.py backend/app/auth/deps.py backend/tests/test_auth_deps.py
git commit -m "feat: add CEO role, require_ceo, and JWT iat verification on password change"
```

---

## Task 4: Forced password change — auth endpoint, schema, login response

**Files:**
- Modify: `backend/app/routers/auth.py` (add `POST /change-password`; surface `must_change_password` from `POST /login`)
- Modify: `backend/app/schemas/auth.py` (add `must_change_password` to `UserOut`; add `ChangePasswordRequest`/`ChangePasswordResponse`)
- Test: `backend/tests/test_auth_change_password.py`

**Interfaces:**
- Consumes: `require_password_already_set` is NOT used here — this endpoint depends on bare `get_current_user` per spec §4.7. Uses `User.password_changed_at`, `User.must_change_password` (Task 1), `get_current_user` (Task 3, unmodified signature).
- Produces: `POST /api/auth/change-password` (body: current password + new password; 200 on success). `UserOut.must_change_password: bool`. Frontend Task 11 reads this field from the login response.

- [ ] **Step 1: Write failing tests**

```python
def test_change_password_rejects_wrong_current_password():
def test_change_password_success_sets_password_changed_at_and_clears_flag():
def test_old_token_rejected_401_immediately_after_change_password():
    # same test flow as Task 3's boundary tests, exercised through the real endpoint.
def test_change_password_logout_me_reachable_while_must_change_password_true():
    # /change-password, /logout, /me all succeed with a must_change_password=True token;
    # any other protected route returns 403 PASSWORD_CHANGE_REQUIRED.
def test_login_response_includes_must_change_password_field():
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_auth_change_password.py -v`
Expected: FAIL

- [ ] **Step 3: Implement `POST /api/auth/change-password` in `auth.py`, extend `UserOut`**

`change_password(body: ChangePasswordRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db))`: verify `body.current_password` against `current_user.password_hash` (reuse whatever hashing helper `POST /login` already uses at `auth.py:19-75`); set new hash; `current_user.password_changed_at = datetime.now(timezone.utc)`; `current_user.must_change_password = False`; commit; `log_audit_event(db, action="password_changed", user=current_user)`. Add `must_change_password: bool` to `UserOut` in `schemas/auth.py`, populated from the model field (already matches by name, no extra mapping needed). `POST /login` (`auth.py:19-75`) response already builds `UserOut.model_validate(user)` — no change needed there beyond the schema field addition.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/test_auth_change_password.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/auth.py backend/app/schemas/auth.py backend/tests/test_auth_change_password.py
git commit -m "feat: add forced password-change endpoint and must_change_password in login response"
```

---

## Task 5: Repository-wide audit of every query site touching the 13 protected models

**Files:**
- Modify: this plan document (`docs/superpowers/plans/2026-11-03-ceo-rbac-phase1.md`) — append an "Endpoint Audit Results" section after this task, and extend Task 6's and Task 7's `Files`/step lists with anything found here that isn't already cited there.
- No application source files are created or modified in this task. This is a research task that gates Tasks 6 and 7 — its deliverable is a corrected, exhaustive scope for those two tasks, not code.

**Interfaces:**
- Consumes: nothing.
- Produces: the authoritative endpoint inventory that Tasks 6 and 7 implement against. Tasks 6/7 must not begin until this task's findings are merged into their own `Files` sections.

- [ ] **Step 1: Grep the backend for every access path to the 13 models beyond the list/detail/update/delete endpoints already cited in Tasks 6 and 7**

Search specifically for:
- `db.query(` / `select(` combined with each of the 13 model names, across `backend/app/routers/`, `backend/app/services/`, `backend/app/copilot/` (agent tools used by the Copilot assistant), and `backend/app/core/` (any scheduler job or background sweep that reads these models — cross-reference against the job names already seen in `main.py:409-426`, e.g. `task_due_sweep`, `task_reminder_sweep`, `signal_scan`).
- CSV/export endpoints: grep `csv|export` across `backend/app/routers/`.
- Search/autocomplete endpoints: grep `search|autocomplete` across `backend/app/routers/`.
- Notification generation: locate the notifications module (grep `class.*Notification|notification_service` repo-wide first to find its actual path, since it hasn't been confirmed yet this session) and check whether it queries any of the 13 models directly.
- Dashboard/stats aggregation beyond `admin.py`: grep `func.count|\.count\(\)` across `backend/app/routers/` and `backend/app/services/`.
- Nested/relationship responses: for each of the 13 models' Pydantic schemas (`backend/app/schemas/`), check whether a response model embeds a *list* of another protected model (e.g. an `Organization` response embedding its `contacts`) without that list already having passed through `apply_visibility_filter` upstream.
- Timeline/aggregation endpoints beyond `communications.py:216`: grep `timeline` repo-wide.

- [ ] **Step 2: Compile a table — file, line, what it queries, which of the 13 models, already covered by Task 6/7 or not**

- [ ] **Step 3: For every row not already covered, edit this plan file to add it to Task 6's or Task 7's `Files`/step list**

Task 6 for anything on the 6 already-`owner_scope`-bearing routers (`organizations.py, contacts.py, meetings.py, campaigns.py, followups.py, insights.py`) or `admin.py`; Task 7 for anything on the 8 fresh routers, or in a service/copilot/notification module not tied to one specific router.

- [ ] **Step 4: Append the full table from Step 2 to this plan as a new "## Endpoint Audit Results" section, placed immediately after this task and before Task 6**

- [ ] **Step 5: Report the findings to the user before Task 6 begins**

If the audit surfaces an access path the original spec didn't anticipate (e.g. a notification service that embeds unfiltered record data), say so explicitly — that is new scope the user has not yet seen, not something to silently fold into Task 6/7's existing line counts.

No commit for this task beyond the plan-document edit itself, which can be committed standalone (`git add docs/superpowers/plans/2026-11-03-ceo-rbac-phase1.md`) or folded into Task 6's first commit.

---

## Task 6: Migrate the 6 existing `owner_scope` routers + admin per-user dashboard counts

**Files:**
- Modify: `backend/app/routers/organizations.py:112-128` (delete the `owner_scope`/manual-filter block; call `apply_visibility_filter`)
- Modify: `backend/app/routers/contacts.py:92-117` (same, `Contact`)
- Modify: `backend/app/routers/meetings.py:146-173` (same, `Meeting`)
- Modify: `backend/app/routers/campaigns.py:70-84` (same, `Campaign`)
- Modify: `backend/app/routers/followups.py:80-107` (same, `FollowUp`)
- Modify: `backend/app/routers/insights.py:62-71` (same pattern — `Organization` query at line 71)
- Modify: `backend/app/routers/admin.py:251-268,427-429` (replace each raw count query with a sharing-aware `apply_visibility_filter` call — see Step 4; not a blanket `.filter(Model.is_private.is_(False))`, which would wrongly exclude a target employee's private record explicitly shared with the viewing admin)
- Modify: `backend/app/routers/admin.py:106-131` — `GET /dashboard` global org-wide counts (Task 5 finding #1; lower severity, CEO-overview-shaped)
- Modify: `backend/app/routers/admin.py:465,499,533` — `PATCH .../owner` ×3 mutate `owner_id` via raw `db.query(Model).filter(id==...).first()` with **no visibility check at all** before the write; must route through `get_visible_or_404` so an ADMIN cannot reassign ownership of a CEO-private record it cannot otherwise see (Task 5 finding #2)
- Modify: `backend/app/routers/admin.py:573-591` — `POST /assignments/bulk` has the same unchecked bulk `.update()` on `owner_id` (Task 5 finding #3)
- Modify: each router's create endpoint (`organizations.py` ~line 243+, `contacts.py` ~248+, `meetings.py` ~318+, `campaigns.py` ~60+, `followups.py` ~259+) to call `set_ownership_defaults(record, current_user)` before commit
- Modify: each router's detail/update/delete endpoint to use `get_visible_or_404` instead of a bare `db.query(Model).filter(Model.id == id).first()`-then-404 pattern (`organizations.py:315,331,463`; `contacts.py:356,377,629`; `meetings.py:297,405,609`; `campaigns.py:90,149,193`; `followups.py:238,319,422`)
- Modify: any additional file/line found by Task 5's audit and recorded in the "Endpoint Audit Results" section below, for any of these 6 routers or `admin.py`
- Test: `backend/tests/test_visibility_organizations.py`, `test_visibility_contacts.py`, `test_visibility_meetings.py`, `test_visibility_campaigns.py`, `test_visibility_followups.py`, `test_visibility_insights.py`, `test_admin_dashboard_privacy.py`
- Test: add to `test_admin_dashboard_privacy.py` — `test_admin_owner_reassignment_blocked_on_invisible_record` (ADMIN attempts `PATCH .../owner` or `POST /assignments/bulk` on a CEO-private record it cannot see; must 404, not succeed) (Task 5 findings #2, #3)

**Interfaces:**
- Consumes: `apply_visibility_filter(query, model, current_user, db, owner_scope=None)`, `get_visible_or_404`, `set_ownership_defaults`, `log_shared_access` (Task 2).
- Produces: nothing new — this task closes the known bug and switches these 6 routers + `admin.py` onto the shared helper. Later tasks (7, 10) use the identical pattern on the remaining routers.

- [ ] **Step 1: Write failing tests for each of the 6 routers' list endpoint**

```python
def test_employee_owner_scope_all_no_longer_bypasses_visibility(client, ...):
    # employee A creates an org; employee B requests list with owner_scope=all;
    # B must NOT see A's org. Repeated once per router (org/contact/meeting/
    # campaign/followup; insights uses its own aggregate response shape).
def test_ceo_sees_other_users_non_private_and_private_records_in_list(client, ...):
def test_admin_sees_all_non_private_but_not_ceo_private_in_list(client, ...):
def test_admin_owner_scope_own_narrows_list_to_their_own_records_only(client, ...):
    # the one case where owner_scope now has a real, intended effect.
```

And for `admin.py`:

```python
def test_admin_per_user_dashboard_counts_exclude_target_users_private_records(client, ...):
    # a CEO-role user (owner_id = X) has one private Organization and one
    # non-private one; admin's per-user stats endpoint for user X must count 1, not 2.
def test_admin_per_user_dashboard_counts_include_target_users_private_record_shared_with_admin(client, ...):
    # same target user X has a second private Organization, this one actively shared
    # with the viewing admin; admin's per-user stats for user X must count 2, not 1 —
    # a blanket is_private=False filter would wrongly exclude this shared-private row.
def test_list_endpoint_logs_shared_record_access_once_per_request(client, ...):
    # viewing user has two active shares into one other owner's records; a single
    # list request returning both rows writes exactly one shared_record_access AuditLog row.
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_visibility_organizations.py backend/tests/test_visibility_contacts.py backend/tests/test_visibility_meetings.py backend/tests/test_visibility_campaigns.py backend/tests/test_visibility_followups.py backend/tests/test_visibility_insights.py backend/tests/test_admin_dashboard_privacy.py -v`
Expected: FAIL

- [ ] **Step 3: Delete each router's `owner_scope` manual-filter block and call `apply_visibility_filter`**

In each of the 6 files, replace the pattern at the cited line ranges with `query = apply_visibility_filter(query, Model, current_user, db, owner_scope=owner_scope)` — pass the router's existing `owner_scope` query parameter straight through; the helper now owns deciding what that parameter is allowed to do (see Global Constraints). Wire `set_ownership_defaults(record, current_user)` into each create endpoint right before the existing commit call. Replace each cited detail/update/delete lookup with `record = get_visible_or_404(db, Model, id, current_user)`. In each list endpoint, call `log_shared_access(db, Model, current_user, [row.id for row in results])` once, immediately before returning the response. Apply the same replacement to every additional line Task 5's audit added to this task's Files list above.

- [ ] **Step 4: Fix `admin.py`'s per-user count queries, sharing-aware**

A blanket `.filter(Model.is_private.is_(False))` is wrong: it would exclude a target employee's private record that the target has explicitly shared with the viewing admin, which that admin is authorized to see. Instead, replace each of the 7 raw count/list queries at `admin.py:251-268,427-429` (covers `Organization`, `Contact`, `Meeting`, `Opportunity`, `Partnership` — leave the `created_by`/`organizer_id` column choice on `Contact`/`Meeting` exactly as-is; that naming inconsistency is a separate, pre-existing issue out of scope for this plan) with `apply_visibility_filter(db.query(Model).filter(Model.owner_id == target_user.id), Model, current_user, db).count()`, where `current_user` is the admin viewing the stats and `target_user` is the employee whose stats are being computed. This reuses the same visibility rules the main application uses (rule 3's share grant included) while the explicit `owner_id == target_user.id` pre-filter keeps the count scoped to that one employee's own records, exactly as today.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest backend/tests/test_visibility_organizations.py backend/tests/test_visibility_contacts.py backend/tests/test_visibility_meetings.py backend/tests/test_visibility_campaigns.py backend/tests/test_visibility_followups.py backend/tests/test_visibility_insights.py backend/tests/test_admin_dashboard_privacy.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/organizations.py backend/app/routers/contacts.py backend/app/routers/meetings.py backend/app/routers/campaigns.py backend/app/routers/followups.py backend/app/routers/insights.py backend/app/routers/admin.py backend/tests/test_visibility_organizations.py backend/tests/test_visibility_contacts.py backend/tests/test_visibility_meetings.py backend/tests/test_visibility_campaigns.py backend/tests/test_visibility_followups.py backend/tests/test_visibility_insights.py backend/tests/test_admin_dashboard_privacy.py
git commit -m "fix: close owner_scope=all visibility bypass across 6 routers and admin dashboard counts"
```

Note: `backend/app/routers/organizations.py` has unrelated uncommitted SEC-EDGAR-financials changes at the time of writing this plan. Use `git add -p` or stage only the specific hunks this task touches, and check `git diff --cached` before committing.

---

## Endpoint Audit Results

*(Populated by Task 5, 2026-11-03.)*

**Correction to Task 5's Step 1 instructions:** the Copilot assistant's agent tools live at `backend/app/services/copilot/` (`tools.py`, `engine.py`, `intent_router.py`, `user_manual.py`), not `backend/app/copilot/` as originally guessed — grepped and confirmed. The notifications module is also now located: model `backend/app/models/notification.py`, service `backend/app/services/notification_service.py`, router `backend/app/routers/notifications.py` — all three are correctly scoped to `user_id` and are **not** a direct leak of the 13 models. The leak risk is in *callers* of `notify()` that embed unfiltered record snippets into notification bodies (see table below).

**Line-number drift warning:** several line numbers already cited in Task 6/7 (written before this audit) no longer match the current file contents — most visibly in `organizations.py`, which has unrelated uncommitted SEC-EDGAR-financials changes per the note after Task 6 Step 6. Re-verify exact line numbers against the working tree at implementation time; do not trust any cited line number blindly.

| # | File | Line(s) | Queries / embeds | Model(s) | Covered by Task 6/7? |
|---|------|---------|-------------------|----------|----------------------|
| 1 | `backend/app/routers/admin.py` | 106-131 | `GET /dashboard` — org-wide unfiltered counts (lower severity, CEO-overview-shaped, pre-existing) | Organization, Opportunity, Contact, Meeting | **New** — add to Task 6 |
| 2 | `backend/app/routers/admin.py` | 465, 499, 533 | `PATCH .../owner` ×3 — raw `db.query(Model).filter(id==...).first()` then mutate `owner_id`, **no visibility check at all** | Organization, Contact, Opportunity (one each) | **New** — add to Task 6 (privilege-escalation-adjacent: lets an ADMIN reassign ownership of a CEO-private record it cannot otherwise see) |
| 3 | `backend/app/routers/admin.py` | 573-591 | `POST /assignments/bulk` — bulk `.update()` on `owner_id`, no visibility check | Organization/Contact/Opportunity (bulk) | **New** — add to Task 6 (same escalation risk as #2) |
| 4 | `backend/app/routers/opportunities.py` | 300-301 | Nested `ContactActivity` lookup inside `GET /{id}` detail handler | ContactActivity (not one of the 13 — out of scope) | n/a |
| 5 | `backend/app/routers/opportunities.py` | 319-320 | Nested, **unfiltered** `db.query(Meeting).filter(Meeting.opportunity_id==...)` embedded in the opportunity detail response | Meeting | **New** — add to Task 7 (`opportunities.py` detail handler, nested embed — a Meeting with a different owner/is_private can leak through an already-visible Opportunity) |
| 6 | `backend/app/routers/opportunities.py` | 337-338 | Nested, **unfiltered** `db.query(FollowUp).filter(FollowUp.opportunity_id==...)` embedded in the opportunity detail response | FollowUp | **New** — add to Task 7, same nested-embed risk as #5 |
| 7 | `backend/app/routers/connections.py` | ~222, ~228, ~236 | `KanbanBoardOut`/`KanbanCardOut` — builds a **company-wide, completely unfiltered** pipeline/kanban board from `db.query(Opportunity).filter(is_deleted==False).all()`, zero `owner_id`/`is_private` filtering | Opportunity | **New, unanticipated router** — not one of Task 6/7's 14; recommend folding into Task 7's catch-all, flagged for explicit user review |
| 8 | `backend/app/routers/connections.py` | 54,63,72,86,90,111,125,168,188,196,277 | Additional independent queries against Organization/Meeting/Communication/Contact/FollowUp (not individually line-verified beyond grep) | Organization, Meeting, Communication, Contact, FollowUp | **New, unanticipated router** — same as #7 |
| 9 | `backend/app/routers/analytics.py` | router-level `Depends(require_business_development)`; ~20 query sites at 137,146,167,175,181,183,187,225,234,257,286,315,335,340,361,419,426,446,458,463,483 | Aggregate **and itemized** (`stale_organizations: List[...]`, `top_opportunities: List[...]`) analytics, reachable by **any regular BD employee**, zero owner/is_private filtering | Organization, Contact, Opportunity, Meeting, FollowUp, Communication, Partnership | **New, unanticipated router — most severe finding of this audit.** Not one of Task 6/7's 14. This is a live, unconditional gap: it leaks record-level (not just aggregate) data across ownership boundaries today, with no forged parameter needed and independent of the `is_private`/CEO concepts this plan is adding. Recommend folding into Task 7's catch-all, but flagged prominently — see report. |
| 10 | `backend/app/routers/analytics.py` | 540-599+ | `GET /export` — CSV export of the same comprehensive analytics to any BD employee | same as #9 | **New** — same router as #9 |
| 11 | `backend/app/routers/funding.py` | 98-158 (`GET /export`) | CSV export of investor contacts: `db.query(Contact).filter(organization_id==..., is_deleted==False).all()`, no owner/is_private filter | Contact | **New, unanticipated router** — add to Task 7's catch-all |
| 12 | `backend/app/routers/funding.py` | 52, 68 | `/search`, `/contacts/search` — unfiltered search endpoints touching Organization/Contact via `find_investors` | Organization, Contact | **New** — same router as #11 |
| 13 | `backend/app/routers/integrations.py` | 38,45,52,59 | `/status` — counts Organizations by `notes.ilike(...)`, no owner/is_private filter (minor aggregate leak) | Organization | **New, unanticipated router** — low severity, add to Task 7's catch-all |
| 14 | `backend/app/routers/discovery.py` | 291-305 (`GET /export`) | CSV export of discovered leads — queries `DiscoveredOrganization` only | Not one of the 13 (separate staging model) | Out of scope, verified |
| 15 | `backend/app/services/copilot/tools.py` | whole file (~2200 lines); confirmed sites include 1079-1093 (`get_team_members`) and ~20 `search_*`/`get_*` functions | Copilot assistant tool layer queries **all 13 models** with `is_deleted`-only filtering; most `search_*` functions (`search_customers`, `search_demos`, `search_proposals`, `search_negotiations`, `search_tasks`, `search_knowledge_base`) take **only `db`, no caller-identity parameter at all** — structurally impossible to scope without a signature change. `get_team_members(db)` independently replicates the exact admin.py per-user-dashboard leak (unfiltered per-user Organization/Opportunity ownership counts looped over all active users). A few functions (`get_dashboard_summary`, `get_attention_items`, `get_next_actions`, `get_my_notifications`) do take a `user` param but the queries inside them are global, not filtered by it. | Organization, Contact, Opportunity, Meeting, Communication, Partnership, FollowUp, Customer, Demo, Proposal, Negotiation, BDTask, Campaign (all 13) | **New, unanticipated — largest single surface in this audit.** Service/copilot module "not tied to one specific router" per Task 5's Step 3 bucket — add to Task 7's catch-all, but its scale (dozens of functions, every one of the 13 models) is far larger than Task 7's existing line-count budget anticipated. Flagged for explicit user review of scope/sequencing — may warrant its own follow-up task rather than being absorbed into Task 7. |
| 16 | `backend/app/services/copilot/engine.py` | 413,446,477,508,542,576,1292,1307,1322,1355,1358 | Additional unfiltered `db.query(Organization)`/`db.query(Customer)` calls (grep-confirmed, not all individually read) | Organization, Customer | **New** — same module as #15, add to Task 7's catch-all |
| 17 | `backend/app/services/signal_service.py` | `scan_signals()`, whole file (196 lines) | Scans ALL `CampaignContact` rows unfiltered; notifies `cc.assigned_user_id`/`anchor.assigned_user_id`, embedding organization/contact engagement descriptions into the notification body | Campaign (via CampaignContact), Organization, Contact (embedded text) | **New — unconfirmed risk.** Safe only if `assigned_user_id` always equals the record's `owner_id` or holds an active share; this is **not proven**, just plausible. Add to Task 7's catch-all with a recommendation to verify the assigned-user/owner invariant before deciding no fix is needed. |
| 18 | `backend/app/services/campaign_service.py` | 595-654 (reply-received handler) | Notifies `cc.assigned_user_id or user_id` with `body=f"{org_name}: {reply_snippet[:150]}"` | Campaign/Organization (embedded text) | **New** — same caveat as #17, add to Task 7's catch-all |
| 19 | `backend/app/services/lead_tracker_service.py` | 130-159 | On milestone change, notifies `cc.assigned_user_id` with `body=f"Lead #{cc.id} marked '{label}'."` | Campaign (via CampaignContact) | **New** — same caveat as #17, add to Task 7's catch-all (lower severity — body has no org/contact name) |
| 20 | `backend/app/services/task_sweep_service.py`, `task_reminder_service.py` | whole files | Query ALL `BDTask` rows unfiltered, but always notify `task.owner_id` (the task's real owner) | BDTask | **Verified safe — no fix needed.** Owners always see their own records regardless of `is_private` (rule 2). |
| 21 | `backend/app/services/webhook_service.py` | whole file | Only queries its own `WebhookSubscription` model; forwards whatever payload `notify()` callers supply | None of the 13 | **Verified safe — not a leak itself.** |
| 22 | `backend/app/services/notification_service.py`, `backend/app/routers/notifications.py` | whole files | Only query the `Notification` model, always scoped to `user_id` | None of the 13 | **Verified safe.** Confirms/corrects Task 5's original "module not yet located" note — it's located and is not itself the risk; its callers (rows #17-19) are. |
| 23 | `backend/app/routers/lead_tracker.py` | 203, 220 | `GET/POST /{campaign_contact_id}/timeline` | CampaignContact (not independently one of the 13 — `Campaign` itself is the protected model, line-item rows are a join table) | Out of scope as a direct model match; flagged only because it matched the `timeline` grep |
| 24 | `backend/app/routers/business_development.py`, `reports.py`, `copilot.py` (router) | — | No direct `db.query()` against any of the 13 models found; these are thin wrappers that delegate to the services above | — | n/a — delegated risk already captured in rows #9-10, #15-16 |
| 25 | Task 6/7's existing cited routers (`organizations.py`, `contacts.py`, `meetings.py`, `campaigns.py`, `followups.py`, `insights.py`, `opportunities.py`, `tasks.py`, `demos.py`, `proposals.py`, `negotiations.py`, `partnerships.py`, `customers.py`, `communications.py`) | as previously cited | Primary CRUD query sites | all 13 | **Already covered** — re-verified present via grep; exact line numbers may have drifted (see warning above) but the endpoints themselves are already in scope |

**Decision (user, 2026-11-03): split, don't fold.** `connections.py`, `analytics.py`, and the Copilot tool layer (`services/copilot/tools.py`/`engine.py`) are each large enough to need their own reviewer gate and are structurally different from Task 6/7's mechanical pattern (`connections.py`/`analytics.py` need new `owner_scope`-aware response shapes for an aggregate/kanban view, not a straight list endpoint; the Copilot tool layer needs a caller-identity parameter added to ~20+ function signatures before any filter can be applied at all). They are pulled out into dedicated Task 12 (`analytics.py`), Task 13 (`connections.py`), and Task 14 (Copilot tool layer) — see those sections below. Task 7's catch-all keeps only the smaller, mechanically-similar findings (#11, #12, #13, #17, #18, #19).

**Summary of what this adds to Task 6, Task 7, and the new Tasks 12-14 (see those sections' `Files:` lists below for the actual edits):**
- Task 6 (`admin.py`): rows #1, #2, #3.
- Task 7 (catch-all): rows #5, #6 (`opportunities.py` nested embeds — added directly to its own `Files:` line), and rows #11, #12, #13, #17, #18, #19 added to the catch-all bullet.
- Task 12 (new): rows #9, #10 (`analytics.py`).
- Task 13 (new): rows #7, #8 (`connections.py`).
- Task 14 (new): rows #15, #16 (Copilot tool layer).
- Rows #20, #21, #22 required no plan change — verified safe, recorded here for completeness so a future auditor doesn't re-investigate them from scratch.

---

## Task 7: Add visibility to the 8 routers with no `owner_scope` today

**Files:**
- Modify: `backend/app/routers/opportunities.py` — list `:94`, create `:191`, detail `:284`, update `:381,480,520,561`, delete `:601`; **plus** the detail handler's nested, unfiltered embeds at `:319-320` (`Meeting`) and `:337-338` (`FollowUp`) — a Meeting/FollowUp linked to an already-visible Opportunity can independently be CEO-private under a different owner and must not leak through the nested embed (Task 5 findings #5, #6)
- Modify: `backend/app/routers/tasks.py` — list `:66`, dashboard `:90`, detail `:128`, create `:140`, update `:173`, delete `:201`
- Modify: `backend/app/routers/demos.py` — list `:48`, detail `:69`, create `:81`, update `:134`, delete `:163`
- Modify: `backend/app/routers/proposals.py` — list `:50`, detail `:68`, create `:80`, update `:137`, delete `:162`
- Modify: `backend/app/routers/negotiations.py` — list `:48`, detail `:66`, create `:78`, update `:133`, delete `:158`
- Modify: `backend/app/routers/partnerships.py` — list `:99`, stats `:183`, detail `:264`, create `:277`, update `:386,459,496`, delete `:522`
- Modify: `backend/app/routers/customers.py` — list `:51`, detail `:73`, create `:85,134`, update `:191`, delete `:216`
- Modify: `backend/app/routers/communications.py` — list `:100`, timeline `:216`, create `:353`, detail `:491`, update `:509`, delete `:578`
- Modify: any additional file/line found by Task 5's audit and recorded in the "Endpoint Audit Results" section above that isn't tied to one of the 6 routers in Task 6, `analytics.py` (Task 12), `connections.py` (Task 13), or the Copilot tool layer (Task 14). Task 5 resolved this to the following concrete files (see "Endpoint Audit Results" for line numbers and severity):
  - `backend/app/routers/funding.py:98-158,52,68` — `/export` CSV leaks unfiltered `Contact` rows; `/search`, `/contacts/search` are unfiltered (finding #11, #12)
  - `backend/app/routers/integrations.py:38,45,52,59` — `/status` counts Organizations via `notes.ilike(...)`, no owner/is_private filter; low severity (finding #13)
  - `backend/app/services/signal_service.py`, `backend/app/services/campaign_service.py:595-654`, `backend/app/services/lead_tracker_service.py:130-159` — notify `assigned_user_id`, embedding organization/contact text into the notification body; safe only if `assigned_user_id` always equals the record's owner or holds an active share, which is **not yet proven** (finding #17, #18, #19) — verify this invariant before concluding no fix is needed; if it ever doesn't hold, gate the notify call behind the same visibility check rather than embedding the text unconditionally
- Test: `backend/tests/test_visibility_opportunities.py`, `test_visibility_tasks.py`, `test_visibility_demos.py`, `test_visibility_proposals.py`, `test_visibility_negotiations.py`, `test_visibility_partnerships.py`, `test_visibility_customers.py`, `test_visibility_communications.py`, `test_visibility_funding.py`, plus any new test file Task 5's findings require. At minimum: `test_visibility_opportunities.py` gains a nested-embed case (`test_opportunity_detail_hides_other_owners_private_meetings_and_followups`).

**Interfaces:**
- Consumes: `apply_visibility_filter(query, model, current_user, db, owner_scope=None)`, `get_visible_or_404`, `set_ownership_defaults`, `log_shared_access` (Task 2).
- Produces: nothing new — same pattern as Task 6, applied to the 8 routers the spec's §4.2 "every endpoint" requirement additionally covers, plus whatever Task 5 found elsewhere.

- [ ] **Step 1: Write failing tests for each of the 8 routers (list, detail, create defaults, update/delete-on-invisible-record)**

```python
def test_employee_list_never_sees_other_employees_records(client, ...):
    # repeated once per router; none of these 8 had any owner filtering before this task.
def test_ceo_created_record_defaults_is_private_true(client, ...):
    # create via each router as a CEO user, assert is_private True on the response.
def test_employee_created_record_defaults_is_private_false(client, ...):
    # unchanged existing behavior — guards against set_ownership_defaults over-applying.
def test_update_or_delete_on_invisible_record_returns_404(client, ...):
def test_list_endpoint_logs_shared_record_access_once_per_request(client, ...):
    # same shared-access-logging requirement as Task 6, repeated here since none
    # of these 8 routers had any visibility wiring (or audit wiring) before this task.
```

Plus one test per finding recorded in "Endpoint Audit Results" that lands in this task's scope.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_visibility_opportunities.py backend/tests/test_visibility_tasks.py backend/tests/test_visibility_demos.py backend/tests/test_visibility_proposals.py backend/tests/test_visibility_negotiations.py backend/tests/test_visibility_partnerships.py backend/tests/test_visibility_customers.py backend/tests/test_visibility_communications.py -v`
Expected: FAIL

- [ ] **Step 3: Add `apply_visibility_filter` to each list/stats/dashboard/timeline query, `get_visible_or_404` to each detail/update/delete lookup, and `set_ownership_defaults` to each create endpoint**

Same mechanical change as Task 6 Step 3, applied at each cited line, passing `db` and the router's `owner_scope` parameter through (adding an `owner_scope` query parameter to these 8 routers' list endpoints if they don't already have one, so `ADMIN`/`CEO` get the same own/all toggle the 6 Task-6 routers have). None of these 8 routers have an `owner_scope` param today, so there is no old block to delete — only an insertion. For `tasks.py`'s `/dashboard` (`:90`) and `partnerships.py`'s `/stats` (`:183`), the aggregation query must also be built from `apply_visibility_filter`'s filtered query, not a raw count, per spec §4.2's "dashboard counts/widgets" leakage category. Apply the same treatment to every Task-5-sourced finding assigned to this task. In each list endpoint, call `log_shared_access(db, Model, current_user, [row.id for row in results])` once, immediately before returning the response — same wiring as Task 6 Step 3, needed here too since none of these 8 routers logged shared-record reads before.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/test_visibility_opportunities.py backend/tests/test_visibility_tasks.py backend/tests/test_visibility_demos.py backend/tests/test_visibility_proposals.py backend/tests/test_visibility_negotiations.py backend/tests/test_visibility_partnerships.py backend/tests/test_visibility_customers.py backend/tests/test_visibility_communications.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/opportunities.py backend/app/routers/tasks.py backend/app/routers/demos.py backend/app/routers/proposals.py backend/app/routers/negotiations.py backend/app/routers/partnerships.py backend/app/routers/customers.py backend/app/routers/communications.py backend/tests/test_visibility_opportunities.py backend/tests/test_visibility_tasks.py backend/tests/test_visibility_demos.py backend/tests/test_visibility_proposals.py backend/tests/test_visibility_negotiations.py backend/tests/test_visibility_partnerships.py backend/tests/test_visibility_customers.py backend/tests/test_visibility_communications.py
git commit -m "feat: enforce record visibility on the 8 routers that had no owner filtering"
```

(Add any Task-5-sourced new files to this `git add` list when committing.)

---

## Task 8: Sharing API

**Files:**
- Create: `backend/app/routers/ceo.py` (shares endpoints only — dashboard endpoint added in Task 10)
- Create: `backend/app/schemas/ceo.py` (`ShareCreate`, `ShareOut`)
- Modify: `backend/app/main.py` (import `ceo_router`, `app.include_router(ceo_router)` after line 407)
- Test: `backend/tests/test_ceo_shares.py`

**Interfaces:**
- Consumes: `RecordShare` (Task 1), `require_ceo` (Task 3), `log_audit_event` (existing, `backend/app/core/audit.py`).
- Produces: `POST /api/ceo/shares`, `DELETE /api/ceo/shares/{share_id}`, `GET /api/ceo/shares`. No other task consumes these directly.

- [ ] **Step 1: Write failing tests for all 7 validation steps in order plus success/revoke**

```python
def test_share_rejects_unknown_resource_type():
def test_share_rejects_nonexistent_resource():
def test_share_rejects_non_owner_caller():
def test_share_rejects_nonexistent_or_deactivated_recipient():
def test_share_rejects_recipient_role_ceo():
def test_share_rejects_self_share():
def test_share_rejects_duplicate_active_share():
def test_share_success_writes_share_granted_audit_log():
def test_revoke_rejects_non_granting_caller():
def test_revoke_sets_revoked_at_and_writes_share_revoked_audit_log():
def test_visibility_helper_called_before_and_after_revoke_in_same_test():
    # exercises get_visible_or_404 twice in one test, proving immediate effect, not just that revoked_at got set.
def test_list_shares_returns_only_shares_granted_by_current_user():
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_ceo_shares.py -v`
Expected: FAIL

- [ ] **Step 3: Implement the 3 endpoints in `ceo.py`**

`POST /api/ceo/shares(body: ShareCreate, current_user: User = Depends(require_ceo), db: Session = Depends(get_db))`: validate in the exact order of spec §4.4 steps 1-7, raising the exact status code given for each (404, 404, 403, 404, 422, 422, 409 respectively); on success create a `RecordShare` row and `log_audit_event(db, action="share_granted", user=current_user, resource_type=body.resource_type, resource_id=body.resource_id, metadata={"shared_with_user_id": body.shared_with_user_id})`. `DELETE /api/ceo/shares/{share_id}`: 404 if missing, 403 if `granted_by_user_id != current_user.id`, else set `revoked_at = datetime.now(timezone.utc)`, `log_audit_event(db, action="share_revoked", ...)`. `GET /api/ceo/shares`: `db.query(RecordShare).filter(RecordShare.granted_by_user_id == current_user.id)`.

- [ ] **Step 4: Register the router in `main.py`**

Add `from app.routers.ceo import router as ceo_router` to the import block (after the existing `insights_router` import, matching the existing one-import-per-line style), and `app.include_router(ceo_router)` after line 407.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest backend/tests/test_ceo_shares.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/ceo.py backend/app/schemas/ceo.py backend/app/main.py backend/tests/test_ceo_shares.py
git commit -m "feat: add CEO record-sharing API"
```

---

## Task 9: CEO account provisioning script

**Files:**
- Create: `backend/scripts/provision_ceo.py`
- Test: `backend/tests/test_provision_ceo.py`

**Interfaces:**
- Consumes: `User`, `UserRole.CEO` (Task 3), `log_audit_event`.
- Produces: standalone script, no other task depends on it.

- [ ] **Step 1: Write failing tests**

```python
def test_provision_creates_ceo_with_must_change_password_true(monkeypatch, tmp_sqlite_db):
    # CEO_NAME/CEO_EMAIL/CEO_PASSWORD from env.
def test_provision_prompts_getpass_when_password_env_unset(monkeypatch, tmp_sqlite_db):
def test_provision_refuses_second_run_without_rotate_flag(tmp_sqlite_db):
def test_provision_rotate_resets_password_and_must_change_password(tmp_sqlite_db):
def test_provision_writes_ceo_account_provisioned_audit_log():
def test_provision_rotate_writes_ceo_account_rotated_audit_log():
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_provision_ceo.py -v`
Expected: FAIL

- [ ] **Step 3: Implement `provision_ceo.py`, modeled on `backend/seed.py`**

Read `CEO_NAME`, `CEO_EMAIL`, `CEO_PASSWORD` from `os.environ`; if `CEO_PASSWORD` unset, `getpass.getpass()`. Query for an existing `User` with `role == UserRole.CEO`; if found and `--rotate` not passed, print a message and exit without changes; if found and `--rotate` passed, update password hash and set `must_change_password = True`, `log_audit_event(..., action="ceo_account_rotated")`; if not found, create the user with `role=UserRole.CEO, must_change_password=True`, `log_audit_event(..., action="ceo_account_provisioned")`. Never print or log the password itself.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/test_provision_ceo.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/provision_ceo.py backend/tests/test_provision_ceo.py
git commit -m "feat: add CEO account provisioning script"
```

---

## Task 10: CEO dashboard shell — backend endpoint

**Files:**
- Modify: `backend/app/routers/ceo.py` (add `GET /api/ceo/overview`)
- Modify: `backend/app/schemas/ceo.py` (add `CeoOverviewOut`)
- Test: `backend/tests/test_ceo_overview.py`

**Interfaces:**
- Consumes: `require_ceo` (Task 3), `apply_visibility_filter` (Task 2, used so the counts can't leak more than visibility already allows — though for CEO this is a no-op by rule 1, it keeps the code path uniform).
- Produces: `GET /api/ceo/overview` response shape `{total_employees: int, total_active_users: int, total_organizations: int, total_opportunities: int, total_open_tasks: int}`. Frontend Task 11 fetches this exact shape.

- [ ] **Step 1: Write failing test**

```python
def test_ceo_overview_total_employees_counts_only_active_business_development(client, ...):
    # seed one BUSINESS_DEVELOPMENT active, one BUSINESS_DEVELOPMENT inactive,
    # one ADMIN, one CEO, one HEALTHCARE, one USER, one DEV — assert total_employees == 1.
def test_ceo_overview_total_active_users_includes_every_role(client, ...):
    # same seed — assert total_active_users counts every active role, == 6.
def test_ceo_overview_org_counts_are_org_wide_not_scoped_to_ceo(client, ...):
    # seed organizations/opportunities/tasks across multiple owners, assert counts
    # are org-wide totals, not scoped to the CEO's own records.
def test_ceo_overview_requires_ceo_role(client, ...):
    # ADMIN and BUSINESS_DEVELOPMENT both get 403.
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_ceo_overview.py -v`
Expected: FAIL

- [ ] **Step 3: Implement `GET /api/ceo/overview`**

`overview(current_user: User = Depends(require_ceo), db: Session = Depends(get_db)) -> CeoOverviewOut`: `total_employees = db.query(User).filter(User.role == "BUSINESS_DEVELOPMENT", User.is_active.is_(True)).count()`; `total_active_users = db.query(User).filter(User.is_active.is_(True)).count()` (no role filter — see Global Constraints' dashboard-counting definition); `total_organizations`/`total_opportunities` as plain org-wide counts; `total_open_tasks` as `BDTask` where not done. No per-employee breakdown, no pipeline detail — Phase 1 shell only, per spec §4.8.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_ceo_overview.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/ceo.py backend/app/schemas/ceo.py backend/tests/test_ceo_overview.py
git commit -m "feat: add CEO dashboard overview endpoint"
```

---

## Task 11: Frontend — CEO role wiring, forced password change, dashboard shell

**Files:**
- Modify: `frontend/src/types/auth.ts:5` (add `'CEO'` to the `User.role` union — additive, the `| string` escape hatch already there means this is non-breaking; add `must_change_password: boolean` to `User`)
- Modify: `frontend/src/context/AuthContext.tsx` (add `isCeo` derived the same way as `isAdmin`/`isBDUser`, lines 92-93)
- Create: `frontend/src/components/auth/CeoProtectedRoute.tsx` (mirror `AdminProtectedRoute.tsx`, gate on `isCeo`)
- Modify: `frontend/src/services/auth.ts` (add `changePassword(currentPassword: string, newPassword: string): Promise<void>`)
- Modify: `frontend/src/pages/LoginPage.tsx:16,25-31` (after login, if `user.must_change_password` navigate to `/change-password` — checked first, before any role branch; else if `user.role === 'CEO'` navigate to `/ceo`; else existing fallback)
- Create: `frontend/src/pages/ChangePasswordPage.tsx`
- Create: `frontend/src/pages/ceo/CeoDashboardPage.tsx`
- Modify: `frontend/src/App.tsx` (add `/change-password` route; add `/ceo` route wrapped in `CeoProtectedRoute`)
- Modify: `frontend/src/components/layout/Navbar.tsx` (add a CEO-only nav entry, visible only when `isCeo`)
- Test: `frontend/src/components/auth/CeoProtectedRoute.test.tsx`, `frontend/src/pages/ChangePasswordPage.test.tsx`, `frontend/src/pages/LoginPage.test.tsx` (extended), `frontend/src/components/layout/Navbar.test.tsx` (extended), `frontend/src/pages/ceo/CeoDashboardPage.test.tsx`

**Interfaces:**
- Consumes: `must_change_password` field on login response (Task 4), `POST /api/auth/change-password` (Task 4), `GET /api/ceo/overview` (Task 10).
- Produces: nothing consumed by Tasks 12-14 (those are backend-only) or Task 15.

- [ ] **Step 1: Write failing tests**

```tsx
test('CeoProtectedRoute redirects non-CEO to a 403 view', () => { ... });
test('CeoProtectedRoute renders children for CEO role', () => { ... });
test('ChangePasswordPage submits current+new password and redirects to /login on success', () => { ... });
test('LoginPage redirects a CEO with must_change_password=true to /change-password, not /ceo', () => { ... });
    // the priority-order case explicitly called out by the user's review: forced
    // password change must win over the CEO role redirect, not lose to it.
test('LoginPage redirects a CEO with must_change_password=false to /ceo', () => { ... });
test('LoginPage redirects a non-CEO employee with must_change_password=true to /change-password', () => { ... });
test('Navbar shows the CEO nav entry only when isCeo is true', () => { ... });
test('Navbar hides the CEO nav entry for ADMIN and BUSINESS_DEVELOPMENT roles', () => { ... });
test('CeoDashboardPage renders the five stat cards from a mocked /api/ceo/overview response', () => { ... });
```

Plus one test per frontend-relevant finding recorded in "Endpoint Audit Results" (e.g. if Task 5 found an unfiltered list rendered on a page, add a test asserting the page no longer renders rows the current user shouldn't see, once the corresponding backend fix from Task 6/7 lands).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix frontend test -- CeoProtectedRoute ChangePasswordPage LoginPage Navbar CeoDashboardPage`
Expected: FAIL (components don't exist / new assertions not yet satisfied)

- [ ] **Step 3: Implement the components**

`CeoProtectedRoute` — exact structural copy of `AdminProtectedRoute.tsx:1-53`, swapping `isAdmin` for `isCeo` and the 403 copy to mention CEO access. `ChangePasswordPage` — a form with current/new/confirm password fields, calls `authService.changePassword`, on success clears the stored token (`localStorage` keys `elly_bd_auth_token`/`elly_bd_auth_user`, per `AuthContext.tsx:18-19`) and navigates to `/login` with a "please log in again" message — the backend's `iat` check (Task 3) makes the old token invalid immediately, so this is a correctness requirement, not just UX polish. `CeoDashboardPage` — fetches `/api/ceo/overview`, renders five stat cards, labeling `total_employees` and `total_active_users` distinctly per the Global Constraints' dashboard-counting definition (never show one number under a label that implies the other). In `LoginPage.tsx`, change the post-login logic at lines 25-31 to branch in this exact order: `must_change_password` first (always wins, regardless of role) → then `role === 'CEO'` → then the existing `from` fallback. Add the CEO-only entry to `Navbar.tsx`'s nav list, conditioned on `isCeo`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --prefix frontend test -- CeoProtectedRoute ChangePasswordPage LoginPage Navbar CeoDashboardPage`
Expected: PASS

- [ ] **Step 5: Manual smoke check**

Start frontend + backend dev servers, log in as a freshly provisioned CEO (`must_change_password=True`): confirm redirect to `/change-password`, confirm old token stops working after a successful change, confirm re-login lands on `/ceo`, confirm the CEO nav entry is absent for a non-CEO login, confirm the dashboard's two user-count stat cards show visibly different numbers and distinct labels when employees/admins/CEO are mixed.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/auth.ts frontend/src/context/AuthContext.tsx frontend/src/components/auth/CeoProtectedRoute.tsx frontend/src/services/auth.ts frontend/src/pages/LoginPage.tsx frontend/src/pages/ChangePasswordPage.tsx frontend/src/pages/ceo/CeoDashboardPage.tsx frontend/src/App.tsx frontend/src/components/layout/Navbar.tsx frontend/src/components/auth/CeoProtectedRoute.test.tsx frontend/src/pages/ChangePasswordPage.test.tsx frontend/src/pages/LoginPage.test.tsx frontend/src/components/layout/Navbar.test.tsx frontend/src/pages/ceo/CeoDashboardPage.test.tsx
git commit -m "feat: add CEO role wiring, forced password change, and dashboard shell to frontend"
```

---

## Task 12: Add visibility to `analytics.py`

**Files:**
- Modify: `backend/app/routers/analytics.py` — router-level `Depends(require_business_development)` plus ~20 query sites at 137,146,167,175,181,183,187,225,234,257,286,315,335,340,361,419,426,446,458,463,483, and the `/export` CSV handler at 540-599+ (Task 5 findings #9, #10)
- Test: `backend/tests/test_visibility_analytics.py`

**Interfaces:**
- Consumes: `apply_visibility_filter(query, model, current_user, db, owner_scope=None)`, `log_shared_access` (Task 2).
- Produces: nothing new — no other task consumes analytics output.

- [ ] **Step 1: Write failing tests**

```python
def test_analytics_aggregate_counts_exclude_other_owners_private_records(client, ...):
def test_analytics_stale_organizations_list_excludes_invisible_records(client, ...):
    # itemized field in the response, not just an aggregate count — Task 5 finding #9.
def test_analytics_top_opportunities_list_excludes_invisible_records(client, ...):
def test_analytics_export_csv_excludes_invisible_records(client, ...):
def test_analytics_still_requires_business_development_role(client, ...):
    # unchanged pre-existing guard — regression check only.
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_visibility_analytics.py -v`
Expected: FAIL

- [ ] **Step 3: Apply `apply_visibility_filter` at every query site, and `log_shared_access` to every itemized response**

At each of the ~20 cited query sites, wrap the base `db.query(Model)...` in `apply_visibility_filter(..., current_user, db)` before `.count()`, `.all()`, or further aggregation — same pattern as Task 6/7. For the two itemized fields (`stale_organizations`, `top_opportunities`), call `log_shared_access(db, Model, current_user, [row.id for row in results])` once per field, immediately before building the response. Apply the identical filtering to the `/export` CSV handler's query before writing rows.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/test_visibility_analytics.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/analytics.py backend/tests/test_visibility_analytics.py
git commit -m "feat: enforce record visibility on analytics endpoints and CSV export"
```

---

## Task 13: Add visibility to `connections.py`

**Files:**
- Modify: `backend/app/routers/connections.py` — `KanbanBoardOut`/`KanbanCardOut` built from an unfiltered `Opportunity` query at ~222, ~228, ~236, plus independent queries against Organization/Meeting/Communication/Contact/FollowUp at 54,63,72,86,90,111,125,168,188,196,277 (Task 5 findings #7, #8)
- Test: `backend/tests/test_visibility_connections.py`

**Interfaces:**
- Consumes: `apply_visibility_filter(query, model, current_user, db, owner_scope=None)`, `log_shared_access` (Task 2).
- Produces: nothing new — no other task consumes `connections.py` output.

- [ ] **Step 1: Write failing tests**

```python
def test_kanban_board_excludes_other_owners_private_opportunities(client, ...):
def test_connections_organization_query_excludes_invisible_records(client, ...):
def test_connections_meeting_query_excludes_invisible_records(client, ...):
def test_connections_communication_query_excludes_invisible_records(client, ...):
def test_connections_contact_query_excludes_invisible_records(client, ...):
def test_connections_followup_query_excludes_invisible_records(client, ...):
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_visibility_connections.py -v`
Expected: FAIL

- [ ] **Step 3: Apply `apply_visibility_filter` at every cited query site, and `log_shared_access` to the kanban board**

Replace each raw `db.query(Model).filter(...)` at the 12 cited line numbers with `apply_visibility_filter(db.query(Model).filter(...), Model, current_user, db)`. For the kanban board specifically, call `log_shared_access(db, Opportunity, current_user, [card.id for card in all_cards])` once, immediately before returning `KanbanBoardOut`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/test_visibility_connections.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/connections.py backend/tests/test_visibility_connections.py
git commit -m "feat: enforce record visibility on the connections kanban board"
```

---

## Task 14: Add caller identity and visibility to the Copilot tool layer

**Files:**
- Modify: `backend/app/services/copilot/tools.py` (whole file, ~2200 lines) — every `search_*`/`get_*` function that queries one of the 13 models (Task 5 finding #15); add a `user: User` parameter to each one that doesn't already take one (`search_customers`, `search_demos`, `search_proposals`, `search_negotiations`, `search_tasks`, `search_knowledge_base`, and any sibling function Task 5's grep found with the same `db`-only signature), and apply `apply_visibility_filter`/`get_visible_or_404` inside each using that parameter; for the functions that already take a `user` param (`get_dashboard_summary`, `get_attention_items`, `get_next_actions`, `get_my_notifications`) but don't yet filter by it, add the same filtering; rewrite `get_team_members(db)` to accept `user: User` and apply the same sharing-aware per-user count pattern as Task 6 Step 4 (`apply_visibility_filter(...).count()`, not a raw count)
- Modify: `backend/app/services/copilot/engine.py` — the dispatcher that currently calls `tools.py` functions at 413,446,477,508,542,576,1292,1307,1322,1355,1358; thread the already-available `current_user` through to each call that Step 1's signature change now requires it for
- Test: `backend/tests/test_visibility_copilot_tools.py`

**Interfaces:**
- Consumes: `apply_visibility_filter(query, model, current_user, db, owner_scope=None)`, `get_visible_or_404`, `log_shared_access` (Task 2). `engine.py`'s dispatcher already receives the authenticated user from `backend/app/routers/copilot.py`'s request handler — confirm the exact variable name in the working tree before wiring it through, since this plan was not written against that file's source.
- Produces: nothing new — no other task consumes the Copilot tool layer's output.

- [ ] **Step 1: Write failing tests**

```python
def test_search_customers_tool_excludes_invisible_records(db_session, ...):
def test_search_demos_tool_excludes_invisible_records(db_session, ...):
def test_search_proposals_tool_excludes_invisible_records(db_session, ...):
def test_search_negotiations_tool_excludes_invisible_records(db_session, ...):
def test_search_tasks_tool_excludes_invisible_records(db_session, ...):
def test_search_knowledge_base_tool_excludes_invisible_records(db_session, ...):
def test_get_dashboard_summary_tool_excludes_invisible_records(db_session, ...):
def test_get_attention_items_tool_excludes_invisible_records(db_session, ...):
def test_get_next_actions_tool_excludes_invisible_records(db_session, ...):
def test_get_team_members_tool_uses_sharing_aware_counts(db_session, ...):
    # mirrors test_admin_dashboard_privacy.py's sharing-aware assertion from Task 6.
def test_engine_passes_current_user_to_every_scoped_tool_call(monkeypatch, ...):
    # exercises the engine.py dispatcher, not just tools.py directly.
```

Plus one test per remaining function Task 5's grep found in `tools.py`/`engine.py` that queries one of the 13 models and isn't already covered above.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_visibility_copilot_tools.py -v`
Expected: FAIL

- [ ] **Step 3: Add the `user` parameter and visibility filtering to each tool function, then thread `current_user` through `engine.py`'s dispatcher**

In `tools.py`, add `user: User` to each function's signature per the Files list above, and wrap its query in `apply_visibility_filter`/`get_visible_or_404` using that parameter — same mechanical pattern as every prior task, applied function-by-function rather than endpoint-by-endpoint. In `engine.py`, update each of the 11 cited call sites to pass the current user through to the now-changed signatures. For any tool-result list that returns record data, call `log_shared_access(db, Model, user, [row.id for row in results])` once before returning.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/test_visibility_copilot_tools.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/copilot/tools.py backend/app/services/copilot/engine.py backend/tests/test_visibility_copilot_tools.py
git commit -m "feat: thread caller identity through the Copilot tool layer and enforce record visibility"
```

---

## Task 15: Full regression pass

**Files:**
- None created or modified — verification only.

**Interfaces:**
- Consumes: everything from Tasks 1-14.
- Produces: the go/no-go signal for calling Phase 1 done.

- [ ] **Step 1: Run the full pre-existing backend test suite, not just this plan's new tests**

Run: `cd backend && python -m pytest -q --ignore=tests/test_e2e_full_4industry.py --ignore=tests/test_e2e_full_workflow.py --ignore=tests/test_e2e_pipeline.py --ignore=tests/test_performance_benchmarks.py --ignore=tests/load_test.py`
Expected: all pass, 0 failures. (A prior run of this exact command on the pre-Task-1 codebase, started earlier in this session, already completed with exit code 0 — this run must also be clean after all 14 tasks land, confirming no regression was introduced.)

- [ ] **Step 2: Run the new authorization/visibility test files from Tasks 1-14 together, once, as a final cross-check**

Run: `cd backend && python -m pytest -q tests/test_migration_ceo_rbac_phase1.py tests/test_visibility.py tests/test_auth_deps.py tests/test_auth_change_password.py tests/test_visibility_organizations.py tests/test_visibility_contacts.py tests/test_visibility_meetings.py tests/test_visibility_campaigns.py tests/test_visibility_followups.py tests/test_visibility_insights.py tests/test_admin_dashboard_privacy.py tests/test_visibility_opportunities.py tests/test_visibility_tasks.py tests/test_visibility_demos.py tests/test_visibility_proposals.py tests/test_visibility_negotiations.py tests/test_visibility_partnerships.py tests/test_visibility_customers.py tests/test_visibility_communications.py tests/test_visibility_funding.py tests/test_visibility_analytics.py tests/test_visibility_connections.py tests/test_visibility_copilot_tools.py tests/test_ceo_shares.py tests/test_provision_ceo.py tests/test_ceo_overview.py`

(Append any additional test file discovered during Tasks 1-14 that isn't already listed here before running.)

Expected: all pass.

- [ ] **Step 3: Run the frontend test suite**

Run: `npm --prefix frontend test`
Expected: all pass, including the new/extended `CeoProtectedRoute`/`ChangePasswordPage`/`LoginPage`/`Navbar`/`CeoDashboardPage` tests from Task 11.

- [ ] **Step 4: Manually confirm e2e/performance tests excluded in Step 1 still import cleanly**

Run: `cd backend && python -m pytest --collect-only -q tests/test_e2e_full_4industry.py tests/test_e2e_full_workflow.py tests/test_e2e_pipeline.py tests/test_performance_benchmarks.py`
Expected: collection succeeds (no import errors from the model/dependency changes), even though these slow suites aren't run to completion here.

- [ ] **Step 5: Report**

No commit for this task — it is a verification gate. If any step fails, return to the task that owns the broken area, fix, and re-run this task from Step 1.

---
