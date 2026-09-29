# Software bug review — 29 September 2026

Reviewed the public frontend, local admin dashboard, API controllers, authentication and CSRF flow, content validation, database relationships, upload handling, request review transactions, and static deployment configuration. This is a source review with automated checks and selected real PostgreSQL transaction checks, not proof that every browser or production workflow is correct.

## Confirmed issues fixed

| Priority | Bug and trigger | Change | Evidence |
| --- | --- | --- | --- |
| High | Content-request creation, approval, and denial committed before audit logging. Cancellation had no enclosing transaction. A logging failure could return an error after the requested change had already persisted. | Audit logging now runs inside the same relational transaction as each mutation. | The isolated PostgreSQL check injects audit failures for all four actions and verifies rollback; approval also verifies no news record was published. |
| Medium | Disabling content-admin applications did not block `POST /api/content-admin-requests`, although it blocked registration. An authenticated non-admin could still submit through the alternate route. | Both routes enforce the permission setting, including its default-disabled state. | Tests cover missing/disabled settings and an authenticated user submitting before and after enabling the setting. |
| Medium | With temporary content and the local overlay enabled, only the first 50 API records appeared on public pages. | Overlay loading follows all API pages before merging and sorting. A later-page failure falls back to temporary content without showing an incomplete local collection. | Regression tests reproduce the original truncation and verify multi-page loading and failure fallback. |
| Medium | Browser storage exceptions could interrupt admin startup, login, and logout because the optional stored role was accessed without error handling. | Reading, writing, and clearing the role hint tolerate unavailable local storage. Cookie authentication remains authoritative. | A regression test makes the storage accessor throw and verifies that session helper calls complete. |
| Low | An empty API error response replaced the useful HTTP status with the literal text `null`. | Preserve the HTTP status message when there is no error body. | An empty 403 response now produces `403 Forbidden` in a regression test. |
| Medium | Public API failures appeared as empty collections, and homepage counts displayed zero for unavailable collections. | Public pages distinguish failed loading from empty results; homepage counts show `Unavailable`. Timeline refresh failures preserve previously loaded content and show an error. | Source review, lint, and production build. These messages have not been exercised in a browser during this review. |

The earlier mobile-menu color, desktop-resize state, narrow canvas, and gallery video-arrow changes were already present when this review started.

## Remaining findings and limitations

1. **Large pagination inputs can overflow.** Several API list endpoints compute `(page - 1) * pageSize` using 32-bit integers without an upper bound. Extreme positive page values can become negative offsets or wrap to an earlier page. This remains a low-priority input-validation defect; ordinary dashboard pagination is unaffected. Relevant code: `ContentController.GetAll`, `ContentAdminsController.GetAll`, and the request-list endpoints.
2. **Media validation checks headers, not complete decodability.** Image uploads inspect signatures/dimensions and video uploads inspect container signatures. Existing tests deliberately use header-only fixtures. Corrupt or incomplete media can therefore be accepted and later fail to display. Full decoder validation and real browser playback were not added in this review.
3. **Some public refreshes can race.** `ApiTimeline` starts loads on both focus and visibility changes without cancelling or sequencing them. A slower older response can replace a newer result. The new error messages do not resolve this pre-existing ordering issue.
4. **Browser and deployed behavior remain unverified.** No browser end-to-end session, deployed-site check, load test, or dependency advisory scan was performed. Keyboard navigation, mobile gestures, media playback, and cookie behavior across actual origins still need live verification.

## Deployment interpretation

The configured production service is intentionally static: it uses `data/temporaryContent.js`, disables the admin route, and blocks API connections with CSP. Backend/admin changes do not publish content to that deployed site. This matches the README and Render configuration and is not classified as a bug.

The build run here used the existing local environment, which enables the admin route. It does not verify a deployment with production environment values.

## Checks performed

- Backend suite: **133 passed**, none failed or skipped. These tests use the in-memory database provider.
- Frontend suite: **55 passed**, none failed.
- ESLint: passed.
- Next.js production build and static-export postprocessing: passed.
- Isolated real PostgreSQL checks: admin approval/denial/revocation rollback and content-request creation/approval/denial/cancellation rollback passed with injected audit failures. The uniquely named scratch database was removed by the check's cleanup routine.
- Three local media paths referenced by active temporary-content records exist in `public/`.
- `git diff --check`: passed.

Reproduce the transaction check with `dotnet run --project scripts/AdminTransactionChecks/AdminTransactionChecks.csproj`. It requires the configured local PostgreSQL instance and creates/removes an isolated scratch database.
