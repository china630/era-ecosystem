# Elektraweb Excel import — operator & developer guide

> **Stage:** 26 (DELIVERY) · **ADR:** [docs/adr/hotel-elektraweb-import.md](../../docs/adr/hotel-elektraweb-import.md)  
> **App:** `era-hotel-pms` · **Route:** `/admin/import` · **Migration:** `20260612200000_elektraweb_import`

This document is the **single source of truth** for migrating a hotel from Elektraweb (Eptera) into ERA Hotel PMS. It covers purpose, access, procedure, file mapping, architecture, and how to extend the tool for the next property.

---

## 1. Purpose

| Use case | Description |
|----------|-------------|
| **Nafta bootstrap** | Initial load of master data + historical guests/reservations/folio charges from Elektraweb exports |
| **Future hotels** | Same wizard for each new Elektraweb → ERA transfer; adjust adapters if export columns differ |
| **Re-run / fix** | Idempotent upsert — uploading the same file again updates rows, does not duplicate by natural/external keys |

This is a **migration / bootstrap** tool, not day-to-day operational import for reception staff.

**After bootstrap (Nafta dual-run):** live delta via browser extension — [ELEKTRAWEB-LIVE-BRIDGE.md](./ELEKTRAWEB-LIVE-BRIDGE.md) · [ADR](../../docs/adr/hotel-elektraweb-live-bridge.md). Same `externalRef` keys; not a second Excel loop.

---

## 2. Access control

### v1 — platform super-admin only

| Layer | Mechanism |
|-------|-----------|
| **Env** | `PLATFORM_SUPER_ADMIN_EMAILS` (comma/semicolon/space separated), shared with Orchestrator and Finance — see root `.env.example` |
| **Check** | `src/lib/auth/platform-super-admin.ts` → `isPlatformSuperAdminUser({ email, login })` |
| **API** | `assertPlatformSuperAdminImport()` on all `/api/import/*` routes |
| **UI** | Nav item **Elektraweb import** and wizard only when `/api/auth/me` returns `isPlatformSuperAdmin: true` |

Local hotel users (`admin` / `reception` / `Hotel_Admin`) **cannot** see or call import APIs.

### Planned — organization owners (not implemented)

When opening to customers:

1. Replace super-admin gate with Orchestrator entitlement (e.g. owner role + `hotel_migration` module or trial flag).
2. Keep the same wizard and API contract.
3. Add server-side **audit log** (who uploaded which entity/file, timestamp, row counts).
4. Optional: org-scoped object storage for uploaded `.xlsx` retention.

Engine and adapters stay unchanged; only auth + audit.

---

## 3. Operator procedure

### 3.1 Prerequisites

1. Database migrated: `npx prisma migrate deploy` in `era-hotel-pms`.
2. Optional universal dictionaries (all deployments):  
   `npm run db:seed:reference`  
   Upserts RevenueCode, BedType, RoomView by `code` — **no wipe**.
3. Elektraweb `.xlsx` exports saved locally (13 templates; Chart of Accounts **not** used).
4. Log in to hotel PMS as a user whose **email** is listed in `PLATFORM_SUPER_ADMIN_EMAILS`.

### 3.2 Open the wizard

**Setup → Elektraweb import** (`/admin/import`).

Three phases, steps top to bottom:

```
Phase 1 — Dictionaries (any order within phase)
  10  Revenue Codes      Revenue Code Definitions.xlsx
  11  Bed Types          Bed Type.xlsx
  12  Room Views         Room Views.xlsx

Phase 2 — Hotel master data (recommended top → bottom)
  20  Room Types         Room Types.xlsx
  21  Rate Plans         Rate Codes.xlsx
  22  Rooms              Rooms.xlsx
  30  Travel Agencies    Travel Agencies.xlsx
  31  Product Cards      Product Cards.xlsx  (SELLABLE)
  32  Stock Cards        Stock Cards.xlsx    (STOCK)

Phase 3 — Transactional (strict order)
  40  Guests             Guests.xlsx
  50  Reservations       Reservations.xlsx
  60  Folios             Folios.xlsx
```

