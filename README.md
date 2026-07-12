# FoodFest Platform

Full-stack event registration and live voting platform for company events. It is Docker-first, Postgres-backed, and designed around server-authoritative voting windows, database-level duplicate protection, SSE live results, admin controls, and straightforward deployment on an Ubuntu machine behind Cloudflare Tunnel.

## Apps

- `apps/api`: Express, PostgreSQL, SSE, admin APIs, exports, audit logging, health checks.
- `apps/web`: React + Vite mobile-first client for registration, voting, public display, and admin dashboard.

## Local Start

1. Copy `.env.example` to `.env`.
2. Start Postgres and the API:

```bash
docker compose up --build
```

3. In another terminal, install and run the web app:

```bash
npm install
npm run dev:web
```

The API runs on `http://localhost:3000` and the web app runs on `http://localhost:5173`.

## Production Shape

- Frontend: Vercel.
- Backend: Docker container on Ubuntu, managed by PM2 or Docker restart policy.
- Database: local PostgreSQL container or host Postgres, never publicly exposed.
- Public ingress: Cloudflare Tunnel from `api.domain.com` to `localhost:3000`.
- Health monitoring: `GET /health`.
- Backups: `scripts/backup-postgres.sh`, scheduled via cron every 10 minutes during the event.

## Key Guarantees

- Duplicate registrations and votes are enforced by unique indexes on normalized email.
- Voting time is server-authoritative.
- Public results are broadcast with SSE on a fixed interval to avoid per-vote fanout spikes.
- If SSE drops, clients fall back to polling.
- Admin-configurable registration status, voting window, live result visibility, event assets, and team data.

## Deployment Notes

See `docs/DEPLOYMENT.md` for Ubuntu, Cloudflare Tunnel, PM2, backup, and load-test guidance. Kubernetes learning manifests are under `k8s/`.
