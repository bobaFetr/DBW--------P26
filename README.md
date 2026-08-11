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

The website is intentionally using temporary hardcoded content. Singles, one
member profile, and timeline events are currently published. Albums, concerts,
news, and the gallery currently have no published entries; merch is marked
unavailable; and the privacy-policy page still needs its final text.