Numbers match adapter `order` field in code.

### 3.3 Per-step workflow

1. Expand step row.
2. Choose `.xlsx` file.
3. **Preview** — dry-run (`?dryRun=1`); validates rows, shows created/updated/skipped/errors **without writing**.
4. **Import** — commits upserts.
5. Green check + summary when done. Progress saved in browser (`localStorage` key `era-hotel-import-wizard-v1`).

**Order warnings:** if earlier steps in the global sequence are not marked complete in this browser, a yellow banner lists recommended prerequisites. Import is **not** hard-blocked (idempotency allows recovery).

**Reset progress:** button clears local checklist only; does not delete DB data.

### 3.4 Verify after import

Use list **filters** (code/name and entity-specific filters) and **Edit** on each verify screen to fix import typos without re-uploading the workbook.

| Data | Screen |
|------|--------|
| Room types, rooms, rate plans, revenue codes, bed types, room views | `/admin/master-data` — search + room-type filter for rooms |
| Agencies | `/admin/travel-agencies` — search + active filter |
| Products | `/admin/stock` — search + SELLABLE/STOCK filter |
| Guests | `/guests` — search by name, phone, FIN, passport |
| Reservations / folios | Front office reports, reservation card, folio views |

**UI/API CRUD audit:** [ELEKTRAWEB-IMPORT-UI-AUDIT.md](./ELEKTRAWEB-IMPORT-UI-AUDIT.md)  
**Retire policy (no hard delete):** [docs/adr/hotel-master-data-retire-policy.md](../../docs/adr/hotel-master-data-retire-policy.md)

---

## 4. Elektraweb file → ERA entity mapping

| Elektraweb template (typical filename) | API entity slug | Prisma model | Upsert key | Notes |
|----------------------------------------|-----------------|--------------|------------|-------|
| Revenue Code Definitions.xlsx | `revenue-codes` | `RevenueCode` | `code` | Also in reference seed |
| Bed Type.xlsx | `bed-types` | `BedType` | `code` | Also in reference seed |
| Room Views.xlsx | `room-views` | `RoomView` | `code` | Also in reference seed |
| Room Types.xlsx | `room-types` | `RoomType` | `code` | |
| Rate Codes.xlsx | `rate-plans` | `RatePlan` | `code` | Legacy flat price fields |
| Rooms.xlsx | `rooms` | `Room` | `roomNumber` | Soft refs: `viewCode`, `bedTypeCode` |
| Travel Agencies.xlsx | `agencies` | `Agency` | `code` | |
| Product Cards.xlsx | `product-cards` | `Product` | `code` | `productType = SELLABLE` |
| Stock Cards.xlsx | `stock-cards` | `Product` | `code` | `productType = STOCK` |
| Guests.xlsx | `guests` | `Guest` | `externalRef` | Elektraweb **Guest Id**; FIN/passport resolve via MDM only (W4 — not persisted on `Guest`) |
| Reservations.xlsx | `reservations` | `Reservation` | `externalRef` | Elektraweb **Res Id** |
| Folios.xlsx | `folios` | `FolioCharge` | `externalRef` | Elektraweb folio/charge id |
| Chart of Accounts | — | — | — | **Excluded** — finance-core |

---

## 5. Dependencies between steps

```text
[Revenue codes] ──┐
[Bed types]     ──┼──► Room types ──► Rate plans ──► Rooms
[Room views]    ──┘         │              │
                            │              └──► Reservations ──► Folios
[Agencies] ─────────────────┼───────────────────────►      ▲
[Product / Stock cards] ────┘                              │
[Guests] ──────────────────────────────────────────────────┘
```

