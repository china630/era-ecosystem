# ADR: Clinic WHO ICD-10 catalog and diagnosis recording

## Status

Accepted — 2026-08-18

Related: [clinic-product-lines-and-presets.md](./clinic-product-lines-and-presets.md) · [orchestrator-platform-integration-gateway.md](./orchestrator-platform-integration-gateway.md) · [clinic-print-forms.md](./clinic-print-forms.md) · [managed-lists-vs-enums.md](./managed-lists-vs-enums.md)

## Context

Sanatorium checkup, outpatient visits, and inpatient admissions must record diagnoses against a real classification, not free-text. Nafta and other AZ sites use **WHO ICD-10** (Russian/Azerbaijani titles in daily work). ICD-10-CM (US billing) and ICD-11 are a different product and must not be mixed into this catalog.

A 12k-row title list is not tenant master data: SatAdmin must not CRUD WHO wording. Doctors need search, chapter filter, optional clinical note, and a short favorites pin-list. Historical rows must keep titles after a code is retired.

## Decision

1. **Classification** — WHO ICD-10 **2019** only. Not ICD-10-CM, not ICD-11. **Original sources only — no generated codes or titles** (amended 2026-10-13, see below). Catalog: `packages/satellite-kit/icd10/catalog.cjs` over `data/icd10-catalog.json`, version `WHO-ICD-10-2019+RU-1005-2.27+AZ-XBT10-2012`.
2. **Global catalog** — `IcdCode` has **no** `organizationId`. One shared table per clinic database. Selectable kinds: **CATEGORY** and **LEAF** only. CHAPTER and BLOCK are navigation, not recordable diagnoses.
3. **Optional note** — `ClinicalDiagnosis` / `VisitDiagnosis` / `AdmissionDiagnosis` may store a free-text note (not a substitute for the code).
4. **SatAdmin** — no create/edit of the WHO titles. Allowed: tenant **favorites** (`Tenant.icdFavoriteCodes`), **sync** from file or platform gateway, **retire** (`active=false` + `retiredAt`). Historical FKs keep the catalog row.
5. **Recording surfaces**
   - Sanatorium episode: `ClinicalDiagnosis` via `POST /api/sanatorium/episodes/[id]?action=diagnosis` (`IcdPicker` = `CatalogField` SEARCHABLE).
   - Patient card (open episode): same `ClinicalDiagnosis` via `GET/POST/DELETE /api/patients/[id]/diagnoses`.
   - **CLI-55 (canon, not shipped):** card episode switcher; ICD block is **the selected course**; CLOSED = read-only. See [clinic-episode-as-clinical-course.md](./clinic-episode-as-clinical-course.md).
   - Visit: `VisitDiagnosis` (`PRIMARY` / `SECONDARY`) on `/visits/[id]`.
   - Inpatient: `AdmissionDiagnosis` (`ADMISSION` / `DISCHARGE` + role) on `/inpatient`.
   - Print checkup includes episode diagnoses (must follow **selected** episode once CLI-55 ships).
6. **Platform gateway (not data-hub)** — Orchestrator `GET /platform/v1/catalog/icd10` is served **in-process** from the shared catalog (`selectable=0` returns all kinds). Clinic may sync via `@era/satellite-kit` `platformIcd10Search` / `platformCatalogGet`. Search at runtime is local `GET /api/icd` (not `/api/icd10`).
7. **Report** — `/reports/diagnoses` aggregates episode / visit / admission usage.

### Waves

| Wave | Scope |
|------|--------|
| **W0** | Catalog + `IcdCode` schema (global, no org column) |
| **W1** | `GET /api/icd` search + sanatorium picker (CLI-39) |
| **W2** | Visit + inpatient + print checkup + admin favorites (CLI-40) |
| **W3** | Orchestrator ICD-10 gateway + clinic sync (CLI-41) |
| **W4** | Diagnosis report (CLI-42) |

## Amendment 2026-10-13 — original sources, no synthetic rows

The first catalog came from a generator that invented `.0–.9` subdivisions with templated titles under every category (e.g. `M42.2 «Деформирующие дорсопатии, уточнённая форма 2»`), ~24k rows. It was live on the droplet. Replaced by a build from three original sources (provenance, licenses, hashes: `packages/satellite-kit/icd10/sources/SOURCES.md`):

| Layer | Source | Coverage |
|-------|--------|----------|
| Codes, hierarchy, EN titles | WHO ICD-10 2019 classification files (free download, CC BY-ND 3.0 IGO) | all 12 221 codes, 22 chapters |
| RU titles | Minzdrav RF NSI OID `1.2.643.5.1.13.13.11.1005` v2.27 | 12 217 codes (missing: B18.00/.09/.10/.19) |
| AZ titles | XBT-10 (2012 AZ edition of WHO 1992), extracted from the printed volumes I–II | 12 082 codes, 20 of 22 chapters |

Rules:

- **Codes come only from WHO 2019.** A code not in that file is never created.
- **Titles come only from the matching source.** A missing translation is stored as `NULL` (`title_ru` nullable since migration `20261013090000_icd_title_ru_nullable`); display falls back ru → az → en (`icdTitle`). Codes added by WHO after 1992 (U07–U85, A97, I48.0–I48.4, K64, …) have no AZ title.
- AZ 4th-character shared subdivision tables are composed `Category: Subdivision`, the same convention as WHO.
- `data/icd10-catalog.json` is built by `node packages/satellite-kit/icd10/build-icd10-catalog.cjs` (`--check` fails when stale; `icd10-catalog.spec` asserts the same).

**Loader** (`era-clinic/prisma/load-icd10.cjs`, also used by SatAdmin Sync and the gateway sync): one transaction, upsert by `code`; codes absent from the catalog are deleted when no diagnosis references them, otherwise retired (`active=false`) and reported as `orphanDiagnoses`; tenant favorites are trimmed to catalog codes; diagnoses are never deleted. Admin retirements of real codes survive reloads. Skips when `Tenant.icd10Version` equals the catalog version (force: `ERA_ICD10_RELOAD=1` or Sync).

## Explicitly out of scope

- DRG / case-mix grouping and payer grouping rules.
- ICD-10-CM, ICD-11, or country-specific billing subsets as a second catalog.
- SatAdmin title authoring or per-org forks of WHO text.
- Data-hub as ICD SoR (calendar/FX/VÖEN stay on hub; ICD does not).

## Consequences

- Seed/load: `node prisma/load-icd10.cjs` (or SatAdmin sync). Favorites sort to the top of empty search.
- `requireSelectableIcd` rejects missing, inactive, and non-selectable (CHAPTER/BLOCK) ids.
- Product edition stays `mvp` (`docs/editions/clinic.yaml` `pilot_ready: false`) until field UAT; this ADR does not claim GA.
