# CRM v3.0 — gap audit (baseline 2026-07-02)

Baseline before v3.0 implementation. All gaps below are closed in the same delivery cycle.

## Datamodel (`prisma/schema.prisma`)

| Gap | v3.0 fix |
|-----|----------|
| No `partyKind` (INDIVIDUAL / LEGAL_ENTITY) | `enum PartyKind` + `Lead.partyKind` |
| No persisted `taxId` / `companyName` | `Lead.taxId`, `Lead.companyName` |
| No `contactPhone` / `contactEmail` | Added on `Lead` |
| No `globalPersonId` (MDM ref) | Added; no plaintext FIN |
| No `activitySector` | From import `donor_sectors` |
| No `prospectType` (CUSTOMER / PARTNER) | `enum ProspectType` |
| No `addressLabel`, `sourceRef`, `importBatchId` | Added |
| No `ImportBatch` model | Added |
| Missing indexes on `taxId`, `prospectType` | Added |

## API routes (20 existing)

| Route | Gap | v3.0 fix |
|-------|-----|----------|
| `POST /api/leads` | No party fields | Extended create schema |
| — | No `GET/PATCH /api/leads/:id` | New routes |
| `PATCH .../stage` | No stage gates | Party validation on QUALIFIED+ |
| `POST .../convert` | Event lacks party payload | Extended dispatch |
| — | No FIN lookup | `POST /api/mdm/person-lookup` |
| — | No import | `POST /api/leads/import`, `GET .../import/:batchId` |
| `VoenLookupField` on `/leads` | UI-only, not persisted | Wired to create form |

All other routes: zod + `handleRouteError` + middleware auth — OK.

## UI pages (8 existing)

| Page | Gap | v3.0 fix |
|------|-----|----------|
| `/leads` | No create-lead form | Create modal |
| `/leads` | VÖEN not saved | Persist on create |
| `/leads` | No partner filter | `prospectType` filter |
| — | No `/leads/[id]` | Lead card page |
| — | No `/admin/import` | Import upload + report |
| Nav | Missing import link | `CrmOpsShell` |

## Cross-app

| System | Gap | v3.0 fix |
|--------|-----|----------|
| `@era/contracts` | Slim convert payload | Extended optional fields |
| Finance `handleCrmLead` | No auto-CP | `findOrCreateByVoen` / individual |
| COVERAGE_MATRIX | CRM-PARTY/IMPORT planned | SHIPPED on delivery |
