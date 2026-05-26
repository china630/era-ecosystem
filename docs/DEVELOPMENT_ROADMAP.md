# ERA Ecosystem — Development Roadmap

Living index for platform-first delivery. **Per-app checkboxes** stay in DELIVERY files; this doc tracks **platform gate** (done) and **product versions** ([PRODUCT_VERSIONING.md](./PRODUCT_VERSIONING.md)).

## v1.0 — Current release (shipped)

### Platform

Gate passed 2026-05-25. Control plane, SSO on industry satellites, Finance event worker (13 ingress types), contracts, gov budget, billing on orchestrator.

| Area | Status | Doc |
|------|--------|-----|
| Orchestrator RBAC (access, transfer, disputes) | **Done** | [DELIVERY-ORCHESTRATOR](../era-365-orchestrator/doc/DELIVERY-ORCHESTRATOR.md) |
| Unified SSO + `BUSINESS_OWNER` | **Done** | [INTEGRATION_SSO_EVENTS](./INTEGRATION_SSO_EVENTS.md) |
| Finance control-plane auth | **Done** | [SETUP_AND_RUN](./SETUP_AND_RUN.md) |
| Contract Management §4.15 | **Done** | Finance `/contracts` |
| Gov Budget §4.16 | **Done** | Finance `/gov-budget` |
| CP-BILLING + platform add-ons MVP API | **Done** | [PLATFORM_ADDONS](./PLATFORM_ADDONS.md) · [CP-BILLING-MIGRATION](./CP-BILLING-MIGRATION.md) |
| Posting role profiles (COMMERCIAL/BUDGET/NGO) | **Done** | [ADR posting-role-profiles](./adr/posting-role-profiles.md) |

### Industry satellites (operations + modules)

Core MVP per app DELIVERY (checkout, trips, clinic lab, hotel PMS, FB POS, wholesale B2B, construction acts, etc.) plus **industry modules in v1.0** — see [MODULES_CATALOG § Shipped v1.0](./MODULES_CATALOG.md#shipped-in-v10).

Hospitality Nafta package (sanatorium, banquets, GL bridge, invoice center, contract pricing) — **Done** · [era-hotel-pms/doc/nafta/](../era-hotel-pms/doc/nafta/).

---

## v1.1 — Next (planned)

**Scope:** [MODULES_CATALOG § Planned v1.1](./MODULES_CATALOG.md#planned-v11) — retail M14–M16, clinic M10–M13, logistics tariffs/COD, CRM automation, construction/auto/wholesale/fb extensions.

**Tracking:** `## Planned — v1.1` sections in each `era-*/doc/DELIVERY*.md` and `PRD.md` §4 statuses `PLANNED (v1.1)`.

---

## v2.0 — Later (planned)

**Scope:** [MODULES_CATALOG § Planned v2.0](./MODULES_CATALOG.md#planned-v20) — fiscal/offline/marketplace retail, platform add-ons **Live**, heavy integrations (EDI, TecDoc, tool crib, …).

---

## Standards

- [PRODUCT_VERSIONING.md](./PRODUCT_VERSIONING.md) — naming rules
- [SATELLITE_DOCUMENTATION.md](./SATELLITE_DOCUMENTATION.md) — layout, RBAC, index
- [MODULES_CATALOG.md](./MODULES_CATALOG.md) — module IDs per app
- [READINESS_MATRIX.md](./READINESS_MATRIX.md) — DELIVERY % and API × app
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