- **Reservations** resolve RoomType (code/name), optional Room, Agency, Guest (name or existing guest).
- **Folios** resolve Reservation by `externalRef`, RevenueCode by `code`.
- **Guests** import resolves `globalPersonId` via MDM when FIN or passport is present (`resolvePersonIdentity` from `@era/satellite-kit`).

Missing references surface as **per-row errors** in preview/import summary.

---

## 6. Guest / citizen (MDM) boundary

ERA splits person data across two layers:

| Layer | Where | What |
|-------|-------|------|
| **Citizen / global person** | Orchestrator MDM (`GlobalNaturalPerson`) | FIN, passport, canonical PII |
| **Hotel guest profile** | `era-hotel-pms` → `Guest` | Stays, folio links, VIP, visit count, operational fields |

Import behavior:

- `Guest.externalRef` = Elektraweb guest id (idempotent key).
- On write, if FIN/passport present → `resolvePersonIdentity` → set `Guest.globalPersonId`.
- Operational fields (name, phone, email, …) remain on `Guest` for PMS UX; do not treat import as a replacement for MDM.

Guest list UI: **`/guests`** (unchanged). Import is **not** on the guests page — only in the wizard.

---

## 7. What is NOT imported

| Area | Reason |
|------|--------|
| Chart of Accounts | GL belongs to **era-finance-core** |
| Users / passwords | Satellite local users + SSO; use admin users screen / staff provision |
| Contract pricing rules | Superseded by dynamic rate plans — **do not import** on greenfield Nafta |
| BAR calendar (`RoomTypeRate`) | Not in standard 13 templates — see [nafta/IMPORT-PRICING-MAP.md](./nafta/IMPORT-PRICING-MAP.md) |
| B2B contracts | `SalesContract` — separate adapter; see same doc |

---

## 8. API reference

### `GET /api/import`

- **Auth:** platform super-admin.
- **Response:** array of `{ entity, label, order, templateHint }` sorted by `order`.

### `POST /api/import/[entity]?dryRun=1|0`

- **Auth:** platform super-admin.
- **Body:** `multipart/form-data` field `file`, or JSON `{ "fileBase64": "..." }`.
- **Query:** `dryRun=1` preview (no commit), omit or `0` for write.
- **Response:**

```json
{
  "entity": "room-types",
  "label": "Room Types",
  "dryRun": true,
  "totalRows": 12,
  "created": 10,
  "updated": 2,
  "skipped": 0,
  "errors": [{ "row": 5, "message": "..." }]
}
```

Excel row numbers in `errors[].row` are **1-based sheet rows** (header = row 1, first data row = 2).

### Entity slugs

`revenue-codes`, `bed-types`, `room-views`, `room-types`, `rate-plans`, `rooms`, `agencies`, `product-cards`, `stock-cards`, `guests`, `reservations`, `folios`.

---

## 9. Architecture (developers)

### Directory layout

```text
era-hotel-pms/
  app/admin/import/page.tsx          # Wizard page shell
  app/api/import/route.ts            # GET catalog
  app/api/import/[entity]/route.ts   # POST upload
  src/components/import/
    ImportWizard.tsx                 # Phased checklist
    ImportStepRow.tsx                # Single step UI
    ImportModal.tsx                  # Legacy modal (unused in wizard; kept for reuse)
  src/lib/import/
    excel.ts                         # xlsx parse → rows
    helpers.ts                       # header map, dates, booleans
    run-import.ts                    # validate + upsert loop
    upload.ts                        # fetch wrapper
    phases.ts                        # Phase 1/2/3 definition
    step-status-storage.ts           # localStorage progress
    auth.ts                          # assertPlatformSuperAdminImport
    types.ts                         # ImportAdapter contract
    adapters/*.ts                    # One file per entity
  prisma/
    seed-reference.ts                # Universal dictionaries
    migrations/20260612200000_elektraweb_import/
```

### Adapter contract

