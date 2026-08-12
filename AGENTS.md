# AGENTS

Sports odds / weekly pick’em (NFL, NCAAF, NBA, NCAAB) using The Odds API and MongoDB.

Package manager is **npm**. Workspaces: `packages/*`, `api`. Angular 22 requires **Node.js 22+** (see [version compatibility](https://angular.dev/reference/versions)).

## Repo map

| Area | Path | Nx project |
|------|------|------------|
| Angular UI | `ui/` | `ui` |
| Nest API | `api/` | `@app-espn-lines-mono/api` |
| API features | `api/src/lib/<domain>/` | (inside api) |
| Shared packages | `packages/*` | (empty; future) |
| Local stack | `docker-compose.yml` | Mongo + API + UI |

API domains: auth, users, odds, events, picks, results, mailer.

## Common commands

```sh
# Full local stack (Mongo + API + UI)
# First start (or after lockfile changes) runs npm ci inside the containers — watch those logs.
npm run compose:up
# or: docker compose up

# Wipe Linux node_modules volume + restart (use after big upgrades if serve looks stuck on old deps)
npm run compose:fresh

npm run compose:down

# Host-only apps with Mongo in Docker
docker compose up mongodb
npm run serve:api
npm run serve:ui

# Nightly ATS results sync runs inside the API at 11:00 PM America/Chicago
# (API process must stay running). Admins can also POST /api/results/sync.

# Import 2025 NCAA LOTW history from docs/LOTW Sheet.xlsx (Mongo must be up)
npm run import:lotw-ncaa

npx nx show project ui --json
npx nx show project @app-espn-lines-mono/api --json
npx nx run-many -t lint,build
```

Copy `.env.example` to `.env` and fill `JWT_SECRET` / `ODDS_API_KEY` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` before starting the API. The admin user is created (or synced) from those env vars on API startup.

Prefer `nx` for lint/build/serve. Do not invent targets — use `nx show project <name> --json`.

## Cursor rules

Stack-specific guidance lives in `.cursor/rules/`:

- `monorepo-map.mdc` — layout and boundaries (always on)
- `angular-ui.mdc` — UI conventions
- `nestjs-api.mdc` — API (Nest + Mongoose)
- `bootstrap-angular-forms.mdc` — Bootstrap 5 + Template-driven forms
