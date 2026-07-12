# Deployment Guide

## Ubuntu Server

Install Docker, Docker Compose, Node.js 20, PM2, and Cloudflare Tunnel. Keep PostgreSQL private on the machine or inside Docker networking.

```bash
cp .env.example .env
docker compose up -d --build
```

Cloudflare Tunnel should route:

```text
api.domain.com -> http://localhost:3000
```

No router port forwarding is required.

## PM2 Option

If you run the API directly instead of Docker:

```bash
npm install
npm run build --workspace apps/api
pm2 start apps/api/dist/index.js --name foodfest-api
pm2 save
pm2 startup
```

Use `pm2 logs foodfest-api` for application logs.

## Frontend

Deploy `apps/web` to Vercel with:

```text
VITE_API_URL=https://api.domain.com
```

## Health Monitoring

Monitor:

```text
GET https://api.domain.com/health
```

The response includes API status, database connectivity, version, server time, and uptime.

## Backups

Schedule a cron job on the Ubuntu host:

```cron
*/10 * * * * /path/to/foodFest/scripts/backup-postgres.sh
```

During the live event, also keep a manual terminal open with:

```bash
docker compose logs -f api
```

## Load Testing

Run a load test several days before the event against the actual domain.

```bash
artillery run load-tests/vote.yml
```

Use realistic test teams and test emails. Reset the event afterward from the admin dashboard.
