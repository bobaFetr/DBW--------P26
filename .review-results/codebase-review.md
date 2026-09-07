Codebase review — 7 September 2026

The existing tests pass, but the repository is not issue-free. There is no defensible percentage of the entire codebase that can be certified as working from these checks. Test pass rate, execution coverage, feature completeness, and correctness are different measures.

**Scope and restrictions**

Reviewed the public pages and components, complete admin dashboard and helpers, CSS, static content, API startup and middleware, all seven controllers, services, DTOs, entity models and relationships, seeding, migration changes and current snapshot, SQL deployment scripts, build scripts, configuration, documentation, and tests. Generated migration snapshots were checked for schema consistency rather than treated as independent features. Third-party dependency internals and binary media were not audited comprehensively.

No backend or frontend server was started, no debugger was attached, no browser automation was used, and no database migrations were executed. The initial review changed no application source. A subsequent user-requested CSS fix is recorded under finding 1 below. Builds and coverage generated local artifacts.

**Measured results**

| Check | Result |
| --- | --- |
| Backend xUnit suite | 69 passed, 0 failed, 0 skipped |
| Frontend Node suite | 24 passed, 0 failed, 0 skipped |
| Combined existing-test pass rate | 93/93 = 100% |
| ESLint | Passed, no reported warnings/errors |
| Production build and post-processing | Passed |
| Backend coverage, excluding migration files | 1,007/3,277 instrumented lines = 30.73% |
| MyApi assembly line coverage | 26.68% |
| Raw backend coverage including migrations | 1,007/10,178 = 9.89% |
| Frontend coverage reported by Node | 91.77% of the three named helper files it captured; not whole-frontend coverage |

The backend suite uses EF Core InMemory and directly invokes methods. It does not test the real HTTP middleware pipeline, PostgreSQL constraints, SQL translation, transactions, migrations, or concurrent requests. Login/logout, ContentRequestsController, AdminRequestsController, ContentAdminsController, startup and seeding have no meaningful behavioral coverage. The frontend kickout test checks source-text patterns rather than rendering the dashboard and exercising a session.

Node coverage reports adminDraft.js, publicContentMerge.js and securityUrls.js. Other helpers execute through unnamed VM scripts; JSX components and pages are not exercised by that metric. Neither 30.73% nor 91.77% means that percentage is issue-free.

Commands executed: `npm.cmd run test:frontend`, `dotnet test "Back End/MyApi.Tests/MyApi.Tests.csproj" /m:1 --no-restore`, `npm.cmd run lint`, and `npm.cmd run build`. Tests were repeated with the existing Coverlet collector and Node coverage enabled. The build was repeated with temporary content, local overlay disabled, and admin disabled explicitly to check production settings. The original PowerShell `npm` alias was blocked by execution policy; `npm.cmd` ran successfully without changing that policy.

Static artifact checks found all three image paths referenced by current temporary content on disk, no missing same-origin src/href targets in the first export's 14 HTML files, and no remaining executable inline script bodies. Admin HTML and flight text files were removed by post-processing. External links, hosted headers, visual appearance and real media playback were not exercised.

**Priority findings**

1. **FIXED — High — admin styles were scoped under the wrong element.** Fixed on 7 September 2026 by closing `.admin-export textarea` immediately after its declarations in `app/globals.css:2450` and removing the extra closing brace at the end of the stylesheet. Previously, 51 rule nodes, including login, toolbar, status and responsive admin styles, were nested under the textarea selector. PostCSS parsing after the fix succeeded and confirmed **zero nested rule nodes**; `git diff --check` also passed. No server, debugger or browser automation was used for this fix. The earlier build results above describe the initial review, not a rebuild after this change.

2. **FIXED — High — startup seeding could undo removal or overwrite another admin's identity.** Fixed on 7 September 2026 in `Back End/DB/MyLibrary/DatabaseSeeder.cs`. The seeder no longer substitutes a sole role holder for the default account. It persists a `DefaultContentAdminSeeded` setting after first creation, so a deliberately deleted default Content Admin is not recreated on later starts; an existing non-default Content Admin also prevents fallback creation. `Back End/MyApi.Tests/DatabaseSeederTests.cs` covers both regressions.

3. **FIXED — High — approval could race with cancellation/denial and leave contradictory state.** Fixed on 7 September 2026 in `ContentRequestsController.cs` and `AdminRequestsController.cs`. Relational-database transitions now use a conditional `WHERE Status = Pending` update before approval side effects or final denial/cancellation. Exactly one competing actor can claim a pending request; the losing actor receives the existing conflict response. The in-memory test-provider fallback retains equivalent sequential behavior.

4. **FIXED — Medium — changing admin tabs turned an edit into a create.** Fixed on 7 September 2026 in `components/AdminDashboard.jsx`. Switching collections now resets the draft belonging to an abandoned edit before clearing its edit identity, so returning to that collection cannot publish its former values as a new row.

5. **FIXED — Medium — drafts and editing identity survived account changes.** Fixed on 7 September 2026 in `components/AdminDashboard.jsx`. Resetting admin state now invalidates pending loads and clears the active collection, records, counts, drafts, edit target, review note, and upload state, preventing one admin's unsaved state from being shown to the next.

6. **FIXED — Medium — long news articles could not be read in full.** Fixed on 7 September 2026 with `components/NewsBrowser.jsx` and `app/news/page.jsx`. News cards retain their four-line summaries but now include a document link to a full article view, which preserves whitespace and renders the complete post content.

