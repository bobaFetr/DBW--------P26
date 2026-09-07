# Render deployment

Render deploys only the static Next.js site defined in `render.yaml`. It has no
API, database, or admin route, and published content comes from
`data/temporaryContent.js`.

The ASP.NET Core API and PostgreSQL database are local-development tools. Start
the API locally to apply EF Core migrations automatically; do not use a
checked-in SQL bootstrap script, as it can become stale when migrations change.

See [README.md](README.md) for the supported local-admin workflow and the
static deployment configuration.
