# Hotel management reports catalog

**Status:** W1–W3 API/SCREEN (catalog hubs + P0 ZIP pack + P1 remaining slugs + pivot cubes + 3-year + email ZIP link HEADLESS; not SHIPPED — no UAT evidence). Samples: `D:\ERA-BACKUP\REPORTS` (Nafta Sanatorium, HOTELID **31606**, business date **16.08.2026**).  
**ElektraWeb screens:** WA0058 (PDF tile grid) · WA0059 (analysis + shared date filter).  
**Coverage:** `HOT-RPT-01` catalog/hub · `HOT-RPT-02` nightly pack + ZIP.  
**Menu IA:** [`MENU-IA-CANON.md`](./MENU-IA-CANON.md) §2.16.  
**Clone-spec:** [`clone-spec/07-night-audit-and-reports.md`](./clone-spec/07-night-audit-and-reports.md) Part B.

This catalog is the SSOT for **Management Reports** (EW module). Other EW sidebars (Daily Control, Invoice, Accounting, Stock, POS, Group Hotel) are **out of this document**.

Do **not** claim ElektraWeb 01–22 archive parity, FastReport `.frx` parity, or cube OLAP parity from this spec alone.

---

## 1. Product rules

1. **Home is Reports.** Canonical URLs live under `/reports/*`. Night Audit, Front Cash, and FO **link** here; they do not own a second catalog.
2. **Classifier = submenu.** Categories A0–E below are the Reports sub-menu, not a flat list of 50 tiles.
3. **One report, one slug.** Variants (Brüt/NET, AZN/EUR, List/Summary, YoY) are flags on the same slug, not extra menu rows.
4. **Screen first, PDF export second.** Live grid/chart on `/reports/...`; PDF is a snapshot of that query. FastReport `.frx` is **not** ported.
5. **Cubes (Revenue / Folio / Agency Sales / Reservation / Task) are P2.** Nafta P0 is screen + PDF + nightly ZIP, not OLAP.
6. **Ops numbers stay in hotel PMS.** Trial balance / department revenues / FO cash for GM morning pack are PMS. Finance owns GL / month close / tax after NA handoff (`docs/HOSPITALITY_FINANCE_BOUNDARY.md`).
7. **Empty is valid.** Example: `TransferredDepartmentTotals.pdf` had no rows for the sample day — show empty state, not an error.

---

## 2. Shared filter bar (WA0059)

Every report screen uses one toolbar (kit `EraListFilterBar` + `DatePicker`).

| EW control | ERA |
|------------|-----|
| Start / End Date | `from` / `to` (`DatePicker`) |
| Period presets | `PeriodPreset`: Default · Today · Yesterday · Tomorrow · This Week · This Month · Last Month · This Year · Last Year |
| Default | Report `date_mode` (see §3) applied to current **business date** |
| Pdf / Frx | Drop. Button **Export PDF** on SCREEN reports |

Presets rewrite `from`/`to`; they do not bypass `date_mode` semantics for nightly ZIP (pack uses closed NA date, not wall clock).

---

## 3. Date modes

Used by the catalog and by the nightly pack.

| Mode | Meaning |
|------|---------|
| `business_date` | Closed night-audit date **inclusive** (the day just closed). |
| `month_to_closed` | 1st of that month → closed date inclusive (day column + month total). |
| `year_to_closed` | 1 Jan of that year → closed date inclusive (YTD). |
| `range` | User `from`/`to` (ad-hoc). |

Nafta answers (2026-08-19): Monthly and Daily Analysis = through closed date inclusive; Annual Occupancy = current calendar year through closed date.

---

## 4. Delivery and phase

| Delivery | Meaning |
|----------|---------|
| `SCREEN` | Interactive page (table / chart). |
| `PDF` | Printable snapshot (A4 landscape unless noted). |
| `BOTH` | Screen + PDF export of the same query. |

| Phase | Meaning |
|-------|---------|
| **P0** | Nafta nightly pack + reports needed to produce it. |
| **P1** | Rest of Management PDF/screens used by GM/revenue without OLAP. |
| **P2** | Cubes, 3-year graphs, custom management, email sender (WA0345). |

---

## 5. Reports menu IA

Primary home: sidebar **Reports** (`/reports`). Keep the sidebar short: **category hubs**, not 50 rows.