7. **FIXED — Medium — invalid CSRF tokens became server errors.** Fixed on 7 September 2026 in `Back End/MyApi/Services/ApiAntiforgeryFilter.cs`. Expected `AntiforgeryValidationException` failures now produce HTTP 400 with an explicit error message rather than reaching the generic HTTP 500 handler. `Back End/MyApi.Tests/ApiAntiforgeryFilterTests.cs` covers this result.

8. **FIXED — Medium — accepted image paths disagreed across backend and frontend.** Fixed on 7 September 2026 in `components/securityUrls.js` and its callers. `/uploads/images/...` remains a backend-supported format and is now resolved against the configured API origin before it reaches public or admin image renderers. The frontend URL tests cover this resolution.

9. **FIXED — Medium — static navigation depended on files deliberately removed by the build.** Fixed on 7 September 2026 in `components/SingleBrowser.jsx` and `components/NowPlayingBar.jsx`; the admin dashboard's public-page link was aligned as well. These internal navigations now use ordinary document anchors, avoiding client-side navigation payload requests that conflict with the static export post-processing and production CSP.

10. **FIXED — Medium — local-admin build settings were interpreted differently by the build stages.** Fixed on 7 September 2026 in `scripts/remove-disabled-admin-output.cjs`. The cleanup stage now loads the project environment through `@next/env`, matching Next's `.env.local` handling. A build with `ENABLE_LOCAL_ADMIN=true` retains `out/admin/index.html`; the production-style build continues to remove it.

11. **PARTIALLY FIXED — Medium — media serving had avoidable memory and storage risks.** On 7 September 2026, `UploadsController.cs` was changed to return a seekable, chunk-backed stream for chunked videos. Range playback now reads and caches one database chunk at a time instead of loading every chunk and creating a duplicate combined video buffer. `UploadsControllerTests.cs` verifies streamed chunk content and range capability. Upload ownership/publication linkage and cleanup of denied or abandoned uploads remain intentionally deferred while photos and videos are stored temporarily in the local database.

12. **FIXED — Medium — account removal was unexpectedly destructive and audit history was unavailable.** On 7 September 2026, `ContentAdminsController.cs` was restored to revoke only the `ContentAdmin` role and remove its admin profile. The account and request history are retained. The controller once again exposes the latest 100 audit events for a Content Admin; `AuditLogger.cs` records request submission, approval, denial, cancellation, access grants, and access revocation. `AdminDashboard.jsx` exposes the audit view and accurately describes kick behavior.

13. **FIXED — Low — a home-page collection failure cleared unrelated published content.** On 7 September 2026, `HomeContent.jsx` switched to independently settled collection loads. Successfully loaded sections remain visible and the page identifies the unavailable collections.

14. **FIXED — Low — gallery dialog keyboard focus remained behind the overlay.** On 7 September 2026, `app/gallery/GalleryGrid.jsx` was updated to move focus to its close button, keep Tab navigation within the lightbox controls, and restore focus to the gallery trigger when closing.

15. **FIXED — Medium — existing databases could recreate an intentionally removed default Content Admin during seed-marker rollout.** On 7 September 2026, migration `20260907140000_PreserveExistingContentAdminSeedState` marks existing populated databases as already seeded before the revised seeder runs. Fresh local databases remain eligible for their initial default Content Admin creation.

16. **FIXED — Medium — dashboard and review lists were unbounded.** On 7 September 2026, content, content-change request, and content-admin request APIs gained positive, capped 50-row pages. `AdminDashboard.jsx` shows the first page and provides explicit Load more controls; public pages using the local API transparently retrieve all pages so published content is not omitted.

12. **Low — Merch is unfinished and emits invalid HTML nesting.** `app/merch/page.jsx:37` is an unavailable-page placeholder and supplies an h1 to `PageIntro`, which wraps children in a p at `components/PageIntro.jsx:5`. The resulting p/h1 structure is invalid and can require parser repair/hydration recovery. Merch should not count as a completed shop feature.

**Other limitations and inconsistencies**

- **FIXED:** `RENDER_DEPLOYMENT.md` now documents the actual static-only Render deployment. The obsolete, incomplete `Back End/DB/render-init.sql` was removed; local API startup applies current EF Core migrations.
- **FIXED:** `HomeContent.jsx` retains successful collections and distinguishes unavailable content from an empty collection. Individual public-list pages still need a shared unavailable-state UI when using the backend content source.
- **FIXED:** `GalleryGrid.jsx` now manages focus for its modal dialog. The current static content has no gallery collection, so this requires gallery content to observe.
- Upload tests labelled as valid PNG/MP4 use header-only bytes. Those tests establish header acceptance and byte storage, not that an image decoder or video player can render the upload. Header checks and base64 validation accept some non-renderable media.
- The Kick UI says it removes a role/profile, but the backend also deletes the account and its requests/audit data. The action description understates the actual deletion.
- **FIXED:** content and request lists use 50-row pages. The dashboard loads more only on request; public backend-mode content fetches subsequent pages transparently.
- The current static catalog has 1 album, 3 singles, 1 member and 4 timeline entries; concerts and news are empty, and gallery is absent. Those intentional empty states are distinct from code failures. Album track durations/text are also mostly absent in the static data.

**Interpretation**

The precise positive percentage is **100% of the existing tests pass**. Approximately **30.73% of non-migration backend instrumented lines were executed by those tests**. The percentage of the whole product that works without issues remains **unknown**, and the concrete defects above rule out calling it 100% issue-free. An overall 80%, 90% or 95% reliability score would be invented without an agreed feature inventory and broader behavioral evidence.
