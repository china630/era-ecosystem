# ERA Ecosystem — Development Roadmap

Living index for implementation sprints. **Do not duplicate checkboxes here** — use per-app DELIVERY files.

| Sprint | Focus | Status |
|--------|-------|--------|
| **S1** | Control plane RBAC, SSO claims, `BUSINESS_OWNER` | **Done** — see [DELIVERY-ORCHESTRATOR](../era-365-orchestrator/doc/DELIVERY-ORCHESTRATOR.md) CP1 |
| **S2** | Finance Contract Management §4.15 | **Done (PARTIAL)** — `/api/contracts` |
| **S3** | Finance Gov Budget §4.16 | **Done (PARTIAL)** — `/api/gov-budget` |
| **S4** | Retail R1 + CRM C1 | **Done** — DELIVERY R1/C1 |
| **S5** | Logistics L1 + Clinic K1 | **Done** — DELIVERY L1/K1 |
| **S6** | FB-1 + construction/auto/wholesale C1 | **Done (API)** — DELIVERY updated |
| **S7** | Clinic K2 lab + platform events | **Done** — lab event + contracts |
| **S8** | GTM, CI smoke | **Done** — `.github/workflows/ecosystem-smoke.yml` |

## Standards

- [SATELLITE_DOCUMENTATION.md](./SATELLITE_DOCUMENTATION.md) — layout, RBAC, index
- [INTEGRATION_SSO_EVENTS.md](./INTEGRATION_SSO_EVENTS.md) — JWT + event bus
- [SETUP_AND_RUN.md](./SETUP_AND_RUN.md) — local run

## Definition of Done

1. Code + migrations + happy-path test
2. DELIVERY checkboxes updated
3. PRD §4 module status + §8 changelog
4. TZ API/Prisma sync
5. UAT-SMOKE steps documented
6. `SMOKE_ALL_SERVICES.md` section if service touched

## Satellite index

See [SATELLITE_DOCUMENTATION.md § Satellite index](./SATELLITE_DOCUMENTATION.md).
