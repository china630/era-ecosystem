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
- Same `globalPersonId` on multiple `Guest` rows (data quality — should be one guest row per person per deployment)

**Merge workflow (guest dedup screen):**

1. Open `/reports/guest-dedup`. Each group is a set of cards (name, phone, birth date, gender, citizenship, passport, FIN, stay count, in-house, registry linked). Nothing is typed.
2. **Keep this card** folds the other cards into that one. Filled fields on the survivor win; blank fields copy from the duplicate. Reservations, party rows and CRM children move, then the duplicate card is deleted. Checked-out history is re-pointed, not renamed by the open-stay name rule.
3. If two cards are linked to different registry people, a second button **Merge these people** confirms that registry merge. There is no FIN field.
4. **Not the same people** records the pair and hides the group. Shared phones are never auto-merged.
5. Re-open the screen until `suspectedDuplicateGroups` is acceptable for go-live.

**Pre-migration (W4 cutover):**

```bash
npx tsx prisma/scripts/backfill-global-person-id.ts
npx tsx prisma/scripts/report-guests-without-mdm-link.ts   # blockers CSV
npx tsx prisma/scripts/strip-guest-identity-columns.ts     # post-migration verify
```

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
