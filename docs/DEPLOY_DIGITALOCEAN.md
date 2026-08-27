# Deploy ERA Ecosystem on DigitalOcean (pull-only)

Production deploy uses **GHCR pre-built images** — no `docker compose build` on the server.

## 1. Droplet

- Ubuntu 24.04, **8 GB RAM** / 4 vCPU recommended (13 app images + Postgres + Redis)
- Reset/reinstall droplet if replacing legacy site
- UFW: `22`, `80`, `443` — **port 22 must accept inbound SSH** from GitHub Actions (or your IP) for `Deploy staging` workflow

```bash
apt update && apt install -y docker.io docker-compose-plugin git
usermod -aG docker deploy
```

## 2. DNS

Point to droplet IP (wildcard optional):

- `era-365.online`, `app`, `api`, `finance-core`, `finance-api`, `data`
- `hotel-pms`, `fnb-pos`, `clinic`, `retail-pos`, `logistics`, `construction`, `crm`, `auto-service`, `wholesale`

TLS: Traefik ACME (`traefik/traefik.yml`, volume `docker-data/letsencrypt`). Update ACME email in `traefik.yml` if needed.

## 3. Clone repo (config only)

```bash
sudo mkdir -p /opt/era-ecosystem && sudo chown deploy:deploy /opt/era-ecosystem
cd /opt/era-ecosystem
git clone https://github.com/<org>/era-ecosystem.git .
```

## 4. Environment

```bash
cp .env.production.example .env
# Edit secrets, origins, GHCR_IMAGE_PREFIX, IMAGE_TAG
```

Login to GHCR (PAT with `read:packages`):

```bash
echo "$GHCR_PULL_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin
```

## 5. Pull and run

```bash
export IMAGE_TAG=dev-<short-sha>   # from successful build-images workflow
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
chmod +x docker/scripts/migrate-all.sh
COMPOSE_FILE=docker-compose.prod.yml ./docker/scripts/migrate-all.sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --wait --wait-timeout 180 orchestrator
node scripts/ecosystem-smoke-all.mjs
```

## 6. GitHub Actions deploy

Configure environment **staging** secrets (`SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `ENV_FILE`, `GHCR_PULL_TOKEN`), then:

1. Merge to **`dev`** → **Build and push images** runs automatically  
2. On success → **Deploy staging** auto-runs (`workflow_run`): SSH → `pull` → migrate → `up -d` with `IMAGE_TAG=dev-<sha>`  

Manual override: Actions → **Deploy staging** → `workflow_dispatch` (tag default `dev`, **scope default `finance`**). Use `all` only when the whole stack must move.  
Production: **Deploy production** remains manual only.

Droplet UFW must allow SSH `:22` from GitHub Actions (currently OpenSSH ALLOW Anywhere is fine for staging).

## 7. Operations

| Task | Command |
|------|---------|
| Logs | `docker compose -f docker-compose.prod.yml logs -f orchestrator` |
| Prune old images | `docker image prune -f` (also in deploy workflow) |
| Update stack | New `IMAGE_TAG` → `pull` → `migrate-all.sh` → `up -d` + `--wait` orchestrator |

## Troubleshooting

| Issue | Check |
|-------|--------|
| Pull 401 / `ghcr.io/v2/: denied` | Actions deploy logs in with the job `github.token` (not a stale `GHCR_PULL_TOKEN` PAT). Manual pull still needs a PAT with `read:packages`. `.env` is scp'd; login/pull run in `docker/scripts/deploy-droplet.sh`. |
| Migrate fails | Postgres up? `DATABASE_URL` in `.env`. Satellites without an init migration need `prisma/baseline.sql` (rebuild image) or host `migrate-all.sh` baseline via `npx prisma migrate diff`. |
| OOM on pull | Droplet RAM, prune images, deploy fewer services temporarily |
| TLS fails | Port 80 reachable for ACME, DNS propagated |
| Deploy SSH timeout | `dial tcp :22: i/o timeout` — open UFW/DO firewall port 22; verify `SSH_HOST` secret; optional `SSH_PORT` secret |
| Auto-deploy never fires | `workflow_run` only works from the **default branch** workflow file — ensure `deploy-staging.yml` is on `master` |

See [CI_CD.md](./CI_CD.md) for workflow matrix and branch policy.
