# ERA Hotel — menu IA canon (SSOT)

**Status:** adopted 2026-08-07  
**App:** `era-hotel-pms`  
**Goal:** role/shift sections with canonical URLs — not 1:1 Elektraweb clone.  
**Empty-system rule:** move URLs immediately; no permanent 301 layer required (thin redirects optional during cutover).

Related: [FRONT-OFFICE-ELECTRAWEB.md](./FRONT-OFFICE-ELECTRAWEB.md) · [HotelOpsShell](../src/components/HotelOpsShell.tsx) · ecosystem boundary [HOSPITALITY_FINANCE_BOUNDARY.md](../../docs/HOSPITALITY_FINANCE_BOUNDARY.md)

---

## 1. Principles

1. **Section = role / shift** (FO, Front Cash, Night Audit, HK, Distribution…).
2. **Items = working screens** for that shift (keep sidebar short; long report lists live in hubs).
3. **One screen → one primary home** in the sidebar; secondary deep links OK.
4. **Canonical URLs by section** — FO always `/fo/*`, Housekeeping always `/hk/*`.
5. **Finance / F&B POS / Clinic** — external / deep link only (not shift submenus).
6. **Settings = `/settings/*`**, not `/admin` (avoid confusion with platform SuperAdmin).

---

## 2. Full menu structure

### 2.1 Front Office — all under `/fo`

| Menu item | URL | Description |
|-----------|-----|-------------|
| Room type availability | `/fo/availability` | Sellable Avl/Occ; entry to create when Avl > 0 |
| Reservation list | `/fo/reservations` | Stay queue: filters, notes, assign / check-in |
| Room rack | `/fo/rack` | Shift doors: HK status, in-house, quick actions |
| Room plan | `/fo/room-plan` | Timeline by room; relocate / extend |
| Group reservations | `/fo/groups` | Groups / booking envelope |
| In-house | `/fo/in-house` | In-house guests; jump to card / folio |
| Room changes | `/fo/room-changes` | Room change plans |
| Reservation times *(optional FO report)* | `/fo/reservation-times` | Actual check-in / check-out times |

Reservation Card / Guest Card open from list/rack — not sidebar items.

**Primary home only in FO** — do not duplicate these items under Cash / NA / HK.

Legacy cutover (temporary redirects OK): `/` → `/fo/rack`, `/availability` → `/fo/availability`, `/room-plan` → `/fo/room-plan`, `/in-house` → `/fo/in-house`, `/reports/reservations` → `/fo/reservations`, `/reports/group-reservations` → `/fo/groups`, `/reports/room-changes` → `/fo/room-changes`, `/reports/reservation-times` → `/fo/reservation-times`.

---

### 2.2 Front Cash — `/front-cash/*`

| Menu item | URL | Description |
|-----------|-----|-------------|
| Pending settlement | `/front-cash/pending` | Walk-in pay queue: **F&B café + clinic/sanatorium** via settlement hub; pay / void |
| Agency city ledger | `/front-cash/agency-ledger` | Agency CL ops snapshot; apply payment; Finance deep link when configured |
| Shift journal | `/front-cash/transactions` | FO cash journal + shift Z packet + close shift (ops, not fiscal KKM Z) |
| Folio (not a list item) | `/folio/[reservationId]` | Stay folio: charges, deposit, settle, refund, checkout/CL — open from FO card / in-house |

Café/clinic tickets awaiting reception payment live on **`/front-cash/pending`** (not a separate sanatorium menu, not F&B floor).

Legacy: `/reports/agency-ledger` → `/front-cash/agency-ledger`.

---

### 2.3 Night Audit — `/night-audit/*`

Short sidebar (Elektraweb shape); EOD report pack is a **hub**, not 20 menu rows.

| Menu item | URL | Description |
|-----------|-----|-------------|
| End of day | `/night-audit` | Close-day console: business date, pre-check gates, polish preview, Run NA |
| EOD reports | `/night-audit/reports` | Archived daily report hub (date + report list) |
| EOD logs | `/night-audit/logs` | NA run history (who / when / steps / errors) — single log screen |
| Reservation updates | `/night-audit/reservation-updates` | Reservation changes in audit window (cancel/extend/notes) |
| End of year | `/night-audit/year-end` | Year close/open (Last/First day). **In menu now**; implement when asked at year-end |

