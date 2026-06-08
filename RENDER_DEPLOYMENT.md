# Render Test Deployment

This repo is prepared for three Render resources:

- `paralyze-db`: Render Postgres database
- `paralyze-api`: ASP.NET Core backend API
- `paralyze-site`: static Next.js frontend

## 1. Create the Render blueprint

Use the root `render.yaml` in Render Blueprints. It defines the database, backend, frontend, and the environment variables that connect them.

During blueprint creation, Render will ask for these secret values:

- `SeedUsers__SuperAdminPassword`
- `SeedUsers__ContentAdminPassword`

Use strong passwords. The app uses these to seed the initial admin users when the API starts.

## 2. Initialize the Render database from pgAdmin 4

The SQL script is generated at:

```text
Back End/DB/render-init.sql
```

In Render, open `paralyze-db` and copy the external database connection details. In pgAdmin 4:

1. Register a new server.
2. Use the Render external host, port `5432`, database name, username, and password.
3. Enable SSL/TLS if pgAdmin asks for it.
4. Open the Query Tool for the Render database.
5. Open or paste `Back End/DB/render-init.sql`.
6. Execute the script.

The script is idempotent, so rerunning it should not recreate migrations that already exist.

## 3. Deploy or redeploy the API

The API reads the database URL from:

```text
ConnectionStrings__DefaultConnection
```

The blueprint wires this from `paralyze-db`. If the API deploys before you run the SQL, it can fail while seeding users. After the SQL finishes in pgAdmin, redeploy `paralyze-api`.

## 4. Deploy the frontend

The frontend uses:

```text
NEXT_PUBLIC_API_BASE_URL=https://paralyze-api.onrender.com
```

Because this is a static Next export, this value is baked in during the Render frontend build.

## 5. Test checklist

- Open `https://paralyze-api.onrender.com/health` and expect `{"status":"ok"}`.
- Open `https://paralyze-site.onrender.com`.
- Log in as the seeded superadmin.
- Test content reads from the public pages.
- Test one admin mutation and one image upload.
