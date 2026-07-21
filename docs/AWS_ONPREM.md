# AWS On-Prem Deployment (no external contact)

This branch (`aws-onprem`) is built to run entirely inside a single AWS
Ubuntu instance that lives inside your org's network, with no traffic to
or from the public internet: no Vercel, no Cloudflare Tunnel, no external
domain baked into the build.

## Topology

```text
Browser (org network)
    |
    v
http://<server-ip-or-localhost>:80   (nginx: "web" service)
    |-- /            -> static frontend build
    `-- /api/*       -> proxied internally to the "api" service (port 3000, not published)
                              |
                              v
                        "postgres" service (port 5432, not published)
```

`postgres` and `api` have no ports published to the host — they are only
reachable from other containers on the `docker compose` network. The only
port exposed on the machine is 80 (nginx).

## Setup

```bash
git clone <this-repo> && cd foodfestBloom
git checkout aws-onprem
cp .env.example .env
# Edit .env: set ADMIN_USERNAME/ADMIN_PASSWORD/JWT_SECRET to real values.
docker compose up -d --build
```

That's it — no domain, DNS, or tunnel to configure. Visit the app at:

```text
http://localhost           # from the server itself
http://<server-private-ip> # from other machines on the org network
```

`PUBLIC_API_URL` should stay `/api` (the default in `.env.example`) — it's
baked into the frontend at `docker compose build` time and makes every
API call same-origin through the nginx proxy, so the browser never needs
to know the server's IP or hostname ahead of time.

## Health Monitoring

```text
GET http://<server>/api/health
```

## Backups

Schedule a cron job on the host:

```cron
*/10 * * * * /path/to/foodfestBloom/scripts/backup-postgres.sh
```

During the live event, keep a terminal open with:

```bash
docker compose logs -f api web
```

## Load Testing

```bash
artillery run load-tests/vote.yml
```

`load-tests/vote.yml` targets `http://localhost` by default and hits
`/api/*` paths, matching the nginx proxy. Point `target` at the server's
own IP if running the load test from another machine on the org network.
Use realistic test teams/emails and reset the event afterward from the
admin dashboard.

## Firewall

Since only port 80 needs to be reachable, lock down the AWS security
group / `ufw` rules to allow inbound 80 (and 22 for SSH) from the org's
IP range only — no other inbound ports are needed.
