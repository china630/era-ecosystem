# ADR: Organization operating mode (STANDALONE / DEPARTMENT)

**Status:** Accepted (2026-06-04)  
**Context:** Hotel + clinic cycle — «свой VOEN» vs «департамент отеля» without shared operational DB.

## Decision

1. `Organization` in orchestrator stores `operatingMode`, `parentOrgId`, `fiscalRouting`, `revenueRouting`.
2. Satellites read mode from subscription snapshot (`/v1/subscription/me` → `operatingMode` block) via `@era/satellite-kit` `resolveOperatingMode`.
3. **Operational data** always uses the satellite's own `organizationId` and database. `parentOrgId` affects **money routing only** (folio, fiscal, GL events).
4. **Detach** = admin `POST …/detach`: `DEPARTMENT` → `STANDALONE`, clear parent, routing → `OWN`. No data migration.

## Consequences

- `shouldRouteRevenueToParent` / `shouldFiscalizeOnParent` gate B2C pay paths (`@era/fiscal` `fiscalizeForSatellite`, clinic `resolveBillingTarget`, retail pay).
- Historical fiscal documents issued under parent VOEN remain at parent after detach.
- Guest/patient identity anchored on `globalPersonId`, not hotel `reservationId`.

## Related

- [satellite-finance-bridge-pattern](./satellite-finance-bridge-pattern.md)
- [sanatorium-vnext](./sanatorium-vnext.md) SV7/SV14
- [cp-workforce-org-units.md](./cp-workforce-org-units.md) — commercial `Organization` DEPARTMENT ≠ HR `OrgUnit`; ops DB unchanged
- Orchestrator: `org-operating-mode.service.ts`, migration `20260604120000_org_operating_mode`
