# Nafta contour — start data inventory

**Cutover snapshot:** 2026-08-25 (clinic ops week 25–30 Aug)  
**Previous EW hotel export:** 2026-08-17 · **Guest Cards overlay:** 2026-08-28  
**Pack (raw):** `D:\ERA-BACKUP\NAFTA-START\` (`hotel/` Elektraweb, `clinic/dump|catalogs` WebOnly, `hr/`, `1c/`). **Wizard books:** `D:\ERA-BACKUP\NAFTA-ERA-READY\`. Numbered names: [START-FILE-CHECKLIST.md](./START-FILE-CHECKLIST.md).  
**Delta after Excel:** Elektraweb browser plugin ([ELEKTRAWEB-LIVE-BRIDGE.md](../ELEKTRAWEB-LIVE-BRIDGE.md)).  
**Wizard file names:** [IMPORT_FILE_CHECKLIST.md](./IMPORT_FILE_CHECKLIST.md).  
**Numbered file checklist + accountant ask:** [START-FILE-CHECKLIST.md](./START-FILE-CHECKLIST.md) (working copy: `D:\ERA-BACKUP\NAFTA-START\CHECKLIST.md`).

Status: **HAVE** = file on disk · **PARTIAL** = have a slice / need refresh · **ASK** = request from source · **LATER** = not required to open ops contour.

---

## 0. What “start” means

| Wave | Goal | 1C required? |
|------|------|----------------|
| **Ops start** | Hotel FO + clinic + F&B can take in-house / walk-in | No. Folio is money SoT ([NAFTA_SANATORIUM_UAT.md](../../../docs/NAFTA_SANATORIUM_UAT.md) §5) |
| **Finance go-live** | GL opening, AR/AP, cash, stock valuation | Yes — accountant pack below |
| **After go-live** | New EW rows | Plugin, not another Excel merge |

Do **not** replay 2024–2025 hotel history. Import 2026+ stays + in-house/future at hour X.

---

## 1. Hotel PMS — Elektraweb → `era-hotel-pms`

Upload via `/admin/import` unless noted.

| Data | File | Source | Put in | Status |
|------|------|--------|--------|--------|
| Revenue codes | `hotel/01-Revenue-Codes.xlsx` | EW | Hotel wizard `revenue-codes` | HAVE |
| Bed types | `hotel/02-Bed-Types.xlsx` | EW | Hotel wizard | HAVE |
| Room views | `hotel/03-Room-Views.xlsx` | EW | Hotel wizard | HAVE |
| Room types | `hotel/04-Room-Types.xlsx` | EW | Hotel wizard | HAVE |
| Rooms | `hotel/05-Rooms.xlsx` | EW | Hotel wizard | HAVE. Wizard book: 78 rooms, 4 columns (`Room No`, `Room Type`, `Floor`, `Bed Type`). Dropped EW hardware/HK extras; `Max Bed` was all 0 (would break share); `Room State` was export-day Dirty/Clean, not inventory. |
| Rate codes | `hotel/06-Rate-Codes.xlsx` | EW | Hotel wizard | HAVE |
| Travel agencies | `hotel/07-Travel-Agencies.xlsx` | EW | Hotel wizard | HAVE |
| Product cards (sellable) | `hotel/08-Product-Cards.xlsx` | EW | Hotel wizard | HAVE |
| Stock cards | `hotel/09-Stock-Cards.xlsx` | EW | Hotel wizard | HAVE |
| Guest registry | `hotel/10-Guest-Cards.merged.xlsx` (7 723) | EW | Hotel wizard `guests` + MDM link | HAVE. Overlay **2026-08-28** 900-row export: 0 new `Guest Id`; cell-fill 69 cards. Merge had stripped Excel date formats to serials; **rewritten as date cells** (START + READY). Summary JSON: `10-Guest-Cards.merged.summary.json`. |
| Reservations / FOCP | `hotel/11-Reservations.merged.xlsx` (6 117; 74 InHouse, 568 future) | EW | Hotel wizard `reservations` | HAVE. Filter 2026+ or active |
| Folio lines | `hotel/12-Folio-Transactions.merged.xlsx` (95 793 hotel) | EW | Hotel wizard `folios` | HAVE through 2026-08-17. Load **open / in-house** at hour X, not full archive |
| Package / FB sell prices | `hotel/13-Package-Prices-2026.csv` | Commercial PDF (parsed) | Hotel rate plans + clinic `ProgramTemplate` | HAVE |
| BAR ladder (accounting) | `hotel/14-BAR-Derived-2026.csv` | Derived | Hotel BAR calendar | HAVE — confirm with hotel before seed |
| Agency / city ledger | `hotel/19-Agency-Statement.xlsx` | EW | Finance AR later (not hotel wizard) | PARTIAL (15.06, not cutover date) |
| Guest deposits / open folio | In-house rows in Reservations + open Folio lines | EW | Hotel folio | HAVE at 17.08; refresh via plugin at hour X |
| ProFolio (ROOM-only) | `hotel/17-ProFolio-Transactions.xlsx` | EW | Cross-check only | HAVE — do not upload as folios |
| Chart of Accounts | `hotel/20-DO-NOT-IMPORT-Chart-of-Accounts.xlsx` | EW | — | Skip. Finance CoA ≠ EW |
| Contracts | `hotel/18-Contract-Details.xlsx` | EW | Reference | HAVE |
| SPA / medical service catalog | `hotel/15-Hizmet-Tanimlari.xlsx` (EW 2026-08-21; all `SPA MEDIKAL`) | EW Hizmet Tanımları | Hotel folio `SPA MEDIKAL`. **Not** clinic `01-procedures` / WO #25. Match extra charges by name | HAVE |

---

## 2. Clinic / sanatorium — WebOnly → `era-clinic`

No Excel wizard yet. Load via upcoming `nafta-clinic:*` import or seed scripts. API dump is the card/calendar SoT for cutover.

| Data | File / dump | Source | Put in | Status |
|------|-------------|--------|--------|--------|
| Patient cards (interior) | `clinic/dump/cards/` (1 665) + `bulk/patients.json` | WO API **2026-08-25** | Clinic `PatientRef` + forms / pain / body parts | HAVE — full archive |
| Doctor forms + diagnoses | `clinic/dump/bulk/examination-forms.json` (311) | WO API | Clinic episode / anamnesis | HAVE |
| Procedure calendar | `clinic/dump/calendar/reservations-all.json` (61 155; refreshed 2026-08-25) | WO API `/clinic/clinic` | Clinic `ProcedureOrder` / bookings | HAVE — READY #23 = 2373 ops slots (25–29 Aug) |
| Lab orders + files | `clinic/dump/bulk/lab-tests.json`, `clinic/dump/files/lab/` | WO API | Clinic lab | HAVE — #24 2153; ~170 without Word ignored |
| Procedure catalog | **`clinic/reports/01-procedures.xlsx`** (SSOT 81→80) · ref WO dump 154 | Curated + WO | Clinic planner = READY **#25** only | HAVE |
| Procedure → cabinet rules | `40-Procedure-Requirements.xlsx` (126 rows) | SSOT cabinets | Future FIFO placement (`placeConfirmedProcedures`) | HAVE |
| Rooms / cabins | READY `26-Rooms.xlsx` (63; incl. Kabina 14 history) | SSOT + calendar | Clinic resources | HAVE |
| Doctors | `27-practitioners-roster.json` → READY `27-Doctors.xlsx` (8) | Roster + HR | Clinic practitioners + CP hire | HAVE |
| Shifts | `clinic/catalogs/28-Shifts.csv` + dump | WO | Ref only — **not** in ERA-READY | HAVE ref |
| Analyses / lab / USG / check-ups | READY #29–#39; catalogs 33–36 ref | WO **2026-08-25** | Clinic wizard | HAVE |
| Package inclusions | `NAFTA_PRICE_PACKAGES_2026_rows.csv` `package_inclusion` | PDF | Clinic `ProgramTemplate` | HAVE — seed **before** in-house check-in |
| Procedure consumable norms | `1c/53-1C-Procedure-Consumables.xlsx` | 1C | Clinic / Retail — норма на сеанс | **ASK** |
| Pharmacy / med warehouse stock | `1c/52-1C-Pharmacy-Stock.xlsx` | 1C сч. 10 | `era-retail-pos` pharmacy | **ASK** |

---

## 3. F&B — `era-fnb-pos`

| Data | File | Source | Put in | Status |
|------|------|--------|--------|--------|
| House / walk-in POS ledger | `hotel/16-FnB-Transactions.merged.xlsx` (22 219) | EW folio split | Reconciliation only — **not** menu seed | HAVE |
| Menu + PLU by outlet | — | 1C or F&B manager | FnB outlets | **ASK** — blocks F&B start |
| Recipes / TTK (brutto/netto, yield) | — | 1C or chef | FnB recipes | **ASK** — needed for cost; POS can start on PLU-only |
| F&B stock by warehouse | — | 1C сч. 10/41/43 | FnB stock | **ASK** for valued stock; ops can start at zero + count |
| Retail price list (restaurant, lobby, RS) | — | 1C / current menu | FnB prices | **ASK** |
| Historical Z / tickets | — | EW 999 FB archive | Optional | LATER |

---

## 4. Finance + orchestrator — 1C / CP

Ops contour **starts without** these. Request for Finance go-live (Gemini pack, trimmed to what ERA actually posts).

| Data | What to ask 1C | Put in | Status |
|------|----------------|--------|--------|
| Counterparties | Name, VÖEN, bank, role (supplier / legal / OTA / person), contracts | Finance CRM counterparties + Hotel agencies overlay | **ASK**. EW agencies cover hotel OTAs only |
| Trial balance (ОСВ) | All GL accounts + subaccounts at cutover date | Finance opening journals | **ASK** — not Phase-1 UAT |
| AR/AP (60, 62, 76) | Counterparty → contract → source doc → debit/credit | Finance AR/AP. Hotel city ledger = agencies | **ASK**. EW `Agency Statement` is a stale hint |
| Cash (50, 51, 57) | Each till, IBAN, acquiring-in-transit | Finance cash / banks | **ASK** |
| Employees | `hr/37-Employees.xlsx` (126; FİN + dept + title) | Orchestrator Workforce → satellite logins. Clinic doctors still bind to WO API (6) | HAVE. No tab number / MOL / email — hire in CP by FİN |
| Fixed assets (01, 02, МЦ.04) | `1c/50-1C-Fixed-Assets.xlsx` (ƏV.xlsx / Əsas Vəsait; was mislabeled #49 VAT) | Finance FA | HAVE — review columns; VAT (#49) still missing |
| Housekeeping / linen / cosmetics stock | Сч. 10 by storage → `1c/51-1C-Housekeeping-Stock.xlsx` | Finance / hotel stock | **ASK** |
| CoA mapping | 1C account → ERA revenue/expense | Finance | **ASK** when posting starts. Ignore EW Chart of Accounts |

---

## 5. Gemini 1C list — keep / drop / later

| Gemini item | Verdict |
|-------------|---------|
| Контрагенты | Keep — Finance go-live |
| ОСВ | Keep — Finance go-live, not ops start |
| ДЗ/КЗ 60/62/76 | Keep — Finance go-live |
| Деньги 50/51/57 | Keep — Finance go-live |
| Номенклатура F&B | Keep — **ops start for restaurant** |
| ТТК | Keep — cost; POS can open on PLU without TTK |
| Остатки ТМЦ F&B | Keep — valued stock; or physical count on day 1 |
| Прейскурант / меню | Keep — **ops start for restaurant** |
| Каталог мед. услуг | Drop from 1C request — already in WO API |
| Пакетные программы | Drop from 1C — already in price-package CSV |
| Нормы списания на процедуры | Keep — **ASK** (`53-1C-Procedure-Consumables.xlsx`) |
| Остатки аптеки | Keep — **ASK** (`52-1C-Pharmacy-Stock.xlsx`) |
| Номерной фонд | Drop from 1C — already in EW `05-Rooms.xlsx` |
| Тарифы проживания | Drop from 1C — EW + PDF CSV |
| Реестр авансов гостей | Drop from 1C — EW open folio / FOCP |
| Хоз. склад / бельё | Keep — **ASK** (`51-1C-Housekeeping-Stock.xlsx`) |
| ОС и инвентарь | Keep — **ASK** (`50-1C-Fixed-Assets.xlsx`) |
| Сотрудники | Have Excel (126, FİN). Still ask 1C only if tab number / MOL / hire date needed |

**Accountant request (short):** counterparties; ОСВ; AR/AP 60/62/76; cash 50/51/57; F&B nomenclature + menu prices; F&B stock; TTK if they exist; fixed assets; housekeeping stock; pharmacy stock; procedure consumable norms. Do **not** ask 1C for rooms, hotel rates, medical catalog, guest deposits, or the staff roster (Excel already delivered).

---

## 6. Load order (ops start)

1. Orchestrator: org + Clinic/F&B departments + satellite endpoints + SSO.  
2. Hotel wizard: dictionaries → rooms/rates → agencies → guests → 2026+/active reservations → **open** folios. Seed package prices + BAR.  
3. Clinic: catalogs + program templates from the **same** package codes → patients/cards → calendar (or wait for in-house check-in to instantiate).  
4. F&B: menu/PLU (when received) → optional recipes/stock.  
5. Plugin: EW delta until hour X.  
6. Finance: 1C pack when accountant delivers — not on the critical path for reception/clinic.

---

## 7. Still missing for a honest ops start

| Gap | Who | Blocks |
|-----|-----|--------|
| F&B menu + prices | Accountant / F&B manager | Restaurant POS |
| F&B stock (or day-1 count) | Accountant / storekeeper | Costed inventory; not ticket sales |
| Fixed assets + housekeeping + pharmacy stock + procedure norms | Accountant | Finance FA, hotel HK stock, retail pharmacy, clinic consumable write-off |
| Staff emails / MOL / tab numbers | HR if CP hire needs more than FİN | Optional — list already has name + FİN + dept |
| Fresh Guest Cards export if >1000 new since 18.07 | Reception (EW) | New guests not in merge — else plugin |
| Agency statement **as of hour X** | EW or 1C | City ledger opening (Finance) |
