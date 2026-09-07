# Admin functionality audit

## Authentication lifecycle fixes: 8 September 2026

- 🟢 Signup, duplicate pending-request prevention, denial, reapplication, approval, revoked-account reapplication and reapproval passed against the running local PostgreSQL API using real HTTP cookies and CSRF tokens.
- 🟢 Revocation rejects the previously authenticated content-admin session on protected endpoints. Wrong confirmation passwords leave access intact. Logout rejects replay of the old authentication cookie.
- 🟢 Approval and denial now commit their audit records in the same transaction as their decisions. An isolated PostgreSQL check injected audit failures and verified rollback of decisions, roles, email confirmation, profiles and revocation security stamps. Its temporary database was removed afterward.
- 🟢 Frontend fixes: super-admin expiry now clears the dashboard and requests sign-in; logout handles expired sessions and displays other failures; session checks also run on window focus; wrong kick confirmation passwords do not sign out a valid reviewer. Login/signup uses native required-field validation and the correct password autocomplete mode.
- Media uploads/storage were left unchanged as requested. Video playback was excluded from this follow-up.
- Browser interaction remains unverified: browser discovery returned no connected browsers, and opening the in-app browser returned `Browser is not available: iab`. HTTP checks and frontend handler tests do not substitute for browser end-to-end tests.
- Live check cleanup restored the signup-permission setting, logged out the reviewer, and left test account `audit_aa773ea4c1b2` without admin access; its request/audit history is retained.

Reproducible checks: `scripts/check-admin-lifecycle.ps1` (running local API; creates and revokes a test account) and `dotnet run --project scripts/AdminTransactionChecks/AdminTransactionChecks.csproj` (isolated local PostgreSQL database). Backend lifecycle regression coverage is in `AdminLifecycleTests.cs`; frontend session behavior is in `adminSession.test.cjs`.

## Follow-up: 8 September 2026

- 🟢 Content pagination: admin lists now use an immutable ascending ID cursor across all seven collections. Deleting earlier rows or editing dates/titles does not shift subsequent pages. Public callers retain their existing date/title ordering. This is a live traversal, not a frozen snapshot; new higher-ID records can appear on later pages.
- 🟢 Local API startup: successfully connected to PostgreSQL; migrations were already current.
- 🟢 Super-admin HTTP authentication: login with the documented development account succeeded, `/me` restored the session, the protected dashboard summary succeeded, and `/me` returned 401 after logout. Browser behavior and the content-admin lifecycle still require separate verification.
- 🟢 All seven content cursor queries executed successfully against the running PostgreSQL API.
- Validation: 100 backend tests and 24 frontend tests passed; lint and `git diff --check` passed. Added regression coverage for deletion, date changes, insertion between pages, and invalid cursor requests.

These results supersede the corresponding pagination, startup, and super-admin HTTP verification gaps below. Existing fixes described below predate this follow-up.

Reviewed 7 September 2026.

**Legend:** 🟢 Working in the reviewed code and relevant automated checks; 🟡 partially working, limited, or awaiting live verification (reason specified); 🔴 unavailable or not working in the stated configuration.

This is a source-code and automated-test audit, not a certification of live operation. No browser login, real PostgreSQL workflow, or deployed-site check was performed. Green ratings apply to local implementation, not production availability. Test coverage varies by feature; passing tests do not establish every UI path works.

## Production availability

| Status | Functionality | Evidence / explanation |
|---|---|---|
| 🔴 | Admin access on the configured production deployment | `render.yaml` sets `ENABLE_LOCAL_ADMIN=false`; `app/admin/page.jsx` calls `notFound()` unless enabled. Intentional deployment restriction. |
| 🔴 | Production authentication, administration API, and database | `render.yaml` provisions only the static frontend. `README.md` explicitly states there is no production API/database. |
| 🔴 | Publishing admin changes to the deployed public website | Deployment uses `NEXT_PUBLIC_CONTENT_SOURCE=temporary`; admin saves target the API, while public production content comes from `data/temporaryContent.js`. There is no production publishing connection. |

## Local administration