```typescript
type ImportAdapter<T> = {
  entity: string;
  label: string;
  order: number;
  permission: Permission;           // legacy field; API uses super-admin gate
  templateHint: string;
  headerAliases: Record<string, string>;  // Excel header → field name
  rowSchema: z.ZodType<T>;
  mapRow: (raw: Record<string, unknown>) => unknown;
  upsert: (tx, row, dryRun) => Promise<'created'|'updated'|'skipped'>;
};
```

### Processing pipeline

1. `parseWorkbook(buffer)` — first sheet, header row → array of row objects.
2. `mapHeaders(row, headerAliases)` — normalize Elektraweb column names.
3. `mapRow` + `rowSchema.parse` — typed row.
4. `adapter.upsert(prisma, row, dryRun)` — idempotent `upsert` / existence check.

**Note:** rows are processed sequentially; there is no single wrapping `$transaction` for the whole file. Failed rows are collected; successful rows persist.

### Schema additions (migration `20260612200000_elektraweb_import`)

- New: `RoomView`, `BedType`, `ProductType` enum.
- `Guest.externalRef`, `Reservation.externalRef`, `FolioCharge.externalRef` (unique, nullable).
- Extended `Room`: `viewCode`, `bedTypeCode`, `location`, `maxBed`, …
- Extended `Product`: `productType`, `price`, `vatRate`, `lastCost`, …

---

## 10. Reference seed vs wizard import

| Mechanism | Command / UI | Scope | Wipe? |
|-----------|--------------|-------|-------|
| Reference seed | `npm run db:seed:reference` | Universal RevenueCode, BedType, RoomView | No — upsert by `code` |
| Property import | `/admin/import` wizard | Property-specific master + transactional | No — upsert by keys above |

Run reference seed on **every new deployment** before or alongside first property import. Property-specific revenue codes from Excel can extend or override names; codes should stay consistent with finance routing expectations.

---

## 11. Extending for the next hotel

1. Export the same 12 templates from the new property’s Elektraweb tenant.
2. Run wizard in order; fix adapter `headerAliases` if Elektraweb column titles differ (grep `headerAliases` in `src/lib/import/adapters/`).
3. Add optional columns to `mapRow` / Zod schema / upsert if new fields are required.
4. If a new entity type appears, add adapter + register in `adapters/index.ts` + add to `phases.ts` + i18n `elektrawebImport.phase.*`.
5. Document property-specific quirks in a short note under `doc/` or in PR description.

**Do not** fork the engine per hotel — keep one adapter registry.

---

## 12. Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| 403 on import API | User not in `PLATFORM_SUPER_ADMIN_EMAILS` | SSO email must match env list |
| Room type not found (reservations) | Phase 2 step 20 skipped | Import Room Types first; re-run reservations |
| No guests in database | Guests step skipped | Import Guests.xlsx before Reservations |
| MDM not linked | Missing FIN/passport in row | Expected; link manually via guest card / person lookup |
| Duplicate key errors | Changed upsert key in source | Fix Excel or clear conflicting row in DB |
| Headers not mapped | Column rename in Elektraweb export | Update `headerAliases` in adapter |
| Preview OK, many errors on import | FK / missing parent rows | Complete earlier wizard steps |

---

## 13. i18n

Wizard strings: `messages/{en,ru,az}.json` → key namespace **`elektrawebImport`**.  
Nav label: `nav.elektrawebImport`.

---

## 14. Related documentation

| Doc | Content |
|-----|---------|
| [DELIVERY.md](./DELIVERY.md) Stage 26 | Checkbox delivery status |
| [clone-spec/09-master-data.md](./clone-spec/09-master-data.md) | Master data spec + import summary |
| [ELEKTRAWEB-PARITY.md](./ELEKTRAWEB-PARITY.md) | Parity manifest pointer |
| [docs/adr/hotel-elektraweb-import.md](../../docs/adr/hotel-elektraweb-import.md) | Architecture decision record |
| [docs/adr/hotel-deferred-corporate-checkout.md](../../docs/adr/hotel-deferred-corporate-checkout.md) | T-room / city-ledger checkout parity |
| [.cursor/rules/hotel-import-module.mdc](../.cursor/rules/hotel-import-module.mdc) | Cursor module map |