```
Reports                         /reports                    hub + filter + category tiles
├── Analysis                    /reports/analysis           A0 SCREEN
├── Occupancy                   /reports/occupancy          A  (existing grid stays; more slugs as children)
├── Daily flash                 /reports/daily              B
├── Financial                   /reports/financial          C
├── Agency & market             /reports/agency             D  (agency-profitability lives here)
├── Reservations & CRM          /reports/booking            E
└── Nightly pack                /reports/nightly-pack       configured ZIP for closed date
```

SatAdmin pack membership: `/settings/report-pack` (not a Reports sidebar row).

### 5.1 Deep links (not a second catalog)

| From | Link |
|------|------|
| Night Audit → EOD reports | `/night-audit/reports` shows **enabled pack members** for the closed date + **Download ZIP**. Each row opens the canonical `/reports/...` slug. Ops grids that are **not** Management Reports (cancelled today, room moves, VIP, reservation updates, EOD logs) stay on `/night-audit/*` as NA tools. |
| Night Audit console (after successful roll) | Same ZIP button + short pack list. |
| Front Cash journal | Link to `cash-report` (`/reports/financial/cash`). |
| FO in-house | Link to `in-house` (`/reports/daily/in-house`). Existing `/fo/in-house` remains the **ops** list; the report is the printable/PDF view. |
| Agency ledger | Stays `/front-cash/agency-ledger` (ops). Company CL: `/front-cash/company-ledger`. Profitability report stays under Agency & market. |

**Anti-pattern:** duplicating Daily Management as a Night Audit-only PDF generator that cannot be opened from Reports.

### 5.2 Existing `/reports/*` mapping

| Today | After catalog |
|-------|----------------|
| `/reports/occupancy` | Occupancy hub (A); keep current grid as default child |
| `/reports/analytics` | Analysis / booking (A0 Sales + E demographics) — fold into Analysis or Booking, do not leave a stray top-level item |
| `/reports/agency-profitability` | Agency & market |
| `/reports/guest-dedup` | Ops/data-quality — **not** Management Reports; keep under Reports as utility or Settings |
| `/reports/invoices` | Invoice reports (other EW menu) — keep, outside this catalog |
| `/reports/reconciliation` | Ops utility — keep, outside this catalog |
| `/reports/agency-ledger` | Already redirects to Front Cash |

---

## 6. Nightly pack (Nafta default)

Reception downloads **one ZIP** after Night Audit. ERA does not email/WhatsApp; staff distribute the file.

**ZIP name:** `{propertySlug}-management-pack_{YYYY-MM-DD}.zip`  
**Member names:** `{nn}_{slug}_{asOf}.pdf` (`nn` = pack order).

| # | Pack id | Report | Slug | Date mode | EW / sample |
|---|---------|--------|------|-----------|-------------|
| 01 | `daily-management` | Daily Management (yesterday) | `/reports/daily/management` | `business_date` | `ElektrawebDailyManagementList.pdf` |
| 02 | `trial-balance-period` | Trial Balance Date Period | `/reports/financial/trial-balance-period` | `business_date` | `TrialBalanceDatePeriod.pdf` |
| 03 | `cash-report` | Cash Report | `/reports/financial/cash` | `business_date` | `ElektrawebKasaIslemlerList.pdf` (FO terminal + cash + city ledger) |
| 04 | `monthly-daily-analysis` | Monthly and Daily Analysis | `/reports/occupancy/monthly-daily` | `month_to_closed` | `MonthlyAndDailyAnalysis.pdf` |
| 05 | `in-house` | In-house | `/reports/daily/in-house` | `business_date` | EW in-house; ERA `/night-audit/inhouse-daily` |
| 06 | `annual-occupancy` | Annual Occupancy | `/reports/occupancy/annual` | `year_to_closed` | `AnnualOccupancy.pdf` |
| 07 | `folio-transactions` | Folio Transactions | `/reports/financial/folio-transactions` | `business_date` | ERA `/night-audit/reports/folio-transactions` |
| 08 | `department-revenues` | Departman gelirləri | `/reports/financial/department-revenues` | `business_date` (+ Today/Month/Year columns) | `DailyDepartmentSummary.pdf` |

