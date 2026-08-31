# era-clinic — code architecture

ADR: [clinic-product-lines-and-presets.md](../../docs/adr/clinic-product-lines-and-presets.md)

## Layers

```text
app/                    # Next.js routes, pages (thin HTTP)
src/
  domain/               # Business logic — no React, no next/headers
  infra/                # Prisma client, env, external HTTP clients
  lib/                  # Legacy path — migrate to domain/ + infra/
  components/           # UI
  hooks/
```

**Rule:** API route handlers validate input, call `domain/*`, map to JSON. No Prisma in page components.

## Domain modules (target layout)

| Folder | Owns |
|--------|------|
| `domain/patient/` | Registry, MDM resolve, `PatientRef` |
| `domain/master-data/` | Practitioners, rooms, resources, procedure types |
| `domain/appointment/` | Day matrix, shift rotation (CLI-36), create/reschedule conflict |
| `domain/visit/` | Appointments, check-in, visit lines, complete |
| `domain/lab/` | Lab order lifecycle |
| `domain/inpatient/` | Ward, bed, assignment, ADT-light (Phase 4) |
| `domain/sanatorium/` | Episodes, program, chart, planner. Time layers: [clinic-scheduling-time-layers.md](../../docs/adr/clinic-scheduling-time-layers.md) |
| `domain/catalog/` | Service cache sync |
| `domain/billing/` | Event dispatch, origin routing |

## Presets

Read `Outlet.preset` / tenant config in domain services to guard features:

- `outpatient` — default
- `sanatorium_clinical` — sanatorium domain
- `inpatient_day` — inpatient domain
- `wellness` — scheduling + resources only

Nav gating: `ClinicOpsShell` + middleware cookie `era_clinic_presets` (Phase 1).

## Domain migration checklist

| Slice | Status | Notes |
|-------|--------|-------|
| `domain/master-data/` | Done | Re-export from `@/lib/services/clinic-master-data.service` |
| `domain/patient/` | Done | Mandatory MDM on create/update |
| `domain/settings/` | Done | `enabledPresets`, tenant defaults |
| `domain/presets/` | Done | Constants + cookie helpers |
| `domain/inpatient/` | Done | Ward CRUD, ADT-light admit/transfer/discharge |
| `domain/visit/` | Done | Visit cancel (K-15) |
| `domain/appointment/` | Done | Calendar matrix + practitioner schedule (CLI-36); conflict helper still in `lib/scheduling.service.ts` |
| `domain/sanatorium/` | In progress | `episode-gates.ts`, `episode-stamp.ts`, `episode-resolve.ts`; service still in `lib/services/sanatorium.service.ts`. Canon: [clinic-episode-as-clinical-course.md](../../docs/adr/clinic-episode-as-clinical-course.md) (CLI-55 SCREEN) |
| `domain/billing/` | Planned | Move from `lib/billing-router.ts` |
| `infra/prisma.ts` | Planned | Thin re-export of `@/lib/prisma` |

**Exit criteria (P0):** `npm run build` green; master-data unit tests import `@/domain/master-data`.

## Shared packages

| Package | Role |
|---------|------|
| `@era/contracts` | Event types |
| `@era/satellite-kit` | SSO, MDM client, UI shell, middleware |
| `@era/fiscal` | Cashier mock / NBC (future) |
| `packages/clinic-domain` | **Future** — extract when inpatient ADT API stable |

## Finance boundary

Satellite emits events; no GL. See [clone-spec/01-finance-boundary.md](./clone-spec/01-finance-boundary.md).
