# Nafta import — file checklist

Operator checklist for **Nafta** bootstrap. Hotel column is taken from `era-hotel-pms` Elektraweb import wizard (`IMPORT_PHASES` + adapters). Clinic / F&B do **not** have a satellite import module yet — listed as planned / data-only.

**Pack (raw):** `D:\ERA-BACKUP\NAFTA-START\` (`hotel/`, `clinic/`, `hr/`, `1c/`). **Wizard:** `D:\ERA-BACKUP\NAFTA-ERA-READY\`.  
**Start inventory:** [START-DATA-INVENTORY.md](./START-DATA-INVENTORY.md) · **numbered checklist + accountant ask:** [START-FILE-CHECKLIST.md](./START-FILE-CHECKLIST.md).

**Guest policy (locked):** for `Cancelled` / future without stay — import Guest Card only if **complete** (`Guest Id` + Name + Last Name + at least one of Passport / National Id / Phone); otherwise **skip**. See [ELEKTRAWEB-IMPORT.md](./ELEKTRAWEB-IMPORT.md) §15.5.

---

## A. Hotel — Elektraweb wizard (`/admin/import`)

Source of truth: [`src/lib/import/phases.ts`](../src/lib/import/phases.ts), [`adapters/index.ts`](../src/lib/import/adapters/index.ts).

| Order | Entity | File on disk (wizard reads columns, not the EW export name) | Status in `EW` | Notes |
|------:|--------|-------------------------------------------------------------|----------------|-------|
| 10 | `revenue-codes` | `01-Revenue-Codes.xlsx` | [x] | Also optional `db:seed:reference` |
| 11 | `bed-types` | `02-Bed-Types.xlsx` | [x] | |
| 12 | `room-views` | `03-Room-Views.xlsx` | [x] | |
| 20 | `room-types` | `04-Room-Types.xlsx` | [x] | |
| 20.5 | `bar-bootstrap` | *(fileless)* | [x] | Creates empty `BAR` base plan — **not** package prices from PDF |
| 21 | `rate-plans` | `06-Rate-Codes.xlsx` | [x] | EW rate codes; package/FB BAR from PDF is separate feed |
| 22 | `rooms` | `05-Rooms.xlsx` | [x] | Inventory only: `Room No`, `Room Type`, `Floor`, `Bed Type`. EW extras + `Max Bed` (all 0) + `Room State` (HK snapshot) stripped. Capacity from `04` `Max Adult`. |
| 30 | `agencies` | `07-Travel-Agencies.xlsx` | [x] | |
| 31 | `product-cards` | `08-Product-Cards.xlsx` | [x] | SELLABLE |
| 32 | `stock-cards` | `09-Stock-Cards.xlsx` | [x] | STOCK |
| 40 | `guests` | `10-Guest-Cards.merged.xlsx` | [x] | **7 723** EW + **407** FO-only (`wo:fo:{id}`). FO dump stamps passports (`apply-wo-fo-guest-bridge.cjs`). |

| 50 | `reservations` | `11-Reservations.merged.xlsx` | [x] | Cutover 2026-08-17: **6 117** `Res Id` (74 InHouse, 568 Reservation) |
| 60 | `folios` | `12-Folio-Transactions.hotel.xlsx` | [x] | Wizard book: guest stays whose `Res Id` is in `#11`. Rebuild: `node era-hotel-pms/scripts/filter-hotel-folio-only.cjs`. Archive (unfiltered): `12-Folio-Transactions.merged.xlsx` (95 793). **Do not** load `999 FB` (`#16`), Tibb Ambulator, CASH/DEBITOR house ledgers. |

### Hotel — related files (not wizard steps)

