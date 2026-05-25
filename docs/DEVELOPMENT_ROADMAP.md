# ERA Ecosystem — Development Roadmap

Living index for platform-first delivery. **Per-app checkboxes** stay in DELIVERY files; this doc tracks **Phase A (platform)** gate and **Phase B (satellite depth)** progress.

## Phase A — Platform debt (complete)

Gate passed 2026-05-25. All PP1–PP7 exit criteria met; Phase B started.

| PP | Focus | Status |
|----|-------|--------|
| **PP1** | Orchestrator RBAC: access requests, transfer ownership, disputes | **Done** — [DELIVERY-ORCHESTRATOR CP1](../era-365-orchestrator/doc/DELIVERY-ORCHESTRATOR.md); Finance proxies via `ERA_CONTROL_PLANE_RBAC_PROXY` |
| **PP2** | Unified SSO + `BUSINESS_OWNER` on 7 industry apps | **Done** — `@era/satellite-kit` `executeSatelliteSsoExchange` |
| **PP3** | Finance `ERA_AUTH_MODE=control-plane` dev cutover | **Done** — documented in [SETUP_AND_RUN](./SETUP_AND_RUN.md) |
| **PP4** | Event bus: all 11 `@era/contracts` types → Finance worker | **Done** — incl. `SHIFT_CLOSED`, `VISIT_LOGGED`, full lab handler |
| **PP5** | Contract Management §4.15 | **Done** — `contract_management_pro`, `/contracts`, PO `checkLimit` |
| **PP6** | Gov Budget §4.16 | **Done** — `gov_budget_pro`, gateway, BUDGET demo org, `/gov-budget` |
| **PP7** | Ops, CI, umbrella docs | **Done** — migration `20260525180000_contracts_gov_budget`, [SMOKE_ALL_SERVICES](./SMOKE_ALL_SERVICES.md) |

### Phase A gate checklist

- [x] Orchestrator CP1: access request, transfer ownership, dispute APIs
- [x] All 7 industry satellites: SSO with `BUSINESS_OWNER` mapping (`executeSatelliteSsoExchange`)
- [x] Finance `ERA_AUTH_MODE=control-plane` verified in dev smoke
- [x] All 11 event types in `@era/contracts` → Finance worker handler (no stubs)
- [x] Contracts: entitlement + UI + PO limit block
- [x] Gov Budget: entitlement + gateway + BUDGET seed + execution report UI
- [x] `SMOKE_ALL_SERVICES.md` covers platform + vertical E2E samples
- [x] Umbrella docs synced (this file, INTEGRATION, SETUP, SATELLITE_DOCUMENTATION, README)

## Phase B — Satellite refinement (in progress)

**Satellite Wave 1** (orchestrator: `.cursor/plans/satellite_wave1_orchestrator.plan.md`): retail R2/R3 → CRM C2 → clinic K2/K3 → logistics L2 — **complete** 2026-05-25.

**Satellite Wave 2** (orchestrator: `.cursor/plans/satellite_wave2_orchestrator.plan.md`): fb-pos FB-0 + hotel regression → construction/auto/wholesale UI — **complete** 2026-05-25.

Priority by value and DELIVERY readiness. Do not start new platform debt here — file issues for CP2 (RS256/JWKS, `permissions[]`).

| SP | Focus | Status |
|----|-------|--------|
| **SP1** | Retail R2/R3 + CRM C2 | **Done (Wave 1)** — preset checkout, void/return/shift-close; visits, assign, inbox stub |
| **SP2** | Logistics L2 + Clinic K2/K3 | **Done (Wave 1)** — POD/fuel UI; lab lifecycle, discount audit, executive |
| **SP3** | F&B FB-1 + Hotel Stage 17 | **Done (Wave 2)** — FB-0 auth/menu, UI wired, bridge regression |
| **SP4** | Construction C2, Auto A2, Wholesale W2 | **Done (Wave 2)** — plan-vs-actual UI, appointments UI, pick lists + Finance credit fallback |
| **SP5** | UAT-SMOKE pass, PRD/TZ sync | **Pending** |

### Legacy sprint index (S1–S8 scaffold)

| Sprint | Focus | Status |
|--------|-------|--------|
| **S1** | Control plane RBAC, SSO claims, `BUSINESS_OWNER` | **Done** — superseded by PP1–PP2 |
| **S2** | Finance Contract Management §4.15 | **Done** — superseded by PP5 |
| **S3** | Finance Gov Budget §4.16 | **Done** — superseded by PP6 |
| **S4** | Retail R1 + CRM C1 | **Done** |
| **S5** | Logistics L1 + Clinic K1 | **Done** |
| **S6** | FB-1 + construction/auto/wholesale C1 | **Done (API)** |
| **S7** | Clinic K2 lab + platform events | **Done** |
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
