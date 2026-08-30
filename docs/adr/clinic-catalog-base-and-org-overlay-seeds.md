# ADR: Clinic catalog base seed + org overlay (Nafta)

**Status:** Accepted — 2026-08-30  
**Apps:** `era-clinic`  
**Related:** [clinic-physio-site-catalog.md](./clinic-physio-site-catalog.md) · [clinic-diagnostic-catalog-db.md](./clinic-diagnostic-catalog-db.md) · [deployment-topology.md](./deployment-topology.md)

## Context

Physio S (~31 CIS spa zones) and the bulk of the diagnostic/lab catalog are **product-universal**. Nafta cutover layered WO aliases, `PKG-NAFTA-INTAKE`, and Nafta USG form fields into the same seed files under `seed-data/nafta/`, which conflated satellite bootstrap with one org’s overlay.

Clinic runs on SHARED topology: catalogs remain **org-scoped rows** (`organizationId`) so SatAdmin CRUD / retire / aliases stay per tenant. “Satellite seed” means the **bootstrap script and JSON layer**, not unscoped tables.

## Decision

1. **Base layer (satellite bootstrap)** — `prisma/seed-data/base/`  
   - Physio: 31 S codes + titles/anatomy/coarse; **no** WO `woAliases`. List item codes with empty aliases.  
   - Diagnostic: modalities / panels / packages **except** Nafta-only packages; USG titles/fields without WO `sourceNote` and without Nafta-branded ABD title.

2. **Org overlay (Nafta)** — `prisma/seed-data/nafta/`  
   - Physio: `physio-zones-overlay.json` (aliases + matcher extras: `orderFieldsNotZones`, `matchRules`, `compositeMaps`, …); list-item WO aliases.  
   - Diagnostic: `diagnostic-overlay.json` — `PKG-NAFTA-INTAKE`, USG title/field patches (`sourceNote`, Nafta ABD label).

3. **Seed commands (org A — copy universal into the org, then overlay)**  
   - `db:seed:physio:base` → `db:seed:physio:nafta` (wrapper `db:seed:physio` runs both).  
   - `db:seed:diagnostic-catalog:base` → `:nafta` (wrapper `db:seed:diagnostic-catalog` runs both).  
   - Target org: `ERA_SATELLITE_ORGANIZATION_ID` / `ORGANIZATION_ID` / `demo-org`.

4. **Matcher** loads **merged** catalog (base zones + Nafta overlay). Coverage CLI / golden tests use the same merge helper so aliases are not duplicated by hand in a third file.

5. **Out of scope:** moving PhysioSite / DiagnosticService to satellite-global tables (no `organizationId`). ICD-10 remains the only intentional global clinical reference in clinic DB.

## Consequences

- A second org on the same SHARED clinic DB gets base without Nafta WO noise unless its overlay is applied.  
- Droplet ops: base then Nafta overlay (or the wrappers), then re-Apply `#23` / `#31` as before.  
- SatAdmin can still edit either layer’s rows after seed; JSON is bootstrap only.
