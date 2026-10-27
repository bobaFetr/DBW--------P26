# Paralyze website analysis — 27 October 2026

Scope: repository source, deployment configuration, and automated checks. No deployed URL was supplied; live browser appearance, hosted headers, mobile gestures, and external streaming destinations were not verified. No application code was changed.

## Architecture and behavior

- Next.js 15.5.24 / React 19, App Router, static HTML export to `out/`.
- Render publishes a static service. Public records come from `data/temporaryContent.js`; publishing edits requires rebuilding the site.
- ASP.NET Core / Entity Framework / PostgreSQL support local administration, cookie authentication, roles, content approval, uploads, and audit logging. These services are absent from the configured production deployment.
- The public site includes home, albums, singles, concerts, news, gallery, members, timeline, about, merch, privacy, and an interactive airbrush canvas.
- Album details use URL fragments; single and news details use query parameters. Navigation uses ordinary anchors.
- Current content: one album, three singles, one member, four timeline entries, no concerts/news/gallery records. Missing gallery data is treated as an empty collection.

## Prioritized findings

1. **Medium — Invalid Merch markup can cause hydration problems.** `app/merch/page.jsx` passes an `h1` into `PageIntro`, which wraps children in a `p`. Browsers repair this invalid nesting before React hydrates. Use paragraph text or change the wrapper to accept block content.
2. **Medium — Static export does not pre-render the primary music content.** Public collection components start empty and load even bundled records in effects. Initial HTML therefore contains loading states instead of release titles and track lists. This limits no-JavaScript access and search/social extraction. Render bundled production content during the build, then add client interactions.
3. **Medium, conditional — Accepted external media is blocked in production.** URL helpers accept arbitrary HTTP(S) images, but deployment CSP allows images only from self/data/blob. Future externally hosted images will fail even though validation accepts them. Current active content uses local images and is unaffected. Align media validation with the deployment policy.
4. **Medium — Mobile navigation has incomplete focus management.** The menu locks body scrolling and closes on Escape, but does not move focus on opening, contain focus, make background content inert, or restore focus when Escape closes it. Keyboard focus can travel behind the open overlay. Verify with keyboard and assistive technology.
5. **Low — Backend pagination can overflow.** `ContentController` calculates `(page - 1) * pageSize` using an unchecked integer. Very large positive page values can wrap to an invalid or unexpected offset. Validate the offset or consistently use cursor pagination. This does not affect the static deployment.
6. **Low — Timeline refresh requests can race in backend mode.** Focus and visibility handlers can issue overlapping loads, and older responses can overwrite newer content. Add request sequencing or cancellation. Bundled static data is unaffected.
7. **Low — Motion preferences are not handled.** CSS contains pulsing and lightbox animations without a `prefers-reduced-motion` override. The airbrush canvas also has no keyboard drawing interaction despite its application role.
8. **Content readiness — Several prominent pages are incomplete.** Merch is unavailable; News and Members contain authoring-oriented introductory copy; album tracks include four repeated temporary names; one single description is punctuation; the member name is generic. The home hero leads with a delayed-update notice instead of a band introduction. Empty sections occupy substantial navigation space.
9. **Performance opportunity — Media and fonts.** The Coma Distraction JPEG is about 890 KB. Public image elements generally lack explicit dimensions and lazy loading. The external font stylesheet adds a third-party dependency. Measure actual rendering and layout shift before optimizing.
10. **Search sharing opportunity.** Global metadata exists, but there is no sitemap, canonical setup, social preview image, or separately generated release detail page. Detail views inherit collection metadata.

## Strengths

- Clear separation between static production and local administration.
- Matching restrictive CSP configurations in Render and `public/_headers`, plus HSTS and other security headers.
- Script externalization accommodates the script CSP without arbitrary inline execution.
- Public components distinguish loading failures from empty collections.
- Skip link, visible link/button focus indicators, active navigation labels, and gallery Escape/focus restoration support are present.
- Backend code includes cookie security, antiforgery validation, role checks, throttling, input validation, and transaction/audit protections. Passing unit tests support these flows but do not prove deployed security.

## Validation

- Frontend tests: 55 passed, 0 failed.
- Backend tests: 133 passed, 0 failed, 0 skipped.
- ESLint: passed.
- Production build: passed; static export and script externalization completed, and disabled admin output was removed.
- Installed locked JavaScript dependencies to run checks. The backend test run used existing restored packages.
- Historical audit reports were read as context; their past checks were not counted as checks performed in this review.

Recommended order: repair Merch markup, finish the public content, pre-render bundled records, improve menu focus behavior, then address conditional media policy and backend edge cases. Browser verification should cover desktop/mobile navigation, direct detail URLs, JavaScript-disabled output, gallery video focus, and canvas resize/save behavior.
