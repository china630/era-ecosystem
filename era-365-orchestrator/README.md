# ERA 365 Orchestrator

Control plane submodule: billing, identity, SSO, and organization tenancy limits.

- `PRD.md` / `TZ.md` — to be authored in this repo (domain-local docs).
- Phase 3 will host extracted Prisma billing/RBAC models and control-plane APIs.

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
