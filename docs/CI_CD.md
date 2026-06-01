# ERA Ecosystem — CI/CD

Git flow, GitHub Actions, GHCR images, and pull-only deploy to DigitalOcean.

## Git flow

| Branch | Purpose |
|--------|---------|
| `master` | Production-ready; deploy prod via manual workflow |
| `dev` | Integration; GHCR tags `dev`, `dev-<sha>`; staging deploy |
| `feature/*` | Short-lived work; PR → `dev` |

**Solo-dev guardrails:** enable branch protection on `master` and `dev` (require PR, no direct push, required checks after first green CI).

```bash
git checkout dev && git pull
git checkout -b feature/my-change
# ... commit ...
git push -u origin feature/my-change
# PR → dev → after CI green, merge
# PR dev → master for release
```

## Workflows

| Workflow | Trigger | Role |
|----------|---------|------|
| [`ci.yml`](../.github/workflows/ci.yml) | PR/push `dev`, `master` | Packages build, orchestrator/finance tests, satellite build+jest |
| [`build-images.yml`](../.github/workflows/build-images.yml) | Push `dev`/`master`, manual | Matrix build 13 app images → GHCR |
| [`nightly-smoke.yml`](../.github/workflows/nightly-smoke.yml) | Cron 02:00 UTC, manual | `docker-compose.prod.yml` pull + migrate + health |
| [`deploy-staging.yml`](../.github/workflows/deploy-staging.yml) | After build on `dev`, manual | SSH pull-only on droplet |
| [`deploy-production.yml`](../.github/workflows/deploy-production.yml) | Manual only | Prod deploy + environment approval |

Deprecated: [`ecosystem-smoke.yml`](../.github/workflows/ecosystem-smoke.yml) (noop). Finance-only CI moved from `era-finance-core/.github/workflows/ci.yml` to root `ci.yml`.

## GHCR images

- Registry: `ghcr.io/<github-owner>/era-ecosystem/<service>:<tag>`
- Tags: `dev`, `dev-<short-sha>`, `master`, `master-<short-sha>` (moving branch tags + immutable sha)
- Workspace packages image: `.../workspace-packages:dev-<sha>` (satellite Docker builds)

**Never run `docker compose build` on the droplet** — only `pull` + `up`.

## Local vs prod compose

| File | Use |
|------|-----|
| [`docker-compose.yml`](../docker-compose.yml) | Dev: `docker compose up --build` |
| [`docker-compose.prod.yml`](../docker-compose.prod.yml) | Staging/prod/CI: pre-built images only |

Env templates: [`.env.production.example`](../.env.production.example), [`.env.ci.example`](../.env.ci.example).

Required for prod compose:

```env
GHCR_IMAGE_PREFIX=ghcr.io/your-owner/era-ecosystem
IMAGE_TAG=dev-abc1234
```

## Adding tests (satellites)

1. Copy patterns from [`tools/satellite-test-scaffold/`](../tools/satellite-test-scaffold/).
2. Add `jest.config.cjs`, `__tests__/api-health.spec.ts`, `"test": "jest --ci"` in `package.json`.
3. New API module → add at least one spec in the same PR.
4. Catalog reference: [`MODULES_CATALOG.md`](./MODULES_CATALOG.md).

## Smoke scripts

```bash
node scripts/quartet-smoke.mjs          # Orch + Finance + Hotel + F&B
node scripts/ecosystem-smoke-all.mjs    # Full stack (ports per ECOSYSTEM_URLS)
```

## GitHub secrets (staging / production)

| Secret | Purpose |
|--------|---------|
| `SSH_HOST` | Droplet IP/hostname |
| `SSH_USER` | e.g. `deploy` |
| `SSH_PRIVATE_KEY` | Deploy key |
| `ENV_FILE` | Full production `.env` body |
| `GHCR_PULL_TOKEN` | PAT with `read:packages` for droplet `docker login` |

## Related docs

- [DEPLOY_DIGITALOCEAN.md](./DEPLOY_DIGITALOCEAN.md) — droplet bootstrap
- [SMOKE_ALL_SERVICES.md](./SMOKE_ALL_SERVICES.md) — manual UAT
- [ECOSYSTEM_URLS.md](./ECOSYSTEM_URLS.md) — ports and hosts
- [era-finance-core/docs/deploy/PRE-RELEASE-CHECKLIST.md](../era-finance-core/docs/deploy/PRE-RELEASE-CHECKLIST.md)
