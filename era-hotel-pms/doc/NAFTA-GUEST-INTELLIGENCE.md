# Nafta Guest Intelligence — runbook

Operational guide for importing ~7k guest records and linking them to MDM (`globalPersonId`).

## Import order

1. **Guests** — `Guests.xlsx` via `/admin/import` (entity: `guests`).
2. **Reservations** — after guests exist (foreign keys / guest match by phone or external ref).
3. **Backfill MDM links** — run from `era-hotel-pms`:

```bash
cd era-hotel-pms
npx tsx prisma/scripts/backfill-global-person-id.ts
```

4. **Dedup review** — open `/reports/guest-dedup` or `GET /api/admin/guest-dedup/summary`.

## Duplicate handling

Suspected duplicates are grouped by:

- Same normalized phone (+994…)
- Same FIN (`nationalIdFin`, 7 chars)

**Merge workflow (orchestrator MDM):**

1. Super-admin opens orchestrator MDM internal UI / `mergePersons` API.
2. Pick canonical `globalPersonId`; satellite guest rows update on next backfill or manual `globalPersonId` patch.
3. Re-run dedup report until `suspectedDuplicateGroups` is acceptable for go-live.

## Performance (7k rows)

- Import engine uses batched writes; default batch size is suitable for 7k guests in UAT.
- Run import off-peak; verify `/api/admin/guest-dedup/summary` counts after each wave.

## Acceptance (Nafta P2)

- [ ] ≥95% in-house guests have `globalPersonId` or passport on file
- [ ] Dedup report reviewed; top duplicate groups merged or documented
- [ ] Sample reservation links to guest with MDM id

## Related

- `prisma/scripts/backfill-global-person-id.ts`
- `docs/adr/workforce-identity-and-hr-provisioning.md` (person identity pattern)
- H-BL-07 in `doc/BACKLOG-PRODUCTION.md`
