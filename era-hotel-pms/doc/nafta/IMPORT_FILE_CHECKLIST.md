# Nafta import — file checklist

Operator checklist for **Nafta** bootstrap. Hotel column is taken from `era-hotel-pms` Elektraweb import wizard (`IMPORT_PHASES` + adapters). Clinic wizard: `era-clinic` `/admin/import`. F&B wizard: `era-fnb-pos` `/admin/import` (`#30`–`#32`). Retail wizard: `era-retail-pos` `/admin/import` (`#33`).

**Pack (raw):** `D:\ERA-BACKUP\NAFTA-START\` (`hotel/`, `clinic/`, `hr/`, `1c/`). **Wizard:** `D:\ERA-BACKUP\NAFTA-ERA-READY\`.  
**Start inventory:** [START-DATA-INVENTORY.md](./START-DATA-INVENTORY.md) · **numbered checklist + accountant ask:** [START-FILE-CHECKLIST.md](./START-FILE-CHECKLIST.md).

**Guest policy (locked):** for `Cancelled` / future without stay — import Guest Card only if **complete** (`Guest Id` + Name + Last Name + at least one of Passport / National Id / Phone); otherwise **skip**. See [ELEKTRAWEB-IMPORT.md](./ELEKTRAWEB-IMPORT.md) §15.5.

---

## A. Hotel — Elektraweb wizard (`/admin/import`)

Source of truth: [`src/lib/import/phases.ts`](../src/lib/import/phases.ts), [`adapters/index.ts`](../src/lib/import/adapters/index.ts).

| Order | Entity | File on disk | Status | Notes |
|------:|--------|--------------|--------|-------|
| 3 | `revenue-codes` | `03-Revenue-Codes.xlsx` | [x] | Also optional `db:seed:reference` |
| 4 | `bed-types` | `04-Bed-Types.xlsx` | [x] | |
| 5 | `room-views` | `05-Room-Views.xlsx` | [x] | |
| 6 | `room-types` | `06-Room-Types.xlsx` | [x] | |
| 7 | `rate-plans` | `07-Rate-Codes.xlsx` | [x] | EW Rate Codes |
| 8 | `rooms` | `08-Rooms.xlsx` | [x] | Inventory only: `Room No`, `Room Type`, `Floor`, `Bed Type`. |
| 9 | `agencies` | `09-Travel-Agencies.xlsx` | [x] | |
| 10 | `guests` | `10-Guest-Cards.xlsx` | [x] | **8 782** after August overlay + FO-only `wo:fo:{id}`. |
| 11 | `reservations` | `11-Reservations.xlsx` | [x] | **6 158** `Res Id` (August FOCP overlay + 41 new) |
| 12 | `reservation-notes` | `12-Reservation-Notes.xlsx` | [x] | YTD EW Notes → matched Res Id (skip Channel / empty type). 1 225 packed rows. |
| 13 | `folios` | `hotel/13-folio-parts/13-Folio-p01.xlsx` … | [x] | Чанки Apply. Archive START `13-Folio-Transactions.merged.xlsx`. Splitter input: START `13-Folio-Transactions.hotel.xlsx`. |
| 14 | `package-sell` | `14-Package-Sell-2026.xlsx` | [x] | After folios. Desk sell from PDF (not EW). Adapter skips `desk=N`. **Extra bed:** Standart **96 AZN**, other packages **48** (half, rounded). |
| 15 | `agency-statement` | `15-Agency-Statement.xlsx` | [x] | EW **Agency Statement** 2026-08-31. **Hotel FO city ledger**, not 1C. Remaining > 0 → AGENCY folio (`ew:agency-stmt:{ResId}`). Skip Remaining ≤ 0. Missing reservation = per-row error. |

### Hotel — related files (not hotel wizard)

| File | Status | Use |
|------|--------|-----|
| `fnb/32-FnB-Transactions.xlsx` | [x] | **8 559** walk-in POS (`merge-fnb-2026.cjs`: `START/fnb/_source/ew-2026-999-fb` Jan–3 Jul + `ew-2026-xudmani` CASH FOLIO Jul–Aug). Named Xudmani in-house extras go to hotel `#13`. **Apply on F&B** `/admin/import` entity `fnb-transactions` — **not** hotel guest folio |
| `fnb/30-Product-Group-List.xlsx` + `31-Product-Cards.xlsx` | [x] | EW 31.08 groups + 200 cards. Empty `Ürün Kodu` stamped `ERA-FNB-{Id}` until 1C. **Apply on F&B** `/admin/import` (`product-groups` → `product-cards`). **Not** on hotel `/settings/import`. |
| `retail/33-Stock-Cards.xlsx` | [x] | Retail (naftalan shop), not pharmacy 1C. **Apply on Retail** `/admin/import` entity `stock-cards`. Empty code → `ERA-STK-{Id}`. **Not** on hotel `/settings/import`. |
| `hotel/15-Agency-Statement.xlsx` | [x] | EW Agency Statement **2026-08-31** (518 Res Id / 256 Remaining > 0). **Hotel wizard** `agency-statement` — FO AGENCY folio city ledger. **Not** 1C AR/AP (`#39` still ASK). |
| `hotel/_not-ready/` | [x] | BAR, ProFolio, Contract, EW CoA — not Apply |
| `hotel/14-Package-Prices-2026.csv` | [x] | START source for READY `#14` + clinic `#23` |
| `hotel/_not-ready/15-Hizmet-Tanimlari.source.xlsx` | [x] | EW **Hizmet Tanımları** — archive only. Not clinic Apply. Package inclusions are not tariffed; do not clone 0 AZN extras. |
| `hr/01-Org-Structure.xlsx` + `hr/02-Employees.xlsx` | [x] | CP Workforce. Org first. |

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

