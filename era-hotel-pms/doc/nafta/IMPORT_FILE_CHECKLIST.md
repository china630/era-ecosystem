# Nafta import — file checklist

Operator checklist for **Nafta** bootstrap. Hotel column is taken from `era-hotel-pms` Elektraweb import wizard (`IMPORT_PHASES` + adapters). Clinic / F&B do **not** have a satellite import module yet — listed as planned / data-only.

**Folders:** `Downloads/EW` (Elektraweb), `Downloads/WO` (WebOnly clinic).

**Guest policy (locked):** for `Cancelled` / future without stay — import Guest Card only if **complete** (`Guest Id` + Name + Last Name + at least one of Passport / National Id / Phone); otherwise **skip**. See [ELEKTRAWEB-IMPORT.md](./ELEKTRAWEB-IMPORT.md) §15.5.

---

## A. Hotel — Elektraweb wizard (`/admin/import`)

Source of truth: [`src/lib/import/phases.ts`](../src/lib/import/phases.ts), [`adapters/index.ts`](../src/lib/import/adapters/index.ts).

| Order | Entity | Template / file | Status in `EW` | Notes |
|------:|--------|-----------------|----------------|-------|
| 10 | `revenue-codes` | Revenue Code Definitions.xlsx | [x] | Also optional `db:seed:reference` |
| 11 | `bed-types` | Bed Type.xlsx | [x] | |
| 12 | `room-views` | Room Views.xlsx | [x] | |
| 20 | `room-types` | Room Types.xlsx | [x] | |
| 20.5 | `bar-bootstrap` | *(fileless)* | [x] | Creates empty `BAR` base plan — **not** package prices from PDF |
| 21 | `rate-plans` | Rate Codes.xlsx | [x] | EW rate codes; package/FB BAR from PDF is separate feed |
| 22 | `rooms` | Rooms.xlsx | [x] | |
| 30 | `agencies` | Travel Agencies.xlsx | [x] | |
| 31 | `product-cards` | Product Cards.xlsx | [x] | SELLABLE |
| 32 | `stock-cards` | Stock Cards.xlsx | [x] | STOCK |
| 40 | `guests` | Guest Cards → use **Guest Cards.merged.xlsx** | [x] | Wizard hint `Guests.xlsx`; same schema |
| 50 | `reservations` | Reservations → **Reservations.merged.xlsx** | [x] | Prefer 2026+ / active at cutover |
| 60 | `folios` | Folio → **Folio Transactions.merged.xlsx** | [x] | Not `Folios.xlsx` toy snapshot; not FnB house file |

### Hotel — related files (not wizard steps)

| File | Status | Use |
|------|--------|-----|
| FnB Transactions.merged.xlsx | [x] | Archive for future FnB — **do not** load as hotel guest folio |
| ProFolio Transactions.xlsx | [~] | ROOM-only cross-check |
| Agency Statement 2026.06.15.xlsx | [~] | Opening AR / city ledger → Finance later |
| Contract Details.xlsx | [~] | Reference |
| Chart of Accounts.xlsx | [ ] | **Excluded** — finance-core |
| Product Group List.xlsx | [~] | Optional grouping |
| NAFTA_PRICE_PACKAGES_2026_rows.csv | [x] | Parsed package/FB rates from commercial PDF (seed pricing later) |
| Room-only BAR (RO / no board) | [ ] | **Not sold** commercially. Derived **BAR BB / BAR FB** proposal: [BAR_DERIVED_2026.md](./BAR_DERIVED_2026.md) + `BAR_DERIVED_2026_rows.csv` — confirm with hotel before seeding |

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

**No `era-clinic` Excel import wizard yet.** Collect for upcoming idempotent import (`nafta-clinic:*` per [NAFTA_SANATORIUM_UAT.md](../../docs/NAFTA_SANATORIUM_UAT.md)).

| Dataset | File(s) | Status | Notes |
|---------|---------|--------|-------|
| Appointments | Randevular.merged.xlsx | [x] | 2026-02-17 … 2026-07-14; gaps e.g. 21.06 / 05.07 / 12.07 |
| Guests / patients | guests_2026-06-13_01-18.xlsx | [x] | Link to hotel Guest via passport |
| Procedures catalog | Mualiceler_2026-06-13.xlsx | [x] | |
| Rooms / cabins | rooms.xlsx | [x] | |
| Doctors | hekimler.csv | [x] | |
| Shifts | novbeler.csv | [x] | |
| Analyses | analizler.csv, Laboratory_*.xlsx | [x] | |
| Diagnostics | Diagnostics_*.xlsx, diagnoses.xlsx | [x] | |
| Check-ups | CheckUps_*.xlsx, CheckDetails_*.xlsx | [x] | |
| Product groups / products | product-groups-*.xlsx, products.csv | [x] | |
| PDF dumps | patients.pdf, patient-profile.pdf | [~] | Human reference only |

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
