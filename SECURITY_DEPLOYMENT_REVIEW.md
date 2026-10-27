# Security and cloning review — 27 October 2026

## Subsequent hardening in this session

The findings below describe the pre-change audit. The current workspace now uses
Next 15.5.28, React/React DOM 19.3.1, sharp 0.35.5, source-map-js 1.2.2, and aligned
Next lint configuration; compatible development dependency fixes were also applied.
The final npm audit reported zero known vulnerabilities. Production builds now
force static content, disable admin and API overlay regardless of local settings,
remove both admin HTML and its route JavaScript, and reject unapproved artifacts,
selected credential patterns, and inline scripts. Production source maps are
explicitly disabled. A Docker ignore file excludes local secrets and build files.
All 60 frontend tests, lint, publication checks, and production build passed,
including a build invoked with deliberately conflicting local admin/API settings.
These changes are local and have not been deployed to Render or pushed to Git.
Hosting/registrar MFA, deployed headers, and live-site configuration remain
unverified. Zero audit findings do not guarantee absence of vulnerabilities.

## Scope and limits

Reviewed local source, static output, authentication, antiforgery handling, role and selected ownership checks, uploads, bootstrap, Docker, database TLS validation, proxy configuration, and package advisories. No production URL, hosting account, domain settings, or private-network configuration was inspected. This is not a penetration test or proof that every endpoint is safe. Application code and deployment settings were not changed.

REA can inspect frontend scripts, page structure, requests, and visible behavior: https://rea.tools/ . Browser-delivered assets are observable. Copying them must never confer authorization on the real API. Server implementation and database contents are not automatically recovered from public page inspection.

## Current static deployment

Confirmed: Render publishes only `out/`, uses temporary public content, disables admin, and configures restrictive CSP including `connect-src 'none'`. Latest build removed the admin output. A targeted output scan found no `.map`, `.dll`, `.json`, `.config`, or `.env*` files. This is not a comprehensive secret scan or a check of actual hosted files.

Priority actions:

1. Require MFA on hosting, repository, and registrar accounts; review collaborators and deployment tokens. Account settings were not accessible in this review.
2. Keep deployment limited to `out/`; add automated artifact checks for private files, credentials, source maps, and admin output. Keep originals and unpublished assets outside `public/` and browser-imported modules.
3. Patch dependencies and repeat tests/build. The current production dependency audit flags Next, sharp, and source-map-js. npm reports Next 15.5.28 as a fix candidate; inspect release/advisory details before applying. Server/image-processing advisories do not establish exploitation of the static output, which has no Next runtime and disables image optimization.
4. Keep security headers and source-map defaults. They reduce attack surface or source disclosure; they do not prevent design cloning.
5. Consider edge rate limiting/bot challenges for actual scraping abuse, while retaining legitimate visitor and search access. A person can still save content their browser receives.

## Backend findings and actions before launch

