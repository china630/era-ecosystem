# ADR: Clinic catalog — satellite templates + org overlay

**Status:** Accepted — 2026-09-22  
**Apps:** `era-clinic`  
**Supersedes (decision 5):** [clinic-catalog-base-and-org-overlay-seeds.md](./clinic-catalog-base-and-org-overlay-seeds.md) §5 (unscoped PhysioSite / DiagnosticService was out of scope; that restriction is lifted here). JSON base vs Nafta overlay paths remain.  
**Related:** [clinic-physio-site-catalog.md](./clinic-physio-site-catalog.md) · [clinic-diagnostic-catalog-db.md](./clinic-diagnostic-catalog-db.md) · [deployment-topology.md](./deployment-topology.md) · [satellite-organization-bind.md](./satellite-organization-bind.md)

## Context

Clinic SHARED pool needs one satellite ICD / base physio / base diagnostic catalog and per-org customization (aliases, retire, extra panels, Nafta packages, prices). Stamping every seed row with `organizationId` (or `demo-org`) either creates ghost tenants or overwrites the live org on `RUN_SEED=true`. JSON files are bootstrap into satellite tables only — never Connect payload, never login.

## Decision

1. **Satellite templates (unscoped DB)** — `PhysioSiteTemplate`, `PhysioListItemTemplate`, `ModalityTemplate`, `DiagnosticServiceTemplate` (+ analytes on the service template). Seeded once by `npm run db:seed` (ICD + base physio + base diagnostic). No `organizationId`, no `demo-org`, no env UUID. Runtime may merge template ∪ org overlay; SatAdmin edits org rows.

2. **ICD-10** — `IcdCode` stays unscoped WHO reference. Patient / visit / admission diagnoses stay org-scoped with FK to `IcdCode`. `load-icd10` **skips** when any ICD rows exist; never `deleteMany` on diagnosis tables. Force reload only with `ERA_ICD10_RELOAD=1` and empty diagnoses (or non-production guard).

3. **Org overlay** — existing `PhysioSite` / `PhysioListItem` / `Modality` / `DiagnosticService` (+ aliases, imaging phrases, prices). Org extras, retire, WO aliases, `PKG-NAFTA-INTAKE`, commercial prices. Filled by: **Connect / bind / first login copy-if-empty** from templates; **admin import** (Nafta Excel); optional `db:seed:demo` / `:nafta` scripts (never droplet entrypoint).

4. **Connect copy-if-empty** — after organization bind and on staff login / SSO (same moment as `ensureSystemClinicRoles`), copy missing template codes into the org overlay. Do not overwrite SatAdmin edits. Org id comes from bind / SSO payload, not compose.

5. **Entrypoint** — compose `RUN_SEED: ${CLINIC_RUN_SEED:-false}` stays **false** on droplet. `db:seed` = satellite templates + ICD only. `db:seed:demo` = old kitchen sink (vnext tenant, Nafta prices, sanatorium week, intake-blocks seed script, planning-rules seed, lab-usg demo). Full `db:seed` after cutover is **forbidden**.

6. **Import wizard** — owns org overlay facts (procedures, rooms, program templates + intake block columns, planning/cabin pools, prices via Import Nafta). Must not re-import satellite ICD or wipe base S / base diagnostic families.

## Consequences

- Droplet recreate with `RUN_SEED=false` never wipes Nafta patients/prices.  
- Second SHARED org gets templates via copy-if-empty without Nafta WO noise until its overlay is imported.  
- Diagnostic catalog cache must be **per `organizationId`** (process-global cache is a SHARED bug).  
- Acceptance: Implementation-Matrix may stay 🟡 until wizard UAT; not Product-Readiness `ga`.  
- Bank/hotel/fnb `RUN_SEED` defaults and demo-org bans: [satellite-seed-hygiene.md](./satellite-seed-hygiene.md).
