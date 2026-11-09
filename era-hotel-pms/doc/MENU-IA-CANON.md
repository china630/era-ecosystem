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
4. **Canonical URLs by section** — FO always `/fo/*`, Housekeeping always `/hk/*`, department schedules `/schedules/*` (HK roster stays `/hk/roster`).
5. **Finance / F&B POS / Clinic** — external / deep link only (not shift submenus).
6. **Settings = `/settings/*`**, not `/admin` (avoid confusion with platform SuperAdmin).

---

## 2. Full menu structure

### 2.1 Front Office — all under `/fo`

| Menu item | URL | Description |
|-----------|-----|-------------|
| Room type availability | `/fo/availability` | Sellable Avl/Occ; entry to create when Avl > 0 |
| Reservation list | `/fo/reservations` | Stay queue: filters, notes, children column, departed strike, Res. ID copy, click/dblclick |
| Room plan | `/fo/room-plan` | Timeline by room; relocate / extend |
| Room rack | `/fo/rack` | Shift doors: HK status, in-house, today's arrival, quick actions |
| Group reservations | `/fo/groups` | Groups / booking envelope |
| In-house | `/fo/in-house` | Live party rows (adults + children); jump to card / folio |
| Room changes | `/fo/room-changes` | Journal of moves; change door on plan / card Assignment |
| Reservation times *(optional FO report)* | `/fo/reservation-times` | Actual CI/CO journal; guest + agency filters |
| Agency inbox | `/fo/agency-inbox` | OPTION stays from agency portal — confirm / decline (`hotel_agency_portal`) |
| Guest laundry | `/fo/laundry` | Ticket grid + filters; fallback Delivered + return scan (no invent) |

Agency extranet UI lives on orchestrator `/agency/*` + hotel `/agency/*` after SSO — **not** in the hotel staff sidebar.

Reservation Card / Guest Card open from list/rack — not sidebar items.

**Primary home only in FO** — do not duplicate these items under Cash / NA / HK.

Legacy cutover (temporary redirects OK): `/` → `/fo/rack`, `/availability` → `/fo/availability`, `/room-plan` → `/fo/room-plan`, `/in-house` → `/fo/in-house`, `/reports/reservations` → `/fo/reservations`, `/reports/group-reservations` → `/fo/groups`, `/reports/room-changes` → `/fo/room-changes`, `/reports/reservation-times` → `/fo/reservation-times`.

---

### 2.2 Front Cash — `/front-cash/*`

| Menu item | URL | Description |
|-----------|-----|-------------|
| Pending settlement | `/front-cash/pending` | Walk-in pay queue: **F&B café + clinic/sanatorium** via settlement hub; click receipt → line items; pay / void in modal |
| Folio balances | `/front-cash/folio-balances` | In-house / any balance / guest balance / reservations — guest vs agency vs company |
| Folio journal | `/front-cash/folio-journal` | Day charges+payments (read-only); click → stay folio |
| Agency city ledger | `/front-cash/agency-ledger` | Travel-agent CL; AGENCY folios; commission %; Finance snapshot |
| Company city ledger | `/front-cash/company-ledger` | Corporate CL; COMPANY folios; prepaid/postpaid; no commission |
| Unsettled departures | `/front-cash/unsettled-departures` | CHECKED_OUT stays with City Ledger settlement PENDING/INVOICED; retry invoice / push snapshot |
| Day journal | `/front-cash/transactions` | Night-audit report 05. One business day, all cash points. Not in the cash menu |
| Folio (not a screen) | reservation card, Folio tab | Stay ledger. Payment, charge, invoice, checkout, void, and refund are modals on that tab. Header “Accept payment” opens the same payment modal. `/folio/[id]` redirects to the card. |

Café/clinic tickets awaiting reception payment live on **`/front-cash/pending`** (not a separate sanatorium menu, not F&B floor).

Legacy: `/reports/agency-ledger` → `/front-cash/agency-ledger`.

---

### 2.3 Night Audit — `/night-audit/*`

Short sidebar (Elektraweb shape); EOD report pack is a **hub**, not 20 menu rows.

| Menu item | URL | Description |
|-----------|-----|-------------|
| End of day | `/night-audit` | Close-day console: business date, pre-check gates, polish preview, Run NA |
| EOD reports | `/night-audit/reports` | Closed-date hub: **nightly pack** members (deep links to `/reports/*`) + Download ZIP; NA-only ops grids stay here |
| EOD logs | `/night-audit/logs` | NA run history (when / steps / errors). The run row does not store an operator. |
| Reservation updates | `/night-audit/reservation-updates` | Not a night-audit menu row. Linked from the EOD pack. Reservation changes in the audit window |
| End of year | `/night-audit/year-end` | Last day only on closed 31 Dec; first day only on 1 Jan. Hotel calendar, not finance GL |