**Inside EOD reports hub (not sidebar):**  
P0 — Daily in-house, check-in, check-out.  
P1 — Cancelled, created today, folio transactions, room price control, cash report (ops).  
P2 — CL / dept revenue → hotel snapshot or Finance deep link.  
Police/official guest → Migration; POS product sales → F&B.

End of day links to Front Cash pending as a **blocker**, not a duplicate menu item.

Legacy: `/operations` → `/night-audit`, `/reports/end-of-day-logs` → `/night-audit/logs`, `/reports/inhouse-daily` → under `/night-audit/reports` (or dedicated child).

---

### 2.4 Housekeeping — all under `/hk`

| Menu item | URL | Description |
|-----------|-----|-------------|
| Housekeeping | `/hk` | Tasks, room statuses, DIRTY → CLEAN → INSPECTED |
| HK mobile | `/hk/mobile` | Maid mobile client |
| Minibar | `/hk/minibar` | Minibar control |
| Maid management | `/hk/maids` | Maid shifts / assignment |
| Closed rooms (OOO) | `/hk/closed-rooms` | OOO / closed rooms |
| Lost & found | `/hk/lost-and-found` | Lost & found |

Legacy: `/housekeeping` → `/hk`, `/housekeeping/*` → `/hk/*`.

---

### 2.5 Distribution — `/distribution/*`

| Menu item | URL | Description |
|-----------|-----|-------------|
| Channel manager | `/distribution/channel` | OTA push/pull, mappings, stop-sell |
| Sales contracts | `/distribution/contracts` | B2B contracts, commission, pickup |
| Allotment blocks | `/distribution/allotment-blocks` | Blocks / quotas, pickup → booking |
| Promotion codes | `/distribution/promotion-codes` | Promotions |
| Travel agencies | `/distribution/travel-agencies` | Agency master |
| Child matrix | `/distribution/child-matrix` | Child rate matrix |
| Yield rules | `/distribution/yield-rules` | Yield / stop rules |

Legacy: `/channel` → `/distribution/channel`, `/admin/contracts` → `/distribution/contracts`, etc.

---

### 2.6 Guests — `/guests`

| Menu item | URL | Description |
|-----------|-----|-------------|
| Guest profiles | `/guests` | Registry; CRM depth inside guest card |

No separate top-level CRM module required if tabs cover notes/tasks/allergens/merge.

---

### 2.7 Service & maintenance

| Menu item | URL | Description |
|-----------|-----|-------------|
| Service ops | `/service` | Staff/guest maintenance requests |
| Guest request form | `/service/guest` | Guest-facing request form |

---

### 2.8 Migration PRO

| Menu item | URL | Description |
|-----------|-----|-------------|
| Registration queue | `/migration` | AZ migration queue; police-like lists live here / migration reports |

---

### 2.9 SPA & scheduling

| Menu item | URL | Description |
|-----------|-----|-------------|
| Procedures | `/procedures` | Procedure slots (sanatorium) |
| SPA reservations | `/spa/reservations` | SPA booking list |
| Staff match | `/spa/staff-match` | Therapist matching |
| Places & rooms | `/spa/places` | Cabinets / places |

Deep clinical / lab → **Clinic** (external).

---

### 2.10 Transfers

| Menu item | URL | Description |
|-----------|-----|-------------|
| Transfers | `/transfers` | Transfers → folio |
| Airport | `/transfers/airport` | Airport transfer flow |

---

### 2.11 Banquets

| Menu item | URL | Description |
|-----------|-----|-------------|
| Banquets / BEO | `/banquets` | Events, lines, resources, staff, settlement (≠ guest folio) |

---

### 2.12 Medical & sanatorium (hotel-thin)

| Menu item | URL | Description |
|-----------|-----|-------------|
| Medical | `/medical` | Thin hotel medical; clinic/lab → Clinic |

---

### 2.13 Settings — `/settings/*`