---

## 15. Elektraweb export limits & pre-merge scripts

Elektraweb UI exports **at most ~1000 rows per download** unless the operator scrolls the full grid before export. Nafta migration therefore produces **overlapping chunk files** that must be merged **before** wizard upload.

### 15.1 Merge scripts (`era-hotel-pms/scripts/`)

| Script | Dedupe key | Output |
|--------|------------|--------|
| `merge-guest-cards.js` | `Guest Id` | `Guest Cards.merged.*.xlsx` |
| `merge-reservations.js` | `Res Id` (prefers InHouse > Reservation > CheckOut) | `Front Office Control Panel.merged.*.xlsx` |
| `merge-folio-transactions.js` | Folio transaction `Id` | `Folio Transactions.merged.xlsx` + `FnB Transactions.merged.xlsx` (+ `.summary.json`) |

```bash
# Guest cards (all chunks in Downloads)
node era-hotel-pms/scripts/merge-guest-cards.js "C:/Users/.../Downloads"

# Reservations (explicit files or folder glob)
node era-hotel-pms/scripts/merge-reservations.js --files chunk1.xlsx chunk2.xlsx --out merged.xlsx

# Folio transactions (single folder of chunks — legacy)
node era-hotel-pms/scripts/merge-folio-transactions.js "C:/Users/.../Folio 01 jan - 14 jun 2026"

# Nafta EW pack: multi-root (Folio 2024/, Folio 2025/, consolidated xlsx, Jul chunks) + hotel/FnB split
node era-hotel-pms/scripts/merge-folio-transactions.js --ew "C:/Users/.../Downloads/EW"
```

When the last chunk has **< ~850 rows**, the export is likely complete for that filter. Chunks with **900–1000 rows** usually need another date slice.

**Hotel vs FnB split (`--ew`):** house-ledger `999 FB` / `FB999` and walk-in restaurant cash (`CASH FOLIO` + F&B dept / `RESTORAN*` without `Res Id`) go to **`FnB Transactions.merged.xlsx`** (archive for future `era-fnb-pos` import — not hotel wizard). F&B **room charges on a real guest/`Res Id`** stay in **`Folio Transactions.merged.xlsx`** for hotel-pms `folios` import. Do not upload `Folios.xlsx` / `ProFolio Transactions.xlsx` as substitutes for Folio Transactions.

### 15.2 Report types (do not confuse)

| Elektraweb report | Contents | ERA use |
|-------------------|----------|---------|
| **Guest Cards** | Full guest registry | `Guest.externalRef`, MDM link, loyalty `visitCount` seed |
| **Front Office Control Panel** | Reservations / room states | `Reservation.externalRef`; see T-room ADR |
| **Folio Transactions** | All POS/folio movements (room, SPA, F&B, cash) | Split via `--ew`: hotel `FolioCharge` vs FnB house archive |
| **ProFolio Transactions** | Accommodation / ROOM lines only | Cross-check; not a substitute for full Folio Transactions |

Early 2024 Folio Transactions exports may be **F&B-heavy** (`999 FB` POS account) before room/SPA posting matured. From 2026, Folio Transactions includes real guest names, `ACCOMMODATION`, and `SPA MEDIKAL` rows.

### 15.3 T-prefixed `Room No` (FOCP)

Not a physical room. See [hotel-deferred-corporate-checkout ADR](../../docs/adr/hotel-deferred-corporate-checkout.md):

