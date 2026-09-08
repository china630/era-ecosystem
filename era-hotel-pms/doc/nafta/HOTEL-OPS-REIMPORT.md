# Hotel ops re-import (Nafta staging — variant A)

Full wipe of **transactional** hotel data, then Elektraweb wizard import in canon order.

**Keeps:** room types, rooms, agencies, rate plans, reference seed (revenue/bed/view), org bind, pricing components.

**Removes:** guests, reservations, folios, reservation notes, guest CRM, EW outbox rows for the org.

---

## 1. Backup (mandatory on staging)

```bash
docker exec era-postgres pg_dump -U era -d era_hotel_pms -Fc -f /tmp/era_hotel_pms_pre_reimport.dump
docker cp era-postgres:/tmp/era_hotel_pms_pre_reimport.dump ./era_hotel_pms_pre_reimport.dump
```

Nafta org: `6bb9b75f-bf90-46c6-a4f7-bd5d3464c69b`

---

## 2. Wipe transactional ops

On droplet (from repo mount or copied script):

```bash
docker exec \
  -e ERA_SKIP_TENANT_FILTER=1 \
  -e ERA_SATELLITE_ORGANIZATION_ID=6bb9b75f-bf90-46c6-a4f7-bd5d3464c69b \
  -e DATABASE_URL="postgresql://era:${POSTGRES_PASSWORD}@era-postgres:5432/era_hotel_pms" \
  era-hotel-pms npx tsx scripts/ops/wipe-hotel-ops-transactional.ts --dry-run

# then without --dry-run
```

**Verify:**

```sql
SELECT count(*) FROM "Guest";          -- expect 0
SELECT count(*) FROM "Reservation";    -- expect 0
SELECT count(*) FROM "Folio";          -- expect 0
```

---

## 3. Import (strict order)

Canon: [ELEKTRAWEB-IMPORT.md](../ELEKTRAWEB-IMPORT.md) §3.2.

| Step | Entity | File |
|------|--------|------|
| 03–05 | revenue-codes, bed-types, room-views | optional if `db:seed:reference` already run |
| 06–09 | room-types, rate-plans, rooms, agencies | master upsert |
| **10** | **guests** | **10-Guest-Cards.merged.xlsx** |
| **10b** | *(prep)* | `npx tsx scripts/enrich-reservations-guest-id.ts` — stamps **Guest Id** on `#11` from `#10` (+ optional `--api-map`) |
| **11** | **reservations** | **11-Reservations.merged.xlsx** (must include **Guest Id** column) |
| 12 | reservation-notes | 12-Reservation-Notes.xlsx |
| 13 | folios | 13-Folio-p01…p12 (multi-select) |
| 14–15 | package-sell, agency-statement | if used |

### UI (super-admin)

`/admin/import` — login as `PLATFORM_SUPER_ADMIN_EMAILS` user.

### CLI (pack directory on server)

```bash
docker exec \
  -e ERA_SKIP_TENANT_FILTER=1 \
  -e ERA_SATELLITE_ORGANIZATION_ID=6bb9b75f-bf90-46c6-a4f7-bd5d3464c69b \
  era-hotel-pms npx tsx scripts/ops/import-hotel-pack.ts /import-data/hotel
```

Resume from guests only: `--from=guests`

---

## 4. Post-import checks

```sql
-- No reservation-import guest stubs (import links by Guest Id only)
SELECT count(*) FROM "Guest" WHERE "externalRef" LIKE 'import-guest-%';  -- 0

-- Guest count ~ file rows (merged ~7723–9000, not 12k)
SELECT count(*) FROM "Guest";

-- Gender filled on EW ids
SELECT count(*) FILTER (WHERE gender IN ('M','F')) AS with_gender,
       count(*) FILTER (WHERE gender IS NULL OR btrim(gender)='') AS empty
FROM "Guest";

-- Documents for search/list
SELECT count(*) FROM "GuestDocument";
```

Optional: `npx tsx scripts/ops/pair-share-overlaps.ts --dry-run`

---

## 5. Why stubs happened before

Reservations import **requires Elektraweb Guest Id** (`Guest.externalRef`). FOCP Excel has **Guest Name only** — run `scripts/enrich-reservations-guest-id.ts` after merge (also in `merge-ew-cutover.js`). Import step 10 (Guest Cards) before step 11.
