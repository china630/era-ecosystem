# ADR: Clinic WHO ICD-10 catalog and diagnosis recording

## Status

Accepted — 2026-08-18

Related: [clinic-product-lines-and-presets.md](./clinic-product-lines-and-presets.md) · [orchestrator-platform-integration-gateway.md](./orchestrator-platform-integration-gateway.md) · [clinic-print-forms.md](./clinic-print-forms.md) · [managed-lists-vs-enums.md](./managed-lists-vs-enums.md)

## Context

Sanatorium checkup, outpatient visits, and inpatient admissions must record diagnoses against a real classification, not free-text. Nafta and other AZ sites use **WHO ICD-10** (Russian/Azerbaijani titles in daily work). ICD-10-CM (US billing) and ICD-11 are a different product and must not be mixed into this catalog.

A 14k-row title list is not tenant master data: SatAdmin must not CRUD WHO wording. Doctors need search, chapter filter, optional clinical note, and a short favorites pin-list. Historical rows must keep titles after a code is retired.

## Decision

1. **Classification** — WHO ICD-10 **2019** only. Not ICD-10-CM, not ICD-11. Generator: `packages/satellite-kit/icd10/generate-icd10.cjs` (`WHO-ICD-10-2019`).
2. **Global catalog** — `IcdCode` has **no** `organizationId`. One shared table per clinic database. Selectable kinds: **CATEGORY** and **LEAF** only. CHAPTER and BLOCK are navigation, not recordable diagnoses.
3. **Optional note** — `ClinicalDiagnosis` / `VisitDiagnosis` / `AdmissionDiagnosis` may store a free-text note (not a substitute for the code).
4. **SatAdmin** — no create/edit of the 14k WHO titles. Allowed: tenant **favorites** (`Tenant.icdFavoriteCodes`), **sync** from file or platform gateway, **retire** (`active=false` + `retiredAt`). Historical FKs keep the catalog row.
5. **Recording surfaces**
   - Sanatorium episode: `ClinicalDiagnosis` via `POST /api/sanatorium/episodes/[id]?action=diagnosis` (`IcdPicker` = `CatalogField` SEARCHABLE).
   - Patient card (open episode): same `ClinicalDiagnosis` via `GET/POST/DELETE /api/patients/[id]/diagnoses`.
   - Visit: `VisitDiagnosis` (`PRIMARY` / `SECONDARY`) on `/visits/[id]`.
   - Inpatient: `AdmissionDiagnosis` (`ADMISSION` / `DISCHARGE` + role) on `/inpatient`.
   - Print checkup includes episode diagnoses.
6. **Platform gateway (not data-hub)** — Orchestrator `GET /platform/v1/catalog/icd10` is served **in-process** from the shared generator. Clinic may sync via `@era/satellite-kit` `platformIcd10Search` / `platformCatalogGet`. Search at runtime is local `GET /api/icd` (not `/api/icd10`).
7. **Report** — `/reports/diagnoses` aggregates episode / visit / admission usage.

### Waves

| Wave | Scope |
|------|--------|
| **W0** | Generator + `IcdCode` schema (global, no org column) |
| **W1** | `GET /api/icd` search + sanatorium picker (CLI-39) |
| **W2** | Visit + inpatient + print checkup + admin favorites (CLI-40) |
| **W3** | Orchestrator ICD-10 gateway + clinic sync (CLI-41) |
| **W4** | Diagnosis report (CLI-42) |

## Explicitly out of scope

- DRG / case-mix grouping and payer grouping rules.
- ICD-10-CM, ICD-11, or country-specific billing subsets as a second catalog.
- SatAdmin title authoring or per-org forks of WHO text.
- Data-hub as ICD SoR (calendar/FX/VÖEN stay on hub; ICD does not).

## Consequences

- Seed/load: `node prisma/load-icd10.cjs` (or SatAdmin sync). Favorites sort to the top of empty search.
- `requireSelectableIcd` rejects missing, inactive, and non-selectable (CHAPTER/BLOCK) ids.
- Product edition stays `mvp` (`docs/editions/clinic.yaml` `pilot_ready: false`) until field UAT; this ADR does not claim GA.