| File | Status | Use |
|------|--------|-----|
| `16-FnB-Transactions.merged.xlsx` | [x] | Archive for future FnB — **do not** load as hotel guest folio |
| `17-ProFolio-Transactions.xlsx` | [~] | ROOM-only cross-check |
| `19-Agency-Statement.xlsx` | [~] | Opening AR / city ledger → Finance later |
| `18-Contract-Details.xlsx` | [~] | Reference |
| `20-DO-NOT-IMPORT-Chart-of-Accounts.xlsx` | [ ] | **Excluded** — finance-core |
| `08-Product-Group-List.xlsx` | [~] | Optional grouping |
| `13-Package-Prices-2026.csv` | [x] | Parsed package/FB rates from commercial PDF (seed pricing later) |
| Room-only BAR (RO / no board) | [ ] | **Not sold** commercially. Derived **BAR BB / BAR FB** proposal: [BAR_DERIVED_2026.md](./BAR_DERIVED_2026.md) + `14-BAR-Derived-2026.csv` — confirm with hotel before seeding |
| `15-Hizmet-Tanimlari.xlsx` | [x] | EW SPA/medical services (287). Seed clinic catalog + hotel `SPA MEDIKAL` prices; not a wizard step |
| `hr/37-Employees.xlsx` | [x] | READY `hr/37-Employees.xlsx` (fin, sex, workplace, satellites) + `hr/org-structure.xlsx` → CP Workforce. Import org-structure first. Empty satellites = no login seat. |

---

## A2. Commercial pricing policy (locked — hotel answers 2026-07-14)

Source: sales / front-office WhatsApp answers to package PDF questions. FB boarding confirmed earlier.

| Topic | Rule |
|-------|------|
| Board | **FB only** (3 meals). No room-only sale. HB (2 meals) extremely rare — not a product matrix. |
| Package vs à-la-carte | Package includes **pension board only**, not à-la-carte restaurant. |
| Price unit | **Per person** (`nəfər üçün`). PDF has **single / double** columns — do not ×2 the single rate. |
| Standart paket | Guest **chooses** room category (Standart / Junior / Deluxe / Triple per PDF matrix + season). |
| Premium / Dermo / Detoks | **Independent medical packages** by indication (e.g. Dermo = skin). Hotel **assigns** room; only **Deluxe or Junior** (higher categories). Price is flat package rate — **no** Junior/Deluxe surcharge on top of PDF. |
| Season | Standart: low/high in PDF. Premium / Dermo / Detoks: **no** seasonal split. |
| Children (board) | Under **6**: **1st child free**, **2nd paid**; meals same as adult portions. (Align with PDF child/extra-bed rows when seeding.) |
| Blackout / holidays | **Surcharge** (extra fee), not a different room/board product. |
| Agency / corporate | **FB applies the same** as public package rules. |
| BAR role | **Accounting base** + recommended floor (folio/night-audit split). May be market-dictated; composition `RO + serviceFee×N + meals×N`. See [ADR](../../../docs/adr/hotel-bar-accounting-vs-package-sell.md). |
| Service fee | **6 AZN / person / night** (sell); COGS historically ~5. Versioned setting + history (planned). |
| Extra adult | Only **service fee + meals** (BB +31, FB +81). RO is shared — not doubled. |
| Package sell | **Manual** (sales). **Not required** to equal BAR. Store **cost floor** + **sell** with history/audit (planned). |
| Costing reference | USALI-oriented note in [reference/hotel-costing-and-pricing-usali.md](./reference/hotel-costing-and-pricing-usali.md) (CPOR, floor, future auto-min BAR). |

**PMS implication:** sell SKUs = Standart×roomType×season + Premium/Dermo/Detoks (JR/DLX). BAR calendar = accounting ladder ([BAR_DERIVED_2026.md](./BAR_DERIVED_2026.md)). Folio: split via BAR/components; Σ postings = package/reservation sell.

---

## B. Clinic / sanatorium — WebOnly (`WO`)

**Clinic wizard:** `era-clinic` `/admin/import` — see `NAFTA-ERA-READY/IMPORT-CHECKLIST.md`.  
**Cutover:** 2026-08-25 · **WO dump refreshed:** 2026-08-25.

