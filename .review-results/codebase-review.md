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

2. **High — startup seeding can undo removal or overwrite another admin's identity.** `Back End/DB/MyLibrary/DatabaseSeeder.cs:88` looks up the default username, then selects the sole user in the role when that username is missing. At line 130 it rewrites that user's username, email and display name. If the default content admin was kicked and no other content admins exist, startup recreates it; if exactly one other content admin exists, startup renames that account to the seed identity. `ContentAdminDataDeletion.cs` deletes the whole user, making these paths reachable. Seed only explicitly designated accounts and preserve deliberate revocation. This conclusion follows from the code; no restart was performed.

3. **High — approval can race with cancellation/denial and leave contradictory state.** `ContentRequestsController.cs:249` reads Pending and later writes Cancelled without a conditional update or concurrency token. An approval can commit between those steps, after which cancellation overwrites the status while the content remains published. `AdminRequestsController.cs:171` has the equivalent unprotected denial path: an account can receive the role while its request ends up Denied. Serializable transactions on the approval endpoint do not protect a separate stale, unconditional update that commits afterwards. Use atomic Pending-to-final transitions or concurrency tokens consistently. Real database concurrency was not tested.

4. **Medium — changing admin tabs turns an edit into a create.** `components/AdminDashboard.jsx:1018` clears `editingRecord` when switching collections but preserves the collection's draft. Edit a row, switch away and return: the old values remain, while `saveContent` at line 714 takes the Create branch. Publishing then inserts a duplicate instead of updating the original. Preserve edit identity per collection or reset the abandoned draft.

5. **Medium — drafts and editing identity survive account changes.** `components/AdminDashboard.jsx:405` resets session and request lists but not drafts, editingRecord, records, or pending content-load versions. Signing out and signing in as another admin in the same mounted dashboard can retain the previous user's unsaved content and edit target. Reset account-specific editor state and invalidate pending loads when the session changes.

6. **Medium — long news articles cannot be read in full.** `components/ApiCardGrid.jsx:50` puts all news content into the shared card body without a detail link. `app/globals.css:552` clips that body to four lines. There is no news detail page or expansion control. This affects sufficiently long posts in backend mode or future static news content; the current static news list is empty.

7. **Medium — invalid CSRF tokens become server errors.** `Back End/MyApi/Services/ApiAntiforgeryFilter.cs:23` lets antiforgery validation exceptions escape. The generic exception handler in `Program.cs:313` maps unhandled exceptions to HTTP 500. Requests with missing/stale CSRF tokens are therefore reported as internal failures instead of a deliberate client rejection. Catch the expected validation exception and return an appropriate client error. The unit tests bypass this filter.

8. **Medium — accepted image paths disagree across backend and frontend.** `ContentInputValidator.cs:520` accepts `/uploads/images/...`, while `components/securityUrls.js:4` explicitly excludes those paths. Existing or manually supplied content using that accepted backend format produces no frontend image. Current uploads return data URLs, so this does not affect every image upload. Align the supported formats and API-origin resolution.

9. **Medium — static navigation still depends on files deliberately removed by the build.** `components/SingleBrowser.jsx:80` and line 93 use Next Link; `NowPlayingBar.jsx:42` does so for its internal fallback. `scripts/externalize-inline-scripts.cjs:58` deletes every exported `.txt` file, including navigation payloads, and production CSP sets `connect-src 'none'`. The installed Next client attempts those fetches and contains a full-document fallback. Expect failed fetches/fallback navigation, not necessarily a permanently broken destination. Use ordinary document links consistently with this deployment design. No browser behavior was claimed as verified.

10. **Medium — local-admin build settings are interpreted differently by the build stages.** Next loads `.env.local`; `scripts/remove-disabled-admin-output.cjs:4` reads only its own process environment. With admin enabled only in `.env.local`, Next builds the admin route but the subsequent Node script removes it. The first build's output exhibited this mismatch. Load the same environment settings in both stages or make the intended production-only removal explicit. The development server is a separate path.

11. **Medium — media serving has avoidable memory and storage risks.** `UploadsController.cs:179` loads every stored chunk and combines the entire video before returning even a range-capable response. A 100 MiB video requires roughly 200 MiB just for chunk arrays and the combined buffer per request, before framework overhead. Uploads also lack ownership/publication linkage and a deletion/cleanup endpoint, so denied or abandoned video uploads remain stored and retrievable by URL. This is a static scalability/lifecycle finding, not a measured load-test result.

12. **Low — Merch is unfinished and emits invalid HTML nesting.** `app/merch/page.jsx:37` is an unavailable-page placeholder and supplies an h1 to `PageIntro`, which wraps children in a p at `components/PageIntro.jsx:5`. The resulting p/h1 structure is invalid and can require parser repair/hydration recovery. Merch should not count as a completed shop feature.

**Other limitations and inconsistencies**

- `RENDER_DEPLOYMENT.md:3` documents an API/database/website blueprint, but the actual `render.yaml` provisions only the static site. `Back End/DB/render-init.sql` also stops at the media-chunk migration and omits the later photo, track-list, description, request-version and setting migrations. It is not a complete current-schema substitute for startup migrations.
- `components/HomeContent.jsx:90` uses Promise.all and clears all home data when one collection throws. `components/publicContent.js:47` converts HTTP failures into empty arrays. Backend outages can therefore look like zero published content rather than unavailable data.
- `app/gallery/GalleryGrid.jsx:127` opens an aria-modal dialog without moving focus into it, trapping focus, or restoring focus to the trigger. Keyboard focus can remain behind the overlay. The current static content has no gallery collection, so this requires gallery content to observe.
- Upload tests labelled as valid PNG/MP4 use header-only bytes. Those tests establish header acceptance and byte storage, not that an image decoder or video player can render the upload. Header checks and base64 validation accept some non-renderable media.
- The Kick UI says it removes a role/profile, but the backend also deletes the account and its requests/audit data. The action description understates the actual deletion.
- Content lists and request payload lists are unpaginated. Large image data URLs are returned inline, which increases response size and dashboard memory use as content grows.
- The current static catalog has 1 album, 3 singles, 1 member and 4 timeline entries; concerts and news are empty, and gallery is absent. Those intentional empty states are distinct from code failures. Album track durations/text are also mostly absent in the static data.

**Interpretation**

The precise positive percentage is **100% of the existing tests pass**. Approximately **30.73% of non-migration backend instrumented lines were executed by those tests**. The percentage of the whole product that works without issues remains **unknown**, and the concrete defects above rule out calling it 100% issue-free. An overall 80%, 90% or 95% reliability score would be invented without an agreed feature inventory and broader behavioral evidence.