| Status | Functionality | Evidence / explanation |
|---|---|---|
| 🟡 | Local admin route and startup | Route and setup instructions exist; require `ENABLE_LOCAL_ADMIN=true`, a running API, and configured PostgreSQL. Live startup was not verified. |
| 🟡 | Username/email sign-in, session restoration, logout | UI calls match `AuthController` endpoints; cookie and security-stamp handling exist. No complete authentication integration/browser test was run. This is a verification gap, not a confirmed failure. |
| 🟡 | Content-admin signup and reapplication | Registration checks existing credentials and duplicate pending requests, and is wired to the form. Permission-denied path is tested; full successful registration/login lifecycle needs live verification. |
| 🟢 | Enable/disable content-admin applications | Dashboard toggle is wired to `CaRequestsPermissionController`; default-disabled and persistence/update tests pass. |
| 🟢 | Approve/deny admin applications | UI endpoints match `AdminRequestsController`; approval updates user/profile/role state. Stale-transition tests pass. |
| 🟢 | Content-admin create/update/delete requests | Dashboard sends action, content type, target ID and normalized payload to `ContentRequestsController`; validation and change-applier tests pass. |
| 🟢 | Approve/deny/cancel content requests | Matching handlers and endpoint authorization exist; transition/concurrency tests pass. |
| 🟢 | Pending requests and own-request lists | Dashboard loads the appropriate endpoints for each role and offers cursor-based load more. Pagination tests cover review occurring between pages. |
| 🟢 | Concert management | Forms and direct create/update/delete handlers exist; concert creation, update with stable ID, deletion and input validation have passing tests. |
| 🟢 | Album management and track rows | Form/API mappings exist; song-row JSON serialization and track-list validation tests pass. Every album CRUD browser path is not separately tested. |
| 🟢 | Single management | Form/API mappings cover title, description, release date, photo, streaming links and album reference. Description, link validation and missing-album tests pass. |
| 🟢 | News management | Required title/date/author/content fields map to backend CRUD; required-date validation is covered. Full UI CRUD is source-reviewed only. |
| 🟢 | Timeline management | Date/event/location/description map to backend CRUD; required-date validation is covered. Full UI CRUD is source-reviewed only. |
| 🟢 | Member management | Name/instrument/photo form and CRUD handlers exist; image URL acceptance/rejection and draft normalization tests pass. |
| 🟢 | Gallery management | Media/title/description form and CRUD handlers exist; legacy missing-media rows remain editable, and gallery media validation tests pass. |
| 🟢 | Image uploads | UI posts multipart data with CSRF token; backend returns image data URLs. Valid PNG, fake bytes, missing-file and type-mismatch tests pass. |
| 🟢 | Video upload/storage/retrieval | UI posts to video endpoint; API stores database chunks and returns a media URL. Upload, chunk ordering and retrieval tests pass. Browser playback across accepted formats is not verified. |
| 🟢 | Draft normalization and album track editing | `adminDraft.js` tests cover uploaded image preservation, bare-domain normalization and song serialization/parsing. |
| 🟢 | Partial content-load errors and read retry | Successful collections are preserved; dashboard totals now load independently and show Unavailable if the summary request fails. Read retries respect rate-limit handling; mutations/authentication failures are not retried. Tests pass. |
| 🟢 | Initial account seeding safeguards | Tests verify startup does not restore revoked content-admin access or rename an existing admin. |
| 🟡 | Role protection and session revocation | Role attributes, principal validation and security stamps are present. CSRF rejection is tested, but complete HTTP authorization/cookie behavior is not covered by this audit. |
| 🟡 | Kick out a content admin | Fixed the partial-write issue: role removal, security-stamp change, profile removal and audit logging now share a relational transaction. A new test verifies wrong-password rejection, successful revocation, changed stamp and retained account. Live cookie invalidation and PostgreSQL rollback remain unverified. |
| 🟢 | Content-admin list | Fixed: UI now loads additional pages, deduplicates accounts and resets pagination on refresh. Backend uses UserId to break equal-name ties. A regression test reaches accounts beyond the first 50. |
| 🟢 | Dashboard summary totals | Fixed: authenticated `AdminDashboardController` returns database totals independent of loaded pages. Pending counts are scoped to the current content admin unless the viewer is a super admin. Active-admin counts exclude inactive profiles and disabled users. New tests cover more than 50 records and role scoping. |
| 🟡 | Content-record pagination | Fixed equal-sort-value instability by adding primary-key tie-breakers to all seven collections; regression test passes. Offset pagination can still shift if another administrator inserts/deletes/reorders records between pages; refresh to reload the current dataset. |
| 🟢 | Audit history | Fixed: cursor pagination replaces the 100-event history cap; all-admin history includes revoked accounts. Direct super-admin create/update/delete now record actor, action and actual entity ID inside a relational transaction. New tests cover older events, concurrent inserts and direct-write audit entries. PostgreSQL transaction rollback is not integration-tested. |
| 🟢 | Media upload error/session handling | Fixed: failed uploads and CSRF preparation now retain HTTP status in ApiError, allowing the existing access-error handler to process 401/403 responses. Live revocation during an upload remains unverified. |

## Checks actually run

- `npm.cmd run test:frontend`: **24 passed, 0 failed**.
- `dotnet test "Back End/MyApi.Tests/MyApi.Tests.csproj" /m:1 --no-restore`: **97 passed, 0 failed, 0 skipped**.
- `npm.cmd run lint`: **passed**.
- `npm.cmd run build`: **passed**, using the existing local environment with admin enabled.
- `git diff --check`: **passed**.
- No live browser/PostgreSQL end-to-end or rollback test was run. Backend tests use the in-memory provider.

## Remaining work

1. Run isolated browser/API/PostgreSQL checks for sign-in, registration, every content type, review and kick-out, including rollback on failed audit writes.
2. Consider cursor or snapshot pagination for content records if concurrent editing during pagination must be supported without a refresh.
3. Production administration remains intentionally disabled. Enabling it requires a separate deployment decision and API/database provisioning.

## Fixes applied after the initial audit

Application code now implements database-backed totals, content-admin load more, deterministic ordering, paginated global/per-admin audit history, direct-write audit records, transactional revocation, and status-aware upload/CSRF errors. Stale dashboard and audit responses are guarded against overwriting a reset/newer load. Seven backend regression cases were added; the existing update test now also verifies the audit entry. No production deployment configuration was changed.
