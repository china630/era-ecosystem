# Deploy ERA Ecosystem on DigitalOcean (pull-only)

Production deploy uses **GHCR pre-built images** — no `docker compose build` on the server.

## 1. Droplet

- Ubuntu 24.04, **8 GB RAM** / 4 vCPU recommended (13 app images + Postgres + Redis)
- Reset/reinstall droplet if replacing legacy site
- UFW: `22`, `80`, `443`

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
docker compose -f docker-compose.prod.yml pull
chmod +x docker/scripts/migrate-all.sh
COMPOSE_FILE=docker-compose.prod.yml ./docker/scripts/migrate-all.sh
docker compose -f docker-compose.prod.yml up -d
node scripts/ecosystem-smoke-all.mjs
```

## 6. GitHub Actions deploy

Configure environment **staging** secrets, then:

1. Run **Build and push images** on `dev`
2. Run **Deploy staging** with `image_tag` = `dev-<sha>` or `dev`

Auto-deploy after build on `dev` is enabled via `workflow_run` (optional; disable if you prefer manual only).

## 7. Operations

| Task | Command |
|------|---------|
| Logs | `docker compose -f docker-compose.prod.yml logs -f orchestrator` |
| Prune old images | `docker image prune -f` (also in deploy workflow) |
| Update stack | New `IMAGE_TAG` → `pull` → `migrate-all.sh` → `up -d` |

## Troubleshooting

| Issue | Check |
|-------|--------|
| Pull 401 | `GHCR_PULL_TOKEN`, package visibility, `GHCR_IMAGE_PREFIX` lowercase owner |
| Migrate fails | Container running? `DATABASE_URL` in `.env`, postgres healthy |
| OOM on pull | Droplet RAM, prune images, deploy fewer services temporarily |
| TLS fails | Port 80 reachable for ACME, DNS propagated |

See [CI_CD.md](./CI_CD.md) for workflow matrix and branch policy.