Pack membership and order are **per hotel** (`NightAuditReportPackConfig`). Nafta ships with the eight rows above enabled. Other catalog reports can be added to the pack later without new menu IA.

**APIs (W1 live):**

- `GET /api/reports/pack?businessDate=` — manifest (enabled slugs, filenames)
- `GET /api/reports/pack/download?businessDate=&lang=` — ZIP of PDFs (lang from UI locale)
- `GET/PUT /api/admin/report-pack` — SatAdmin config

---

## 7. Catalog by classifier

Parity: `NONE` (no ERA surface) · `PARTIAL` (some screen/API, not EW layout/PDF) · `PLANNED` (this spec) · `OUT` (not hotel PMS).

### A0 — Analysis (`SCREEN`, mostly P1; cubes P2)

| ID | EW tile | Slug | Phase | ERA today | Parity |
|----|---------|------|-------|-----------|--------|
| A0-01 | Occupancy Graphs | `/reports/occupancy` | P1 | `/reports/occupancy` grid + chart | PARTIAL |
| A0-02 | Occupancy Analysis | `/reports/occupancy` (detail) | P1 | same | PARTIAL |
| A0-03 | Sales Report | `/reports/analysis/sales` | P1 | `/reports/analytics` sources | PARTIAL |
| A0-04 | Board Forecast | `/reports/occupancy/board-forecast` | P1 | — ; PDF `BoardForecast.pdf` | NONE |
| A0-05 | Distribution Analysis | `/reports/analysis/distribution` | P1 | channel/yield fragments | PARTIAL |
| A0-06 | Quota and Guarantee Analysis | `/reports/analysis/quota` | P1 | `/fo/availability` | PARTIAL |
| A0-07 | Revenue Cube | `/reports/analysis/cubes?cube=revenue-cube` | P2 | W3 pivot screen (not OLAP) | PARTIAL |
| A0-08 | Task Cube | — | P2 | CRM tasks | OUT of PMS reports |
| A0-09 | Reservation Cube | `/reports/analysis/cubes?cube=reservation-cube` | P2 | W3 pivot | PARTIAL |
| A0-10 | Manager View | `/reports/analysis/manager-view` | P1 | W2 screen | PARTIAL |
| A0-11 | Folio Cube | `/reports/analysis/cubes?cube=folio-cube` | P2 | W3 pivot | PARTIAL |
| A0-12 | Agency Sales Cube | `/reports/analysis/cubes?cube=agency-sales-cube` | P2 | W3 pivot | PARTIAL |

### A — Occupancy & forecast (`BOTH`)

| ID | EW / title | Sample file | Slug | Phase | Notes |
|----|------------|-------------|------|-------|-------|
| A-01 | Occupancy Graph | (graph PDF) | `/reports/occupancy/graph` | P1 | |
| A-02 | Occupancy Graph In Detail | | `/reports/occupancy/graph-detail` | P1 | |
| A-03 | Occupancy and Revenues In 3 Years | `ComparativeOccupancyandRevenueReport.pdf` | `/reports/occupancy/three-year-occ` | P2 | W3 screen+PDF |
| A-04 | Comparative Revenues In 3 Years | `ComparativeRevenuesByRevtypesAndDepartme…pdf` | `/reports/financial/three-year-rev` | P2 | Also listed under C |
| A-05 | Occupancy Graph Without Revenue | `ForecastWORev.pdf` | `/reports/occupancy/forecast-wo-rev` | P1 | |
| A-06 | Occupancy Graph With Board | `ForecastWithBoard.pdf` | `/reports/occupancy/forecast-board` | P1 | |
| A-07 | Annual Occupancy | `AnnualOccupancy.pdf` | `/reports/occupancy/annual` | **P0** | W1 screen+PDF; YTD to closed date; `AnnualOccupancy2.pdf` = ADR variant flag |
| A-08 | Forecast | `Forecast.pdf` | `/reports/occupancy/forecast` | P1 | `ForecastDetail.pdf`, `NEW_ForecastElektra.pdf` = detail/layout flags |
| A-09 | Comparative Forecast Report | `comparativeForecast.pdf` | `/reports/occupancy/forecast-compare` | P1 | |
| A-10 | Annual Occupancy With ADR | `AnnualOccupancy2.pdf` | `/reports/occupancy/annual` `?variant=adr` | P1 | |
| A-11 | Monthly And Daily Analysis | `MonthlyAndDailyAnalysis.pdf` | `/reports/occupancy/monthly-daily` | **P0** | W1 screen+PDF; Day column + period total; `month_to_closed` |
| A-12 | Board Forecast (PDF) | `BoardForecast.pdf` | `/reports/occupancy/board-forecast` | P1 | Adult / E.Child / Y.Child by date |