- **Deferred settlement:** guest departed; agency/corporate invoice pending → import as `CHECKED_OUT` + settlement flag (planned); never assign `T{ResId}` to `Room`.
- **System ledger:** `999 FB`, `DEBITORLAR`, `TIBB AMBULATOR FOLIO`, `Sanal Folyo` → skip reservation import.

### 15.4 Loyalty / visit history (bootstrap)

| Source | What it gives | Limit |
|--------|---------------|-------|
| **Guest Cards** `Repeat Count` | Elektraweb visit counter per guest id | Best single-field seed (Nafta merged: ~5.6k guests with count > 0) |
| **Folio Transactions** | Group by `Res Id` → stay window (`Arrival`/`Departure`), guest name, agency | Reconstructs **stays**, not guest identity; name spelling varies |
| **FOCP reservations** | Full reservation rows when export complete | Preferred for stay list when available |
| **WebOnly guest registry** | Clinic bridge (`Qonaq Id` + passport) | Not loyalty; crosswalk to Elektraweb `Guest Id` via passport |

**Recommendation:** seed `Guest.visitCount` from merged Guest Cards; optionally recompute from merged folio + reservations after 2024–2026 folio archive is complete. Folio alone is **insufficient** for identity (duplicate names, multi-guest strings) but **necessary** to validate/enrich stay dates and spend.

Phase 1 UAT does **not** require full historical folio replay — see [NAFTA_SANATORIUM_UAT.md](../../docs/NAFTA_SANATORIUM_UAT.md).

### 15.5 Guest ↔ reservation name linking (Nafta EW audit, locked)

FOCP / Folio Transactions exports have **`Guest Name` only** (no Elektraweb `Guest Id`). Linking to Guest Cards is therefore string-based.

**Cancelled / future without stay:** do **not** chase missing Guest Cards. If a Guest Card already exists and is **complete**, import/link it; if the card has gaps, **skip**. Complete = `Guest Id` + Name + Last Name + at least one of Passport / National Id / Phone.

**Focus for linkage pressure:** `CheckOut` (and `InHouse`) rows.

| Step | Rule |
|------|------|
| 1. Strict | Exact normalized `Name + Last Name` (and reverse) vs split parts of `Guest Name` (`A / B / C`) |
| 2. Safe auto | Diacritic / AZ–Latin fold (`ə→e`, `ü→u`, …), compact (drop spaces), prefix truncation of EW-clipped names |
| 3. **Do not auto-link** | `initials` / weak token-avg (same surname, different given name — high false-positive rate) |
| 4. Accept residual gap | Walk-in nicknames (`… bəy` / `xanım`), staff/group labels, foreigners never stored on Guest Cards |

Nafta snapshot (2026-07-13 merged packs): ~80% reservations strict-match a Guest Card; of ~307 named `CheckOut` without strict match, **safe fold recovers ~12%**; the rest stay unmatched or need **manual** review. Scripts: `scripts/audit-reservation-guest-folio.js`, `scripts/audit-unmatched-guests.js`, `scripts/audit-checkout-fuzzy-guests.js`.

---

## 16. Version history

| Date | Change |
|------|--------|
| 2026-06-12 | Stage 26: engine, adapters, schema, reference seed, super-admin API |
| 2026-06-12 | UI consolidated to phased wizard; removed Import from master-data / stock / agencies |
| 2026-06-12 | Guest import MDM `globalPersonId` resolve; super-admin-only gate |
| 2026-06-15 | Pre-merge scripts; Folio vs ProFolio; T-room ADR; loyalty bootstrap notes (Nafta) |
| 2026-07-13 | Folio `--ew` multi-root merge + hotel vs `999 FB` FnB house split |
| 2026-07-13 | §15.5 locked guest↔reservation name-linking policy (safe fold only; no initials auto) |
| 2026-07-13 | §15.5 Cancelled/future: import complete cards only; skip incomplete; Nafta [IMPORT_FILE_CHECKLIST.md](./nafta/IMPORT_FILE_CHECKLIST.md) |
