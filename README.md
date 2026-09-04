# Paralyze Website

Paralyze is a Next.js 15 and React 19 website deployed as a static site. Public
site content is maintained in `data/temporaryContent.js`.

The repository also contains an ASP.NET Core API, PostgreSQL data layer, and
authenticated administration system for local development and testing. Those
services are not included in the Render deployment.

## Production architecture

- Next.js App Router with static export to `out/`
- Public content loaded from `data/temporaryContent.js`
- Static media served from `public/`
- One Render static-site service
- No production API or database
- The admin route disabled unless explicitly enabled locally
- Production Content Security Policy blocks browser API connections

## Static-site development

Install dependencies and start the frontend:

```bash
npm install
npm run dev
```

The site is available at `http://localhost:3000`. With no environment
configuration, it reads `data/temporaryContent.js`, matching production.

## Local backend and admin development

Copy `.env.example` to `.env.local`. Keep these values:

```text
NEXT_PUBLIC_CONTENT_SOURCE=temporary
NEXT_PUBLIC_API_BASE_URL=http://localhost:5001
ENABLE_LOCAL_ADMIN=true
```

Start the backend and frontend in separate terminals:

```bash
npm run dev:api
npm run dev:frontend
```

Open `http://localhost:3000/admin/` to test the administration system.
The public site will continue using `temporaryContent.js`.

The development API expects PostgreSQL on `localhost:5432`, using database
`paralyze` and username `postgres`. Replace `CHANGE_ME` in
`Back End/MyApi/appsettings.Development.json` with your PostgreSQL password,
and change the other fields there if your installation uses different values.

The development seed logins are:

- Super admin: `superadmin` / `LocalSuperAdmin-2026!`
- Content admin: `contentadmin` / `LocalContentAdmin-2026!`

To test public pages against the local API as well, change only this local
setting and restart the frontend:

```text
NEXT_PUBLIC_CONTENT_SOURCE=backend
```

Never set `ENABLE_LOCAL_ADMIN=true` in Render or another deployed environment.
Administrator passwords and local database settings must stay in ignored local
configuration files.

## Testing and validation

Run everything:

```bash
npm test
npm run lint
npm run build
```

Or run the suites independently:

```bash
npm run test:backend
npm run test:frontend
```

## Deployment

`render.yaml` provisions only `paralyze-site` as a static service:

```text
Build command: npm ci && npm run build
Publish directory: out
```

The backend, database, and admin system remain in the repository solely for
local development and testing.