Sample Forecast KPIs (16.08.2026): rooms 56/78 (71.79%), revenue 9,780.39 AZN, ADR 174.65, pax income 110.51. Bed% may print `Infinity` when bed capacity is 0 — ERA must use real bed capacity, not divide by zero.

### B — Daily management flash (`BOTH`)

| ID | EW / title | Sample file | Slug | Phase | Notes |
|----|------------|-------------|------|-------|-------|
| B-01 | Daily Management | `ElektrawebDailyManagementList.pdf` | `/reports/daily/management` | **P0** | W1 screen+PDF; Full flash: occ, mobility, arrivals/departures, house use, comp, OOO |
| B-02 | Daily Management Summary | `ElektrawebDailyManagementSummary.pdf` | `/reports/daily/management` `?view=summary` | P1 | |
| B-03 | Daily Management Summary (Record Type) | `ElektrawebDailyManagementNewRecordType.pdf` | `?view=record-type` | P1 | |
| B-04 | Main Current (Only Today) | `MainCurrentToday.pdf` | `/reports/daily/main-current` | P1 | |
| B-05 | Daily Management Report (With Revenue) | `Daily Management Report (With Revenue).pdf` | `?view=revenue` | P1 | Also `ElektrawebDailyManagementListWithRevenue.pdf` |
| B-06 | Daily Management With Last Year | `ElektrawebDailyManagementListWithLastYear.pdf` | `?compare=yoy` | P1 | |
| B-07 | Daily Management Summary (Forecast) | `ElektrawebDailyManagementNewWithForecast.pdf` | `?view=forecast` | P1 | Brüt vs NET = `gross`/`net` flag (`(1).pdf` = NET) |
| B-08 | In-house | ERA in-house daily | `/reports/daily/in-house` | **P0** | W1 screen+PDF; Reports home live |
| B-09 | Daily Department & Room Summary | `DailyDepartmentSummaryDetailed.pdf` | alias of C-04 detailed | P1 | |

Consolidated **screen** for B-01…B-07: one page `/reports/daily/management` with tabs (List / Summary / Revenue / YoY / Forecast). Nightly ZIP still emits **B-01** as its own PDF filename.

### C — Financial / trial balance / department / cash (`BOTH`)

Ops TB — hotel PMS. Not Finance GL.

| ID | EW / title | Sample file | Slug | Phase | Notes |
|----|------------|-------------|------|-------|-------|
| C-01 | Daily Trial Balance | `Trial Balance.pdf` | `/reports/financial/trial-balance` | P1 | Revenue / VAT / payments / B/F |
| C-02 | Trial Balance with Currency | `TrialBalanceDatePeriodWithCurrency.pdf` | `?fx=1` | P1 | Duplicate `(1).pdf` = extra export |
| C-03 | Daily Trial Balance (Dept + Rev Code) | `Trial Balance (Dept + Rev Code).pdf` | `?by=dept-rev` | P1 | |
| C-04 | Department Revenues | `DailyDepartmentSummary.pdf` | `/reports/financial/department-revenues` | **P0** | W1 screen+PDF; Today / Month / Year × Total/Net/Tax; room analysis block |
| C-05 | Department Payments | `DepartmentPaymentPivot.pdf` | `/reports/financial/department-payments` | P1 | |
| C-06 | Cumulative Revenues | `CumulativeRevenue.pdf` | `/reports/financial/cumulative` | P1 | |
| C-07 | Cumulative Department Revenue Currency | `DailyDepartmentSummaryCurrency.pdf` | `/reports/financial/dept-currency` | P1 | |
| C-08 | Trial Balance Date Period | `TrialBalanceDatePeriod.pdf` | `/reports/financial/trial-balance-period` | **P0** | W1 screen+PDF; Same shape as C-01 for a period |
| C-09 | Discount/Rebate Department Totals | `departmentTotals.pdf` | `/reports/financial/discounts` | P1 | |
| C-10 | Transferred Discount/Rebate Totals | `TransferredDepartmentTotals.pdf` | `/reports/financial/transferred-discounts` | P1 | **may_empty** |
| C-11 | Cash Analysis | `ElektrawebKasaIslemlerList.pdf` | `/reports/financial/cash` | **P0** | W1 screen+PDF; FO cash + EPOINT + city ledger + ön ofis terminal (day) |
| C-12 | Folio Transactions | NA folio grid | `/reports/financial/folio-transactions` | **P0** | W1 screen+PDF; Reports home live |
| C-13 | Department Gelir Pivot | `DepartmentGelirPivot.pdf` | `/reports/financial/dept-pivot` | P1 | |
| C-14 | Comparative Revenues by rev type / dept | truncated ComparativeRevenues… | `/reports/financial/three-year-rev` | P2 | |