**Inside EOD reports hub (not sidebar):**  
Management pack (hotel-configured, Nafta default = 9 PDFs, including the police list) — links to `/reports/*` + ZIP. A saved pack that is still the previous eight slugs is rewritten to include `police-list` on the next pack read. Spec: [`MANAGEMENT-REPORTS-CATALOG.md`](./MANAGEMENT-REPORTS-CATALOG.md).  
NA ops grids remain here: cancelled / created / room-price / no-show / room-move / VIP / reservation updates / EOD logs.  
Police/official guest → Migration; POS product sales → F&B.

End of day links to Front Cash pending as a **blocker**, not a duplicate menu item.

Legacy: `/operations` → `/night-audit`, `/reports/end-of-day-logs` → `/night-audit/logs`, `/reports/inhouse-daily` → under `/night-audit/reports` (or dedicated child).

---

### 2.4 Housekeeping — all under `/hk`

Sidebar order (top level, then groups). URLs stay flat under `/hk/*`.

| Menu item | URL | Description |
|-----------|-----|-------------|
| Housekeeping | `/hk` | Floor sheet: one floor, row actions, fullscreen |
| HK rooms | `/hk/rooms` | Hotel-wide cleanliness board |
| Skip / Sleep | `/hk/discrepancy` | FO occupied vs empty (Skip) / vacant vs occupied (Sleep). Sleep ≠ SO |
| Closed rooms (OOO/OOS) | `/hk/closed-rooms` | One grid + kind filter; close in modal; `RoomClosure` dates |
| HK mobile | `/hk/mobile` | Maid mobile client (one click; not under a group) |
| HK forecast | `/hk/forecast` | Load 1/7/14/30 by floor |
| **HK staff** ▸ | | Maid assignment → daily floor pairs (weekly roster under **Schedules**) |
| Maid management | `/hk/maids` | Link CP employment; hotel keeps HK department and ƏG |
| Floor rotation | `/hk/rotation` | Daily pairs 2–11 + swap |
| **Minibar** ▸ | | Folio sale + catalog (not HK consumption) |
| Minibar | `/hk/minibar` | Minibar control. Guest folio sale |
| Minibar catalog | `/settings/stock` | Local hotel product catalog. Screen permission stays Settings |
| HK consumption | `/hk/consumption` | Finance sku and quantity for the open business day. Guest price 0. Not a folio line. Separate from Minibar. Kit table shell (`rounded-2xl`) |
| **Guest services** ▸ | | Laundry + lost & found |
| Guest laundry | `/hk/laundry` | Intake grid with price/sum preview; Accept → IN_PLANT; Delivered + return form → folio `LAUNDRY` |
| Lost & found | `/hk/lost-and-found` | Lost & found |
| Laundry catalog | `/settings/laundry-catalog` | Item names az/ru/en + wash/iron/express prices (empty = not offered) |
| Policies | `/settings/policies#hk` and `#laundry` | Linen / deep on `#hk`. Laundry intake/due/express on `#laundry`. Old `/settings/hk-policy` redirects to `#hk` |

First open on secondary HK screens shows table/board chrome and an empty-state next step (not a bare page).

Legacy: `/housekeeping` → `/hk`, `/housekeeping/*` → `/hk/*`.

---

### 2.4b Schedules — last ops section before Settings

All hotel weekly duty boards live only here (not under Housekeeping). Type catalog: [ADR hotel-department-duty-schedules](../../docs/adr/hotel-department-duty-schedules.md).

| Menu item | URL | Description |
|-----------|-----|-------------|
| All schedules | `/schedules` | Hub: HK + reception + security + engineering |
| HK roster | `/hk/roster` | Existing `WEEK_ZONE` (Schedules only — removed from HK staff) |
| Reception roster | `/schedules/reception` | `WEEK_POST`; chip assign; week chrome; copy week; settings collapsed |
| Security roster | `/schedules/security` | `WEEK_POST`; same UX |
| Technical roster | `/schedules/engineering` | `WEEK_CREW`; same UX |

Sidebar order: … Reports → **Schedules** → Settings. Permission: `screen:schedules` (HK roster also `screen:hk`). UAT-SMOKE §34b open — not SHIPPED.

---

### 2.5 Distribution — `/distribution/*`

