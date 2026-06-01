# ERA 365 Orchestrator

Control plane: billing, identity, SSO, and organization tenancy limits.

- [PRD.md](./PRD.md) · [TZ.md](./TZ.md) · [doc/DELIVERY-ORCHESTRATOR.md](./doc/DELIVERY-ORCHESTRATOR.md)
- Umbrella: [docs/SETUP_AND_RUN.md](../docs/SETUP_AND_RUN.md) · [docs/LOCAL_FOLDER_DEV.md](../docs/LOCAL_FOLDER_DEV.md)
- Integration: [docs/INTEGRATION_SSO_EVENTS.md](../docs/INTEGRATION_SSO_EVENTS.md)

## Ports (umbrella / bare dev)

| Component | Port |
|-----------|------|
| Web (`apps/web`) | 3000 |
| API (`apps/api`) | **4000** |

Build shared packages before first run: `packages/era-contracts`, `packages/satellite-kit` (see LOCAL_FOLDER_DEV).

## Shell layout

| Path | Stack |
|------|--------|
| `apps/api` | NestJS |
| `apps/web` | Next.js |
| `packages/database` | Prisma (placeholder) |

```bash
npm install
npm run dev
```