**Clinic wizard:** `era-clinic` `/admin/import` — pack-layout `#16`–`#29`. See `NAFTA-ERA-READY/IMPORT-CHECKLIST.md`. Re-Apply `#26` / `#27` / `#29` stamps `clinicalEpisodeId` on existing procedure/lab/USG rows (no clinic wipe).  
**Cutover:** 2026-08-25 · **WO dump refreshed:** 2026-08-30.

| Dataset | File(s) | Status | Rows / notes |
|---------|---------|--------|--------------|
| Appointments | `clinic/dump/calendar/reservations-all.json` | [x] | **62 166** dump → READY `#26` **60 480 COMPLETED** only (`importedHistorical`). 1 169 WO SCHEDULED held off the matrix (quota leftover on `#25`; forward plan from `#23`). 517 WO-TR not in curated `#19` dropped. |
| Physio sites | seed `prisma/seed-data/base/physio-zones-s.json` + Nafta overlay → READY `#17` | [x] | **31** zones. Wizard book for appliance; live SoR remains `npx tsx prisma/seed-physio-catalog.ts` / `/admin/physio-sites` |
| Program templates | START `hotel/14-Package-Prices-2026.csv` → READY `#23` | [x] | **233** knots, PKG-STANDART / PREMIUM / DERMO / DETOKS. Not physio-seed |
| Guests / patients | `clinic/dump/cards/` + `bulk/patients.json` | [x] | **1722** full archive |
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
| **WO FO guest cards** | `hotel/dump/guest-cards.json` | [x] | UI `/en/dashboard/frontoffice/guestcard` → `dump-webonly-fo-guest-cards.cjs` (Bearer). **1 608** cards, passport+DOB on all. Match vs EW: `match-wo-fo-ew-guests.cjs`. Not a wizard step. |
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
| **Hotel** | Commercial medical SKU from Extra Req / agency (`PKG-STANDART`…) — **not** EW Rate Code | Wave A dual-run: `resolveMedicalSku` → `ReservationGuest.medicalPackageCode`; check-in sends resolved `programCode` (or omit if unresolved). FO cheat-sheet: [ERA-PKG-FO-CHEATSHEET.md](./ERA-PKG-FO-CHEATSHEET.md). Import entity `reservation-notes`. |
| **Clinic** | Always open episode; staff Select if hotel omitted | Templates `PKG-STANDART` / `PREMIUM` / `DERMO` / `DETOKS`; `programSchedulingMode=AFTER_CHECKUP` (Nafta — no auto-instantiate on check-in) |
| **Trigger** | When slots appear | After checkup complete + doctor confirm (Wave C); not ON_CHECKIN for Nafta |
| **Price CSV** | Source of quotas (Wave B knots) | Rows `section=package_inclusion` → `ProgramTemplateQuotaKnot` / procedure lines |

**Import rule:** seed hotel medical rate plans and clinic program templates **from the same package codes** before cutover stays; otherwise check-in opens an episode with no schedule. Clinic Excel import for historical `Randevular` is separate (past appointments); **forward** scheduling for new stays comes from templates above, not from WO dumps.

**Over-quota:** completion beyond `quotaTotal` → charge hotel folio (included stays are audit-only / no double sell). See ADR [sanatorium-vnext.md](../../../docs/adr/sanatorium-vnext.md) **SV11**.