| Menu item | URL | Description |
|-----------|-----|-------------|
| Channel manager | `/distribution/channel` | OTA push/pull, mappings, stop-sell — tabs Overview / Channels / Inventory / Journal (`?tab=`) |
| Sales contracts | `/distribution/contracts` | B2B contracts, commission, pickup |
| Allotment blocks | `/distribution/allotment-blocks` | Multi-line holds, optional sales contract, pickup → booking |
| Promotion codes | `/distribution/promotion-codes` | Promo master (CRUD). Apply-on-stay + certificates = debt H-BL-52/53 — [ADR vouchers split](../../docs/adr/hotel-vouchers-promotions-certificates.md). Agency voucher # stays on reservation `voucherNo` (H-BL-51). |
| Travel agencies | `/distribution/travel-agencies` | Agency master (commission + prepaid/postpaid) |
| Agency commission | `/distribution/agency-commission` | Hotel→agency payable (accrual/statement/forecast); **not** City Ledger AR — ADR hotel-agency-commission-payable |
| Companies | `/distribution/companies` | Corporate master (direct bill, no commission) |

Legacy: `/channel` → `/distribution/channel`, `/admin/contracts` → `/distribution/contracts`, etc.

---

### 2.5b Rates & pricing — `/settings/*` (BAR umbrella)

| Menu item | URL | Description |
|-----------|-----|-------------|
| BAR calendar | `/settings/bar-calendar` | All BAR BASE plans with plan tabs + daily grid |
| Pricing policy | `/settings/policies#pricing` | Occupancy / load-yield / child-absolute flags. Old `/settings/pricing-policy` redirects |
| Child matrix | `/settings/child-matrix` | Child age bands (% / absolute / freeCount) on top of adult nightly |
| Yield rules | `/settings/yield-rules` | Load-based % uplift (only if policy flag ON; not stop-sell) |
| Pricing components | `/settings/pricing-components` | Versioned service fee / meals / COGS (BAR floor inputs) |
| Package prices | `/settings/package-prices` | Package sell + cost floor |

Legacy: `/distribution/child-matrix` → `/settings/child-matrix`, `/distribution/yield-rules` → `/settings/yield-rules`, `/admin/*` same.

---

### 2.6 Guests — `/guests`

| Menu item | URL | Description |
|-----------|-----|-------------|
| Guest profiles | `/guests` | Registry; CRM depth inside guest card |
| Guest dedup | `/reports/guest-dedup` | Duplicate cards. Menu home is Guests, not Reports |

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
| Transfers | `/transfers` | A→B transfers → folio `TRANSFER` on complete. Filter «with flight» replaces legacy Airport page (`/transfers/airport` redirects). |
| Tours | `/tours` | Group excursions / Nafta weekend roster (HOT-TOUR-01). Boarding-first `TOUR` folio. Spec: [TOURS-NAFTA-OPS.md](./TOURS-NAFTA-OPS.md) |
| Fleet | `/fleet` | TransferVehicle CRUD for tours and transfers |

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

One sidebar section. Groups are nested menus of equal depth. The old flat «НСИ», «Политики», and the separate «Тарифы и цены» section are this tree. Each catalog is one screen (`?tab=`), each policy block is one hash. Row actions on catalogs are icon buttons.

| Group | Item | URL |
|-------|------|-----|
| Property | Profile and letterhead | `/settings/policies#letterhead` |
| Property | Departments | `/settings/departments` |
| Rooms | Room types | `/settings/master-data?tab=roomTypes` |
| Rooms | Rooms | `/settings/master-data?tab=rooms` |
| Rooms | Bed types | `/settings/master-data?tab=beds` |
| Rooms | Room views | `/settings/master-data?tab=views` |
| Rooms | Quota journal | `/settings/master-data?tab=quota` |
| Guest lists | Commercial / Documents / Stay / Notes | `/settings/master-data?tab=lookupCommercial` (and `lookupIdentity`, `lookupStay`, `lookupNotes`) |
| Rates | Rate plans, seasons, package prices, daily prices, BAR, child matrix, components, yield, pricing flags | `/settings/master-data?tab=ratePlans`, `/settings/seasons`, `/settings/package-prices`, `/settings/daily-prices`, `/settings/bar-calendar`, `/settings/child-matrix`, `/settings/pricing-components`, `/settings/yield-rules`, `/settings/policies#pricing` |
| Revenue | Revenue codes | `/settings/master-data?tab=revenue` |
| Revenue | Post to ledger | `/settings/integration?view=gl` |
| House | Cleaning policy / laundry rules / laundry price / minibar catalog | `/settings/policies#hk`, `#laundry`, `/settings/laundry-catalog`, `/settings/stock` |
| Shift rules | Night audit / tours / morning pack | `/settings/policies#night-audit`, `#tours`, `#reports` |
| Access | Users, roles, sign-ins | `/settings/users`, `/settings/access`, `/settings/logins` |
| Exchange | Outbound events, outbound journal, channel links | `/settings/integration`, `?view=journal`, `/admin/links` |
| Service | Audit viewer, import, ops wipe | `/admin/audit`, `/settings/import`, `/settings/ops-wipe` |