Nafta TB sample (16.08.2026 AZN): Accommodation 9,777.39 · Laundry 3.00 · Xudmani 251.00 · SPA Medikal 6.00; payments EPOINT / CASH / CITY LEDGER / ÖN OFİS TERMINAL; B/F yesterday 12,161.66 → tomorrow 15,415.85.

Department revenues also carry **Month** and **Year** columns on the same PDF — pack still keys the file off `business_date` (as-of).

### D — Agency / segment / market (`BOTH`)

| ID | EW / title | Sample file | Slug | Phase | Notes |
|----|------------|-------------|------|-------|-------|
| D-01 | Agency Analysis | `AgencyAnalysisPeriod.pdf` | `/reports/agency/analysis` | P1 | |
| D-02 | Monthly Agency Analysis | `Monthly Agency Analysis.html` | `/reports/agency/monthly` | P1 | Agency × day: Room, Pax, Arrival, Rev, Net, PPR, ADR, Room%, Bed% |
| D-03 | Agency Room Type Monthly Occupancy | `AgencyRoomTypeMonthlyOccupancy.pdf` | `/reports/agency/room-type-occ` | P1 | |
| D-04 | Agency Monthly Occupancy | (EW tile) | `/reports/agency/monthly-occ` | P1 | |
| D-05 | Agency - Room Type By Revenue | `AgencyRoomTypeRevenueAnalysis.pdf` | `/reports/agency/room-type-rev` | P1 | |
| D-06 | Agency - Nationality By Revenue | `AgencyNationalityRevenueAnalysis.pdf` | `/reports/agency/nationality-rev` | P1 | |
| D-07 | Agency Nationality Monthly Occupancy | `AgencyNationalityMonthlyOccupancy.pdf` | `/reports/agency/nationality-occ` | P1 | |
| D-08 | Agency Forecast Monthly By Date | `Agency Forecast Monthly By Date.pdf` | `/reports/agency/forecast-month` | P1 | `… Date 2.pdf` = extra export |
| D-09 | Segment Analysis | `SegmentAnalysis.pdf` | `/reports/agency/segment` | P1 | |
| D-10 | Nationality Monthly Occupancy | `NationalityMonthlyOccupancy.pdf` | `/reports/agency/nationality-occ-only` | P1 | |
| D-11 | Nationality & Market With Last Year | `nationalityandmarketwithlastyear.pdf` | `/reports/agency/nationality-market-yoy` | P1 | |
| D-12 | Room Type Analysis With Last Year | `roomtypeanalysiswithlastyear.pdf` | `/reports/occupancy/room-type-yoy` | P1 | Occupancy classifier, listed here because EW PDF column 4 |
| D-13 | Agency profitability (ERA) | — | `/reports/agency/profitability` | P1 | Existing screen; keep |

### E — Reservations / CRM / sales (`BOTH`)

