# ADR: Orchestrator platform integration gateway (industry sync reads)

**Status:** Accepted (target architecture — implementation Wave 2)  
**Date:** 2026-06-16  
**Supersedes (partially):** industry consumption rows in [reference-data-ecosystem.md](./reference-data-ecosystem.md), [fx-rates-ecosystem.md](./fx-rates-ecosystem.md), [production-calendar-ecosystem.md](./production-calendar-ecosystem.md)

## Context

Industry satellites (hotel, clinic, logistics, …) need **read-only global catalogs**: production calendar, FX display convert, VÖEN company directory. Prior ADRs routed industry through **Finance HTTP handoffs** (`financeFxPreview`, `financeVoenLookup`) or allowed **direct data-hub** calls via `satellite-kit` `calendar.client.ts`.

Problems:

1. **Nafta / 1C-only** deployments may run clinic or hotel **without** `era-finance-core` — Finance handoffs fail.
2. **Direct hub** from industry bypasses orchestrator entitlements and contradicts control-plane boundary ([CONTROL_PLANE_ARCHITECTURE.md](../CONTROL_PLANE_ARCHITECTURE.md)).
3. Mixed patterns (hub calendar + Finance FX) produce `DATA_HUB_MIXED` audit findings.

## Decision

### Boundary rule

| Actor | May call directly | Must not call for global catalogs |
|-------|-------------------|-----------------------------------|
| **Industry satellite** | `era-orchestrator` Platform Gateway + MDM internal + event bus | `era-data-hub`, `era-finance-core` (sync catalog reads) |
| **era-finance-core** | `era-data-hub` (accounting SoR consumer) | — |
| **era-bank-core** | `era-data-hub` + on-prem snapshot | — |
| **era-orchestrator** | `era-data-hub` (proxy backend) | — |
| **packages/satellite-kit** | Orchestrator gateway URLs only for **industry** code paths | `ERA_DATA_HUB_URL` / `/registry/v1/*` from industry-facing exports |

**Async accounting** (invoice payment, GL dispatch, payroll posting) stays on the **event bus** → Finance or future 1C adapter — **not** this gateway.

### Platform Gateway routes (sync reads)

Base path: `GET /platform/v1/catalog/*` on `era-orchestrator`.

| Concern | Gateway route | Orchestrator proxies to |
|---------|---------------|-------------------------|
| Calendar day / days / add-business-days | `/platform/v1/catalog/calendar/...` | data-hub `/registry/v1/calendar/...` |
| FX convert (display) | `/platform/v1/catalog/fx/convert` | data-hub `/registry/v1/fx/convert` |
| VÖEN company directory | `/platform/v1/catalog/companies/:voen` | data-hub `/registry/v1/companies/:voen` |
| ICD-10 (WHO 2019) | `/platform/v1/catalog/icd10` | **In-process** shared generator (`packages/satellite-kit/icd10`); **not** a data-hub proxy |

**Auth:** Bearer `SATELLITE_EVENT_SERVICE_TOKEN` (or control-plane service token) + organization context (`X-Organization-Id` or deployment `ERA_SATELLITE_ORGANIZATION_ID`).

**Entitlement:** `platform_reference_data` module (skippable locally via `REFERENCE_DATA_SKIP_ENTITLEMENT=1`).

### satellite-kit

- New: `platform-catalog.client.ts` — orchestrator-only HTTP.
- `calendar.client.ts`, `financeFxPreview`, `financeVoenLookup` **delegate** to platform catalog for industry apps (backward-compatible function names; **no** Finance URL / hub URL in industry env).
- HS tariff preview, tenant counterparty CRUD, MDM — **out of scope** (Finance or MDM internal routes).

### Finance industry handoffs (deprecated for satellites)

`era-finance-core` `IndustryHandoffsService` fx/voen routes remain for **finance-core UI** one release; industry satellites **must not** depend on them after Wave 2.

### Env vars (industry deployments)

**Remove:** `ERA_DATA_HUB_*`, `DATA_HUB_SERVICE_TOKEN`, `ERA_FINANCE_API_*` used only for catalog handoffs.

**Keep:** `ORCHESTRATOR_URL` / `CONTROL_PLANE_URL`, `SATELLITE_EVENT_SERVICE_TOKEN`, `ERA_SATELLITE_ORGANIZATION_ID`.

Document ports in [ECOSYSTEM_URLS.md](../ECOSYSTEM_URLS.md).

## Implementation status

| Item | Wave | Status |
|------|------|--------|
| ADR + amend sibling ADRs | W2-01 | **This document** |
| `CatalogGatewayModule` in orchestrator | W2-01 | Planned |
| satellite-kit platform client | W2-02 | Planned |
| 7 industry app BFF migration | W2-03 | Planned |
| CI audit strict (no hub in industry) | W5 | Planned |

Until Wave 2 lands, legacy hub-via-kit paths are **known drift** — see [DATA_MODEL_INTEGRATION_AUDIT.md](../DATA_MODEL_INTEGRATION_AUDIT.md) finding X-04.

## Consequences

**Positive**

- Single integration face for industry: orchestrator (catalog + MDM + events).
- 1C-only / sanatorium-autonomous stacks work without Finance container for display catalogs.
- Entitlement and metering at control plane.

**Negative**

- Orchestrator availability required for calendar/FX/VÖEN UI (mitigate: Sat/Sun calendar fallback, FX badge `—` on failure, gateway cache).

## Related

- [reference-data-ecosystem.md](./reference-data-ecosystem.md)
- [DATA_MODEL_INTEGRATION_AUDIT.md](../DATA_MODEL_INTEGRATION_AUDIT.md)
- Wave plan: `.cursor/plans/w2_platform_gateway_37f039ce.plan.md`
