# FoodFest Platform (AWS on-prem branch)

Full-stack event registration and live voting platform for company events. It is Docker-first, Postgres-backed, and designed around server-authoritative voting windows, database-level duplicate protection, SSE live results, and admin controls.

This branch runs entirely on a single host with no external network dependency: nginx serves the built frontend and proxies `/api/` to the backend over the internal `docker compose` network. There is no Vercel, no Cloudflare Tunnel, and no hardcoded external domain — the app is reachable only via `http://localhost` or the server's own LAN/AWS private IP, which fits deployment inside an org network. See `docs/AWS_ONPREM.md`.

## Apps

- `apps/api`: Express, PostgreSQL, SSE, admin APIs, exports, audit logging, health checks.
- `apps/web`: React + Vite mobile-first client for registration, voting, public display, and admin dashboard.

## Local Start (single-host, everything in Docker)

1. Copy `.env.example` to `.env`.
2. Build and start Postgres, the API, and the nginx-served frontend:

```bash
docker compose up --build
```

The whole app is now reachable at `http://localhost` (or `http://<server-ip>` on an AWS/LAN box) on port 80. nginx proxies `/api/*` to the API container internally — neither Postgres nor the API port is published to the host, so nothing is reachable except through nginx.

### Frontend-only dev loop (optional)

For fast iteration on the UI, run the API via Docker and the frontend with Vite directly:

```bash
docker compose up --build postgres api
npm install
npm run dev:web
```

The API runs on `http://localhost:3000` and the web app runs on `http://localhost:5173` (Vite dev server proxies API calls via `PUBLIC_API_URL` in `.env`, or set it directly, e.g. `PUBLIC_API_URL=http://localhost:3000 npm run dev:web`).

## Production Shape

- Single Ubuntu/AWS host running `docker compose`: `postgres`, `api`, and `web` (nginx + built frontend), all on the compose-internal network.
- Only port 80 (the `web` service) is published. `api` and `postgres` have no published ports — reachable only from other containers on this host.
- No external domain, tunnel, or third-party hosting is used; access is via `localhost` or the server's own IP within the org network.
- Health monitoring: `GET /api/health`.
- Backups: `scripts/backup-postgres.sh`, scheduled via cron every 10 minutes during the event.

## Key Guarantees

- Duplicate registrations and votes are enforced by unique indexes on normalized email.
- Voting time is server-authoritative.
- Public results are broadcast with SSE on a fixed interval to avoid per-vote fanout spikes.
- If SSE drops, clients fall back to polling.
- Admin-configurable registration status, voting window, live result visibility, event assets, and team data.

## Deployment Notes

See `docs/AWS_ONPREM.md` for the single-host, no-external-contact deployment guidance used by this branch. Kubernetes learning manifests are under `k8s/`.
