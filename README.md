# Paralyze Website

Paralyze is a frontend-only website built with Next.js 15 and React 19. It is
exported as static HTML, CSS, and JavaScript and does not require an API,
database, authentication service, or Node.js production server.

## Current architecture

- Next.js App Router
- React 19
- Static export to `out/`
- Hardcoded public content in `data/temporaryContent.js`
- Static media served from `public/`
- Render static-site configuration in `render.yaml`

Browser connections to APIs are temporarily disabled. The deployed Content
Security Policy uses `connect-src 'none'`, and a frontend test prevents active
`fetch`, Axios, XMLHttpRequest, WebSocket, EventSource, or `/api/` usage from
being added accidentally.

## Local development

Install the dependencies and start the development server:

```bash
npm install
npm run dev
```

The development site is available at `http://localhost:3000` by default.

## Editing site content

Edit `data/temporaryContent.js` to update:

- albums and album track lists
- singles and streaming links
- concerts
- gallery items
- news
- members
- timeline events

Use ISO dates in `YYYY-MM-DD` format so content sorts correctly. Media files
should be placed under `public/` and referenced with root-relative paths, such
as `/singles/cover.jpg` or `/gallery/live-photo.png`. Remote image URLs are not
supported by the current static-site security policy.

## Public pages

- `/`
- `/about/`
- `/airbrush-board/`
- `/albums/`
- `/concerts/`
- `/gallery/`
- `/members/`
- `/merch/`
- `/news/`
- `/privacy-policy/`
- `/singles/`
- `/timeline/`

## Testing and validation

```bash
npm test
npm run lint
npm run build
npm audit
```

`npm run build` creates the deployable static website in `out/`. The frontend
test suite includes URL-safety checks and a guard against introducing API
endpoint usage.

## Deployment

The included `render.yaml` deploys the project as a Render static site using:

```text
Build command: npm ci && npm run build
Publish directory: out
```

The contents of `out/` can also be deployed to any host that supports static
files. Preserve the configured security headers when using another host.

## Current content status

The website is intentionally using temporary hardcoded content. One album,
singles, one member profile, and timeline events are currently published.
Concerts, news, and the gallery currently have no published entries; merch is
marked unavailable; and the privacy-policy page contains a short privacy
statement.

## Future content architecture

The current static content approach can continue to support albums, songs,
concerts, news, and photos without requiring a backend or database. As the
amount of content grows, complete the following improvements:

1. Split each content type into a separate file, such as `albums.js`,
   `singles.js`, `concerts.js`, `news.js`, `gallery.js`, and `members.js`.
2. Store album tracks as normal JavaScript arrays and objects instead of JSON
   strings such as `trackListJson`.
3. Add build-time validation for required fields, unique IDs, ISO dates, safe
   URLs, and referenced media files.
4. Consider a headless CMS later if non-technical editors need to publish
   content, updates become frequent, or drafts and scheduled publishing are
   required.

A custom backend and database are not necessary solely because the catalog
grows. They should be introduced only when the website needs interactive
features such as accounts, orders, payments, form submissions, uploads, or
other server-managed data.