| ID | EW / title | Sample file | Slug | Phase | Notes |
|----|------------|-------------|------|-------|-------|
| E-01 | Reservation Sales Analysis | `DailyReservationSalesReport.pdf` | `/reports/booking/sales` | P1 | |
| E-02 | Reservations By Create Date | `Reservations By Record Date (AZN).pdf` | `/reports/booking/by-create` | P1 | `(AZN) 2.pdf` is **EUR** variant |
| E-03 | Cancel Reservations By Cancel Date | `CancelReservation (1).pdf` | `/reports/booking/cancel-by-cancel` | P1 | Turkish title in sample |
| E-04 | Cancel Reservations By Record Date | `CancelReservation.pdf` | `/reports/booking/cancel-by-create` | P1 | NA cancelled grid is related |
| E-05 | Cancel Summary | (EW tile) | `?view=summary` on E-03 | P1 | |
| E-06 | Definite Reservation Analysis | `definite reservation analysis.pdf` | `/reports/booking/definite` | P1 | |
| E-07 | Detailed CRM Report | `detailedCrmReport.pdf` | `/reports/booking/crm` | P1 | Long guest/stay dump |
| E-08 | Date Range Management Report | (EW tile, not in sample pack) | `/reports/daily/date-range` | P1 | |
| E-09 | Guest demographics (ERA) | — | `/reports/analytics` | P1 | Existing; fold into Analysis/Booking |

---

## 8. Nightly pack field notes (P0 PDFs)

### 8.1 Daily Management (B-01)

Flash for GM. Room analysis (occupied, available, capacity, comp, house use, day use, OOO, OOS, sold, arrivals/departures, share rooms, pax). Sample list is multi-page (~329 extracted lines). PDF filename in ZIP: `01_daily-management_YYYY-MM-DD.pdf`.

### 8.2 Trial Balance Date Period (C-08)

Sections: Balance brought forward · Revenue by department (Total / Net / VAT) · VAT bucket · Payments by tender · Balance · Balance for tomorrow. Currency AZN in sample. Same identity as daily TB when `from=to=business_date`.

### 8.3 Cash Report (C-11)

Day list of FO cash movements: **CASH**, **CITY LEDGER**, **ÖN OFİS TERMINAL**, **EPOINT** (and other tenders present that day). Align with `/front-cash/transactions` journal; PDF is the printable day packet, not a second ledger.

### 8.4 Monthly and Daily Analysis (A-11)

One row per calendar day in month-to-closed, plus Total. Metrics: Room, Adult, Arrival Room/Adult, Room Revenue, ADR, PPR, Net Room Rev, capacities, Room%, Bed%.

### 8.5 In-house (B-08)

Guests in-house as of closed date (room, guest, pax, arrival/departure, agency). Screen: `/night-audit/inhouse-daily`. Canonical report URL still `/reports/daily/in-house`.

### 8.6 Annual Occupancy (A-07)

YTD occupancy/revenue from 1 Jan through closed date. Not a full remaining-year forecast.

### 8.7 Folio Transactions (C-12)

Charges and payments posted on the business date. Screen: `/night-audit/reports/folio-transactions`. Canonical report URL `/reports/financial/folio-transactions`.

### 8.8 Department revenues (C-04)

Rows = hotel departments (Accommodation, Pension, Naftani, Disco, Laundry, Xudmani, SPA Medikal, …). Columns = Today / Month / Year × Total, Net, Taxes. Lower block: payment tenders same three horizons + room analysis (capacity, occ, sold, adults, OOO).

---

## 9. Implementation waves

| Wave | Deliver |
|------|---------|
| **W1 P0** | Eight pack slugs: screen (reuse existing grids where they exist) + PDF + pack config + ZIP. Reports menu: category hubs + nightly pack. NA hub lists pack members instead of the dead 15-row mix. |
| **W2 P1** | Remaining A/B/C/D/E PDFs as screens+export; shared filter presets; Daily Management tabs. |
| **W3 P2** | Cubes, 3-year comparative, email cron body (today stub `email-cron`). |

Honesty: HOT-NA-03 stays SHIPPED for **ops EOD grids**. Management PDF catalog is **HOT-RPT-*** and stays Doc/STUB until W1 lands.

---

## 10. Sample inventory (`ERA-BACKUP\REPORTS`)

54 items (53 PDF + `Monthly Agency Analysis.html`). Verified against EW Management Reports tiles. Empty sample: `TransferredDepartmentTotals.pdf`. Duplicate exports ( `(1)`, `2`, Brüt/NET, AZN/EUR) map to **variant flags**, not new IDs.

Source of tile names: ElektraWeb Management Reports (Pdf + Frx filter, Occupancy PDF Reports, PDF Reports, Analysis Screens).
