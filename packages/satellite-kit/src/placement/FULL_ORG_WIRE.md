# Wire full-org placement slice (any satellite)

Product path for SHARED → DEDICATED org migrate: **OrgFullSliceV2** (`formatVersion: 2`).

## Steps

1. Add `src/lib/placement-slice.service.ts` mirroring hotel/clinic:
   - `buildDelegatesFromPrismaClient(Prisma, prisma)`
   - `exportFullOrgSlice` / `importFullOrgSlice`
   - object-storage `copyObjectStorage` fail-closed when `entries.length > 0` and copy not configured
2. Routes (service token):
   - `POST /api/internal/v1/placement/export-slice`
   - `POST /api/internal/v1/placement/import-slice`
   - optional `preflight` (migration-hash + disk)
3. Register satellite key in orch `isSliceSupportedSatelliteKey` (hotel + clinic today).
4. Until wired, orch **fail-closes** export with `slice not implemented for <key>`.

## Invariants

- Dump only rows with `organizationId` (DMMF scalar).
- No MDM / billing / entitlements / holdings.
- No pool secrets in the slice.
- Checksum on import; object-storage manifest stub until blob copy lands.