| Priority | Source evidence | Required response |
| --- | --- | --- |
| High | `AuthController.Login` implements password sign-in but no MFA completion endpoint was found. Identity schema fields alone do not implement MFA. | Require MFA through an identity gateway protecting both admin UI and administrative API, or implement and test complete application MFA and recovery. Do not leave an unprotected alternate origin. |
| High | Development settings are Git-tracked and contain seed-password fields; README documents development credentials. Seeder runs on production startup too, creating two privileged accounts on a fresh database. | Use unique production secrets, no reused development credentials, controlled bootstrap, and account review. Do not copy development databases containing known accounts. Moving a field to secrets does not rotate an existing user's password. |
| High | `Dockerfile.render` uses `COPY . .`; no `.dockerignore` exists. ASP.NET loads optional `appsettings.Local.json` in every environment. | Exclude local settings, `.env*`, Git metadata, keys, cloud credentials, and build artifacts from Docker context. Inspect publish output for development/local settings. Broad COPY is a build-context/cache exposure risk; this review did not prove a publicly downloadable secret. |
| High | Database TLS guard rejects Disable/Prefer but permits Allow, which can use plaintext. URI normalization defaults to Require, which does not authenticate server identity. | Require VerifyFull with appropriate trusted CA/hostname for TCP production PostgreSQL, and private database networking. Validate effective options, not only configuration text. |
| Medium | Uploaded video GET is anonymous and immutable-cacheable without checking whether an approved public record references it. | Decide explicitly whether uploaded media is public immediately. If drafts must be private, authorize draft reads and publish approved assets separately; do not publicly cache drafts. UUIDs are not access control. |
| Medium | Images use header/dimension checks; videos use signatures. Entire videos up to 100 MB are buffered and copied before database storage. | Add bounded decode/validation, image pixel limits, total/per-user quotas, cleanup, concurrency/memory limits, and suitable media storage. Keep anonymous upload forbidden. |
| Medium | Forwarded headers are enabled, but host-specific known proxy/network configuration is absent. Anonymous limiter keys use RemoteIpAddress. | Configure only the actual trusted proxies and verify real client IP and HTTPS scheme. Otherwise users may share a proxy bucket; blindly trusting headers enables spoofing. |
| Medium | Explicit Data Protection persistence is configured only in development. | Provide protected persistent production keys, shared across replicas when needed. Without deployment-specific persistence, replacement containers can invalidate cookies. |
| Medium | Automatic migrations execute with the runtime database connection. | Use a separate deployment migration identity; restrict runtime database privileges. Stage schema updates and backup/restore checks. |
| Medium | CSP blocks API connections and backend media; admin enable switch is local-only. | Design production admin hosting separately. Allow only required API/media origins; configure explicit HTTPS CORS/AllowedHosts and Production environment. Do not replace CSP with wildcards. |
| Low | Unchecked `(page - 1) * pageSize` appears in public pagination. | Bound/validate pagination offsets or use existing cursor support. |

Additional production controls: no-store for sensitive admin/auth responses, protected audit-log access, edge abuse limits, server-side input/ownership/role/state checks on every action, encrypted tested backups, security alerts, dependency updates, and container execution as a non-root user (the Dockerfile has no USER directive).

## Existing protections worth retaining

- Super-admin authorization on direct content mutations and administrator management.
- Role restrictions on uploads; selected content-request ownership and pending-state checks.
- Global antiforgery filter on unsafe methods, including login.
- HttpOnly authentication cookies, production Secure policy, lockout and login rate limits.
- Password hashing, security-stamp/session revocation, active administrator checks.
- Explicit production host and CORS startup guards, generic global error handling, development-only OpenAPI.
- Audit/transaction protections and broad unit coverage. This review did not inspect every authorization branch or assert complete coverage.

## Recommended architecture

Keep the public frontend static. Put public read-only content endpoints behind an HTTPS edge. Put admin UI plus all privileged API routes behind MFA-based access control with origin bypass prevented. The backend connects to private PostgreSQL using verified TLS and least privilege. Public frontend code contains no privileged secret. Public reads remain copyable; administrative changes remain authorized on the server.

## Evidence and validation

- Earlier in this same session: frontend 55/55 tests, backend 133/133 tests, lint and static production build passed. Tests do not certify security.
- Current npm production audit: 3 affected packages, aggregate classifications 1 critical / 2 high. These are package-level findings requiring deployment applicability analysis, not 3 proven live-site exploits.
- Current NuGet transitive vulnerability check: no vulnerable packages reported by configured sources.
- Certificate/network failures were retried using approved access; npm used system certificate authorities without disabling TLS validation.
- No infrastructure account inspection, live exploit attempts, full repository-history secret scan, or deployed header check occurred.

## Primary guidance

- Browser trust boundary: https://cheatsheetseries.owasp.org/cheatsheets/Web_Frontend_Security_Cheat_Sheet.html
- API authorization, HTTPS, management endpoints: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- Upload controls: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- Database TLS modes: https://www.npgsql.org/doc/security.html
- Proxy trust: https://learn.microsoft.com/en-gb/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-10.0
- Container key persistence: https://learn.microsoft.com/mt-mt/aspnet/core/security/data-protection/configuration/overview?view=aspnetcore-10.0
- Next public variables: https://nextjs.org/docs/app/guides/environment-variables
- Package advisories: https://github.com/advisories/GHSA-2464-fhr4-w9xw , https://github.com/advisories/GHSA-wq5f-xc86-pv6w , https://github.com/advisories/GHSA-68fv-2mgg-jv7q