`/settings/policies` with no hash still shows every policy card. Channel links and the audit viewer stay on `/admin/*` until those URLs move. Import step titles are translated; file names stay Elektraweb.

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

`/executive`, `/fo/status` (second Əsas item), `/executive/forecast` — decide later; not locked in this wave.

---

### 2.16 Reports — `/reports/*` (canonical home)

SSOT catalog: [`MANAGEMENT-REPORTS-CATALOG.md`](./MANAGEMENT-REPORTS-CATALOG.md) (ElektraWeb WA0058/59 + Nafta samples). **W1 live** — 8 P0 screens + PDF + nightly ZIP; not SHIPPED (no UAT evidence).

**Sidebar:** one Reports section. No «Other» bucket. «All reports» highlights only on `/reports` itself.

| Menu item | URL | Classifier |
|-----------|-----|------------|
| All reports | `/reports` | Shared period, grouped list, PDF + Excel. Old category and slug URLs redirect here |
| Nightly pack | `/reports/nightly-pack` | Eight morning-pack forms for the last closed audit, plus ZIP for that date |
| Occupancy grid | `/reports/occupancy/grid` | Room-type grid, not a catalog slug |
| Booking analytics | `/reports/analytics` | Sources, cancellations, demographics. Not a catalog slug |
| Invoices | `/reports/invoices` | Invoice list. Same Reports section |
| Reconciliation | `/reports/reconciliation` | Night-audit reconciliation. Same Reports section |

Guest dedup lives under Guests (`/reports/guest-dedup`). POS calendar and the souvenir shop are the External systems section after Settings. Finance and Clinic links are still not in the sidebar.

SatAdmin pack membership: `/settings/policies#reports`. Old `/settings/report-pack` redirects.

**One screen → one primary home:** Management PDFs live on `/reports`. Night Audit `/night-audit/reports` is a **deep-link hub** (enabled pack + Download ZIP + NA-only ops grids). Front Cash journal links to the cash report; FO in-house ops list stays `/fo/in-house` and links to `/reports?report=in-house`.

**Not copied:** `.frx` engine; EW Accounting/Stock/POS report menus; Task Cube.

---

## 3. Working-screen → home map

| Work class | Home |
|------------|------|
| Sell / book / stay | Front Office `/fo` |
| Stay pay + café/clinic walk-in + agency CL | Front Cash `/front-cash` |
| Day close / logs / year-end / NA ops grids | Night Audit `/night-audit` |
| Management PDFs / ZIP pack / occupancy analytics | Reports `/reports` |
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

Rates and prices are not a top-level section. They are the Settings → Rates group.  
9. SPA  
10. Transfers  
11. Banquets  
12. Medical  
13. Reports (all reports, nightly pack, occupancy grid, analytics, invoices, reconciliation)  
14. **Schedules** (all weekly duty boards incl. HK roster)  
15. Settings  
16. External systems (POS, souvenir shop)  
17. Əsas — when decided  

---

## 5. Implementation gaps called out by this canon

| Screen | Status (2026-08-07 deepen) | Still later |
|--------|----------------------------|-------------|
| `/front-cash/transactions` | **API** HOT-CASH-06 — day journal for report 05 | Shift Z and method totals are not on this page |
| `/night-audit/reports` + P1 grids | **SHIPPED** HOT-NA-03 — P1 + no-shows / room-moves / VIP + CSV | EW Management PDF catalog + ZIP pack (HOT-RPT-01/02 spec) |
| `/night-audit/reservation-updates` | **SHIPPED** HOT-NA-04 — action filter + CSV | Richer diff / typed events |
| `/night-audit/year-end` | **API** HOT-NA-05 — hotel calendar seal | Finance `closeFiscalYear` stays in finance |
| URL migration FO/HK/Cash/NA/Distribution/Settings | Done (legacy redirects in `next.config`) | Remove redirects when bookmarks migrate |

Readiness: [`MENU-IA-PRIMARY-FILL-AUDIT.md`](./MENU-IA-PRIMARY-FILL-AUDIT.md) · deepen [`MENU-IA-DEEPEN-AUDIT.md`](./MENU-IA-DEEPEN-AUDIT.md).

---

## 6. Consciously not copied into hotel menu

- Invoice / Accounting / Fixed Assets / Purchasing / ERP Stock as hotel modules  
- Full POS / Digital Menu inside hotel sidebar  
- 50+ Management Report tiles as separate sidebar rows (one `/reports` workspace)  
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
| Reports | `/reports/*` |