| Menu item | URL | Description |
|-----------|-----|-------------|
| Master data | `/settings/master-data` | Rooms, types, rates, revenue codes, routing |
| BAR calendar | `/settings/bar-calendar` | All BAR BASE plans (`BAR-BB`, `BAR-FB`, …) with plan tabs + daily grid |
| Pricing components | `/settings/pricing-components` | Versioned service fee / meals / COGS (BAR floor inputs, HOT-PC-01) |
| Users | `/settings/users` | Local hotel users/roles (SSO seats → CP) |
| Integration | `/settings/integration` | Bridges, tokens, Finance handoff |
| Audit viewer | `/settings/audit` | Action audit |
| Stock (local MVP) | `/settings/stock` | Local HK consumption; ERP warehouse → Finance |
| Elektraweb import | `/settings/import` | Import (controlled / SuperAdmin) |

Legacy: `/admin/*` → `/settings/*` for these screens.

---

### 2.14 External (not hotel shift sections)

| Label | Target | Description |
|-------|--------|-------------|
| POS | F&B POS URL | Floor / orders / menu |
| Retail | Retail URL | Souvenir shop |
| Finance | Finance URL | Invoices, AR, aging, e-qaimə |
| Clinic | Clinic URL | Lab / deep clinical |

---

### 2.15 Əsas — deferred

`/executive`, `/executive/forecast` — decide later; not locked in this wave.

---

## 3. Working-screen → home map

| Work class | Home |
|------------|------|
| Sell / book / stay | Front Office `/fo` |
| Stay pay + café/clinic walk-in + agency CL | Front Cash `/front-cash` |
| Day close / logs / EOD pack / year-end | Night Audit `/night-audit` |
| Cleaning / OOO / L&F | Housekeeping `/hk` |
| OTA + B2B + quotas | Distribution `/distribution` |
| Guest profile | Guests `/guests` |
| GL / AR / e-invoice | **Finance** |
| POS / digital menu | **F&B** |
| Lab / deep medical | **Clinic** |

---

## 4. Sidebar order

1. Front Office  
2. Front Cash  
3. Night Audit  
4. Housekeeping  
5. Guests  
6. Distribution  
7. Service  
8. Migration  
9. SPA  
10. Transfers  
11. Banquets  
12. Medical  
13. Settings  
14. External links (footer / header)  
15. Əsas — when decided  

---

## 5. Implementation gaps called out by this canon

| Screen | Status (2026-08-07 deepen) | Still later |
|--------|----------------------------|-------------|
| `/front-cash/transactions` | **SHIPPED** HOT-CASH-06 — shift filter + printable ops Z + close shift | Fiscal KKM Z (not claimed) |
| `/night-audit/reports` + P1 grids | **SHIPPED** HOT-NA-03 — P1 + no-shows / room-moves / VIP + CSV | Full EW-style 01–22 archived pack |
| `/night-audit/reservation-updates` | **SHIPPED** HOT-NA-04 — action filter + CSV | Richer diff / typed events |
| `/night-audit/year-end` | **STUB** HOT-NA-05 — ADR [`hotel-year-end-calendar`](../../docs/adr/hotel-year-end-calendar.md) | Live close/open after Finance sign-off |
| URL migration FO/HK/Cash/NA/Distribution/Settings | Done (legacy redirects in `next.config`) | Remove redirects when bookmarks migrate |

Readiness: [`MENU-IA-PRIMARY-FILL-AUDIT.md`](./MENU-IA-PRIMARY-FILL-AUDIT.md) · deepen [`MENU-IA-DEEPEN-AUDIT.md`](./MENU-IA-DEEPEN-AUDIT.md).

---

## 6. Consciously not copied into hotel menu

- Invoice / Accounting / Fixed Assets / Purchasing / ERP Stock as hotel modules  
- Full POS / Digital Menu inside hotel sidebar  
- 20+ EOD reports as separate sidebar rows  
- Duplicate End of Day Log 2  
- Elektraweb Setup noise (license, carbon, agency portal)

---

## 7. Hard URL rules (this wave)

| Section | Prefix |
|---------|--------|
| Front Office | **`/fo/*` only** |
| Housekeeping | **`/hk/*` only** |
| Front Cash | `/front-cash/*` |
| Night Audit | `/night-audit/*` |
| Distribution | `/distribution/*` |
| Settings | `/settings/*` |