| Dataset | File(s) | Status | Rows / notes |
|---------|---------|--------|--------------|
| Appointments | `clinic/dump/calendar/reservations-all.json` | [x] | **61 155** (2026-08-25). READY `#23` = **2373** ops (25–29 Aug) |
| Guests / patients | `clinic/dump/cards/` + `bulk/patients.json` | [x] | **1665** full archive |
| Procedures catalog | `clinic/reports/01-procedures.xlsx` (SSOT) → READY `#25` | [x] | **80** curated (WO ref 154) |
| Procedure requirements | READY `40-Procedure-Requirements.xlsx` | [x] | **126** LOCATION rows |
| Rooms / cabins | READY `26-Rooms.xlsx` | [x] | **63** (Kabina 14 for history) |
| Doctors | `27-practitioners-roster.json` → READY `#27` | [x] | **8** clinical roster |
| Shifts | `clinic/catalogs/28-Shifts.csv` | [x] | Ref only — not in ERA-READY |
| Analyses | READY `29-Analyses.xlsx` | [x] | **58** |
| Laboratory | `clinic/catalogs/30-Laboratory.xlsx` | [x] | Ref only — not in ERA-READY |
| Diagnostics / Diagnoses | READY `#31` / `#32` | [x] | 370 / 372 |
| Quotas / lab results | READY `#38` / `#39` | [x] | 8778 / 22620 |
| Check-ups / products | `clinic/catalogs/33–36` | [x] | Ref only |
| **API card dump** | `clinic/dump/` | [x] | `dump-webonly-patient-cards.cjs`. **Do not commit.** |
| **API procedure calendar** | `clinic/dump/calendar/` | [x] | `dump-webonly-clinic-calendar.cjs`. **Do not commit.** |
| **WO FO guest cards** | `hotel/dump/guest-cards.json` | [x] | UI `/en/dashboard/frontoffice/guestcard` → `dump-webonly-fo-guest-cards.cjs` (Bearer). **1 598** cards, passport+DOB on all. Match vs EW: `match-wo-fo-ew-guests.cjs`. Not a wizard step. |
| Curated mirror | `clinic/reports/era-import/` | [x] | `#25`, `#26`, `#40` + `manifest.json` |

---

## C. F&B — `era-fnb-pos`

**No FnB import wizard yet.** Needed for full track:

| Dataset | Status | Notes |
|---------|--------|-------|
| Menu (outlet + PLU) | [ ] | Not in EW/WO packs |
| Recipes / tech cards | [ ] | |
| Historical tickets / Z-shifts | [ ] | Optional Phase 1 |
| EW `999 FB` folio house ledger | [x] file | Use as revenue archive / reconciliation — not menu seed |

---

## D. Suggested load order (when all wizards exist)

1. Hotel dictionaries → master → BAR bootstrap → rates/rooms/agencies/products  
2. Hotel guests → reservations → folios  
3. Clinic patients → procedures / randevu (when built)  
4. FnB menu → recipes → (optional) tickets  

Package prices from `NAFTA_PRICE_PACKAGES_2026_rows.csv` overlay rate plans / medical packages after master data — they are **FB package** rates, not room-only.

---

## E. Hotel package → clinic procedures (required bridge)

Commercial package on the hotel reservation is **not** just a folio price. Selecting a medical package must drive **clinic scheduling**: the matching procedure quotas for that package and stay length, planned inside the package period.

| Side | What | How today |
|------|------|-----------|
| **Hotel** | Rate plan = package (e.g. Standart / Premium / Dermo / Detoks) | `RatePlan.medicalFlag=true`; night posts via `RatePlanPackageLine` (SAN-PKG); check-in/lifecycle sends `programCode` (= rate plan `code`) to clinic |
| **Clinic** | Program template = inclusion list | `ProgramTemplate` + lines (`procedureCode`, `quotaTotal`); `instantiateProgramFromTemplate` → FIFO schedule over `startsOn`…`endsOn` |
| **Trigger** | When slots appear | Setting `programSchedulingMode`: `ON_CHECKIN` (auto) or `AFTER_CHECKUP` (Nafta default — after complaint/ICD) |
| **Price CSV** | Source of quotas | Rows `section=package_inclusion` in `NAFTA_PRICE_PACKAGES_2026_rows.csv`: package × **nights** × procedure × **qty** → seed `ProgramTemplate` (one template per package×duration, e.g. `STANDART-7`, or stay-length lookup) |

**Import rule:** seed hotel medical rate plans and clinic program templates **from the same package codes** before cutover stays; otherwise check-in opens an episode with no schedule. Clinic Excel import for historical `Randevular` is separate (past appointments); **forward** scheduling for new stays comes from templates above, not from WO dumps.

**Over-quota:** completion beyond `quotaTotal` → charge hotel folio (included stays are audit-only / no double sell). See ADR [sanatorium-vnext.md](../../../docs/adr/sanatorium-vnext.md) **SV11**.
