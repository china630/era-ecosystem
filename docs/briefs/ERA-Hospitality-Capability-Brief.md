# ERA Hospitality Stack — Capability Brief

**Document type:** derived comparison brief (not a sell SSOT)  
**Audience:** NotebookLM / partner comparison against Oracle Opera Cloud user guides  
**Language:** English  
**Snapshot date:** 2026-08-22  
**Edition of every product in this brief:** `mvp` · **field pilot:** open · **`pilot_ready`:** false  

> **Honesty rule.** This document describes what the ERA stack *is built to do* and what is *actually shipped* in the current edition. It does **not** claim GA, certified fiscal, live OTA connectivity, or a shared multi-tenant SaaS hotel pool. For sell / show language use the Product-Readiness matrices, not this brief.

---

## 0. How to read this document

### 0.1 What this is

A single English inventory of the ERA hospitality stack — **Orchestrator (control plane)**, **Finance (accounting satellite)**, **Hotel PMS**, **Clinic / sanatorium**, and **F&B POS** — written so an analyst can compare it with Oracle Opera Cloud (and related Oracle Hospitality modules) without opening the monorepo.

### 0.2 What this is not

| Do not treat this brief as… | Use instead |
|---|---|
| Permission to sell “GA hotel” | `docs/editions/hotel.yaml` + Hotel Product-Readiness Matrix |
| Proof that every listed screen is field-signed | `docs/COVERAGE_MATRIX.md` + UAT-SMOKE |
| A full commercial bank / ABS | Bank Capability Inventory (out of hospitality scope) |
| A clone of Opera Sales & Catering, OXI/OHIP, or OPERA Controls | Honest gap table in §11 |

### 0.3 Status tags used here

| Tag | Meaning |
|---|---|
| **SHIPPED** | Doc + API + UI for the declared actor, plus a UI UAT-SMOKE path (not curl-only) |
| **API** | Backend and usually a screen exist; not accepted as SHIPPED (no UAT / Demo-TE) |
| **STUB** | Mock / env-gated / needs vendor cert or credentials |
| **HEADLESS** | Worker, webhook, cron, or browser extension — no SatAdmin card required |
| **mvp / not GA** | Product edition. Scaffold-green ≠ product acceptance. SHIPPED ≠ Pilot-ready |

Actor columns in the living matrix: **OpsUI** (local staff login), **SatAdmin**, **OrgOwner** (SSO owner), **SuperAdmin** (orchestrator).

### 0.4 Source documents (SSOT)

| Layer | Path |
|---|---|
| Architecture | `docs/CONTROL_PLANE_ARCHITECTURE.md`, `docs/adr/` |
| Hospitality ↔ Finance | `docs/HOSPITALITY_FINANCE_BOUNDARY.md` |
| Actor coverage | `docs/COVERAGE_MATRIX.md` |
| Sell / show | `docs/acceptance/*-Product-Readiness-Matrix.md` |
| Editions | `docs/editions/*.yaml` |
| Hotel IA | `era-hotel-pms/doc/MENU-IA-CANON.md` |
| Hotel PRD | `era-hotel-pms/PRD.md` |
| Clinic PRD | `era-clinic/PRD.md` |
| F&B PRD | `era-fnb-pos/PRD.md` |
| Finance PRD | `era-finance-core/PRD.md` |
| Orchestrator PRD | `era-orchestrator/PRD.md` |

---

## 1. Product thesis

ERA is not a standalone PMS. It is a **multi-satellite stack for an Azerbaijan hospitality property (or group)** where:

1. **Hotel PMS** owns guest-facing stay operations: book, assign, folio, night audit, housekeeping, B2B allotment, thin medical/SPA, banquets.
2. **Clinic** owns clinical operations: appointments, visits, procedures, ICD, lab, sanatorium planning — including the medical depth that a city-hotel PMS never ships.
3. **F&B POS** owns the restaurant floor: tables, tickets, KDS, shift close, room-charge to the hotel folio.
4. **Finance** owns accounting truth: GL, sales invoices / e-qaimə, warehouse, AR aging, purchases. Hotel and POS **hand off**; they do not duplicate ERP.
5. **Orchestrator** owns identity, SSO, entitlements, billing SKUs, MDM persons, workforce hire, and the satellite event bus.

**The comparison implication vs Opera Cloud:** Opera is a deep *hotel* PMS (plus OHIP for certified interfaces). A typical Opera property still buys SPA, clinic/HIS, restaurant POS, and local GL as separate products. ERA’s bet is that a **wellness / medical / sanatorium resort** (and an unbranded city hotel that wants local fiscal + one owner cockpit) is better served by one control plane than by Opera + 4 vendors.

**Pilot property shape:** Nafta-class resort — hotel + restaurant + medical/sanatorium cycle — not an international branded chain (Hilton/Marriott often mandate Opera).

---

## 2. Architecture

### 2.1 Three planes

| Plane | Product | Owns |
|---|---|---|
| Control plane | `era-orchestrator` | Identity launcher, SSO, RBAC, billing, entitlements, MDM API, satellite event ingest, org operating mode, workforce hub |
| Finance satellite | `era-finance-core` | GL, documents, inventory, HR/payroll (optional), tax, counterparty MDM for accounting |
| Industry satellites | `era-hotel-pms`, `era-clinic`, `era-fnb-pos`, … | Vertical operational data only |

**Rule:** cross-tenant, cross-satellite, or commercial logic → orchestrator. Ledger and accounting events → finance. Hotel does not become a second 1C.

### 2.2 Two tenancy axes (do not conflate)

**Axis A — legal / money / POS**

| Need | Mechanism |
|---|---|
| Bar + restaurant, same VÖEN, same org | Multiple `Outlet` rows in the satellite DB |
| Clinic / shop as a department of the hotel | Orchestrator org `DEPARTMENT` + `parentOrgId`; revenue / fiscal may route to **PARENT**; ops data stays in that org’s satellite rows |
| Separate legal entity | Separate org `STANDALONE` + unique `taxIdBlindIndex` (VÖEN) |

Detach department → standalone changes **routing only**. No operational data migration.

**Axis B — placement** (`SHARED` / `DEDICATED` / `ONPREM`) is packaging, not the same as DEPARTMENT. PlacementJob API is a **scaffold**. Live SHARED hotel SaaS pool and automated on-prem migrate are **not built**. Do not sell “SaaS pool”.

### 2.3 Identity and login

| Actor | Login | Org resolution |
|---|---|---|
| Operational staff (reception, waiter, maid, nurse) | Local form on the satellite (`/api/auth/login`) | Deployment-bound; no org picker |
| Owner / management | SSO from orchestrator launcher | Signed `organizationId` in SSO payload |
| Finance / platform user | Orchestrator or finance login | Membership; multi-org switcher for owners |

SSO payload: HMAC `email|organizationId|expiresAt`. Local staff use `passwordHash`. SSO users use `sso:no-password` and cannot local-login.

Workforce hire master = orchestrator. Satellites consume `STAFF_PROVISIONED` and upsert a local user keyed on `cpEmploymentId`. Hotel admin “create user” is a secondary seat guard.

### 2.4 MDM (person identity)

- PII lives in orchestrator MDM (`era_mdm`): `GlobalNaturalPerson`, identifiers (FIN, passport + issuing country).
- Satellites store **`globalPersonId` only**. Hotel guest card shows a **masked** ops-profile. No local FIN/passport columns when MDM-linked.
- Guest create/edit links identity; merge supports foreigner → citizen when FIN is obtained.
- Production hotel templates set `ERA_HOTEL_GUEST_MDM_STRICT=true`.

### 2.5 Event bus

Satellites publish `POST /api/v1/satellite-events` (Bearer `SATELLITE_EVENT_SERVICE_TOKEN`). Queue: `era-satellite-events` (BullMQ). Envelope: `@era/contracts`.

Hospitality events that Finance consumes (live unless noted):

| Event | Effect |
|---|---|
| `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED` | Multi-line NAS journal from `revenueLines` + GL map |
| `SATELLITE_HOTEL_INVOICE_ISSUED` | Draft sales invoice in Finance |
| `SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT` | Agency balance snapshot (`AgencyCityLedgerSnapshot`) |
| `SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED` | WIP / COGS journal |
| `SATELLITE_FB_SALE_COMPLETED` | Revenue journal on LOCAL_CASHIER pay (not room-charge / hub) |
| `SATELLITE_FB_SHIFT_CLOSED` | Cash recon log meta (stub-ish) |
| `SATELLITE_CLINIC_VISIT_COMPLETED` | Visit revenue path |
| `SATELLITE_CLINIC_LAB_ORDER_COMPLETED` | Lab revenue path |
| `SATELLITE_CLINIC_PROCEDURE_COMPLETED` | Procedure TTK lines → Finance `adjustStock` (warn + post) |

### 2.6 Localization (Azerbaijan)

- Currency **AZN**; display timezone **Asia/Baku**; UTC in DB.
- Legal entity **VÖEN** (10 digits); citizen **FIN** (7 chars, no I/O).
- Foreigners: passport + `issuingCountry` until residency.
- Fiscal guest receipt (KKM / NBC) is **STUB** in this edition. e-qaimə (e-invoice) is a Finance concern; hotel folio shows a read-only stub (HOT-04).

---

## 3. Edition snapshot (sell honesty)

| Product | Edition file | Status | Pilot ready | Sell / show one-liner |
|---|---|---|---|---|
| Platform / Orchestrator | `platform.yaml` | mvp | false | Control plane + MDM + billing + workforce; topology hop/pool not live |
| Hotel PMS | `hotel.yaml` | mvp | false | FO + City Ledger **showable** (UI/Demo green). Pilot open. KKM STUB. Not GA |
| Clinic | `clinic.yaml` | mvp | false | Do not claim GA — fiscal / HL7 STUB; pilot open |
| F&B POS | `fnb.yaml` | mvp | false | Floor / KDS / admin showable at 🟡; pilot open |
| Finance | `finance.yaml` | mvp | false | GL / events MVP; many FIN-* still API-only |

**Forbidden claims in this edition:** “ready”, “GA”, “certified KKM”, “live Booking.com/Expedia sync”, “SHARED hotel SaaS pool”, “full Opera replacement”, “full commercial HIS”.

**Allowed show language:** “FO + City Ledger MVP showable; medical/sanatorium + POS + Finance in one stack; field pilot open.”

---

## 4. Hotel PMS — `era-hotel-pms`

**Entitlement gate:** `industry_hotel_pms`  
**Commercial modules:** see §10  
**IA rule:** shift sections, not an ElektraWeb clone. FO=`/fo/*`, HK=`/hk/*`, Cash=`/front-cash/*`, NA=`/night-audit/*`, Distribution=`/distribution/*`, Settings=`/settings/*`. Finance / Clinic / POS are **external deep links**.

Benchmark mix (honest): Opera Cloud for folio / night-audit *patterns*; Mews for modern UX density; ElektraWeb for Azerbaijan/Turkey market parity (not a pixel clone).

### 4.1 Front Office (SHOW / SHIPPED)

Working home: stay lifecycle.

| Screen | Path | What it does |
|---|---|---|
| Room-type availability | `/fo/availability` | Sellable Avl / Occ; create blocked when Avl = 0 |
| Reservation list | `/fo/reservations` | Stay queue: filters, notes, assign, check-in |
| Room rack | `/fo/rack` | Door tiles: HK status, in-house, quick actions |
| Room plan | `/fo/room-plan` | Timeline bars; relocate / extend; share-twin lanes |
| Groups | `/fo/groups` | Booking envelope (group) |
| In-house | `/fo/in-house` | In-house guests → card / folio |
| Room changes | `/fo/room-changes` | Move plans |
| Agency inbox | `/fo/agency-inbox` | Confirm / decline OPTION stays from agency portal (**API**, not SHOW) |
| Reservation card | modal / editor | Agency-first layout; assignment by stage; Additional collapsed |
| Guest card | GuestCardModal | MDM link + masked FIN/passport; merge |

**Booking model (SHIPPED):** hierarchy **Block → Booking → RoomStay**. Pickup from allotment. MASTER folio routing. Allotment cutoff soft-release is **HEADLESS** cron.

**Shared twin (HOT-FO-03):** `shareEligible` + M/F pool + door inventory on card / room-plan / rack. Status **API** — UAT-SMOKE §30 not signed, so not SHIPPED.

### 4.2 Front Cash, folio, City Ledger (SHOW / SHIPPED)

This is the area closest to Opera cashiering — and the one ERA treats as a first-class ops product, not an ERP screen.

| Capability | ID | Status | Notes |
|---|---|---|---|
| Folio settle multi-tender | HOT-CASH-01 | SHIPPED | CASH / CARD / COMPANY / LOYALTY / DEPOSIT / BANK_TRANSFER (+ bankReference; match in Finance) |
| Unified pending hub | HOT-CASH-02 | SHIPPED | F&B + clinic walk-in pay at reception (`/front-cash/pending`). Not the clinic cashier |
| Front-cash journal + shift Z | HOT-CASH-06 | SHIPPED | Ops Z packet — **not** fiscal KKM Z |
| Deposit hold / apply / refund | HOT-CASH-03 | SHIPPED | Apply at check-in and settle / checkout |
| Payment refunds | HOT-CASH-04 | SHIPPED | Mock fiscal; blocked after TRANSFERRED_AR |
| Checkout discounts | HOT-CASH-05 | SHIPPED | Manual + automatic promo |
| Checkout close (zero balance) | HOT-CO-01 | SHIPPED | Guest must settle |
| Transfer balance to City Ledger | HOT-CO-02 | SHIPPED | Credit / contract gate → `PENDING_AR` |
| Per-guest folio close | HOT-CO-03 | SHIPPED | Selective close |
| Early checkout unused-nights refund | HOT-CO-04 | SHIPPED | Net of 18% VAT, default CASH; all folios reverse |
| Folio routing | HOT-CL-01 | SHIPPED | Revenue → GUEST / COMPANY / AGENCY; stay overrides beat property rules |
| Credit limit on stay / room charge | HOT-CL-02 | SHIPPED | Used by CL gate |
| Agency CL ops snapshot | HOT-CL-03 | SHIPPED | `/front-cash/agency-ledger` |
| CL → Finance snapshot | HOT-CL-04 | SHIPPED | Re-push + Finance deep link |
| Terms / aging / invoice matching | HOT-CL-05 | SHIPPED | **Owned by Finance**, not duplicated in PMS |
| Agency prepaid / postpaid + refunds | HOT-AG-02 | SHIPPED | Bank match in Finance |

**Folio windows:** ERA uses **routing rules + stay overrides + MASTER folio**, not Opera’s 8 named folio windows (1–8) as a first-class object. Functionally similar for “guest vs company vs agency”; not a window-for-window clone.

**City Ledger vs Opera AR:** hotel keeps **operational** CL (opening, charges, payments, checkout transfer). Finance keeps **AR aging, allocation, e-invoice**. This is an explicit product boundary, not a missing screen.

### 4.3 Night Audit (SHOW / SHIPPED)

| Capability | ID | Status |
|---|---|---|
| EOD: post room / package, roll business day, emit E1 | HOT-NA-01 | SHIPPED |
| Polish: exceptions, auto no-show, trial | HOT-NA-02 | SHIPPED |
| EOD reports hub + CSV (cancel / create / folio tx / price control / no-show / room-move / VIP) | HOT-NA-03 | SHIPPED |
| Reservation updates filter + CSV | HOT-NA-04 | SHIPPED |
| End of year close / open | HOT-NA-05 | **STUB** (`YEAR_END_NOT_ENABLED`) |

Night Audit is an operational day-close, not a GL close. GL posts from `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED`.

### 4.4 Housekeeping (SHOW)

| Screen | Path |
|---|---|
| HK board (DIRTY → CLEAN → INSPECTED) | `/hk` |
| Maid mobile | `/hk/mobile` |
| Minibar | `/hk/minibar` |
| Maid shifts / assignment | `/hk/maids` |
| OOO / closed rooms | `/hk/closed-rooms` |
| Lost & found | `/hk/lost-and-found` |

Local stock MVP for HK consumption: `/settings/stock` (deep link to Finance warehouse for real inventory).

**Declared, not SHOW:** Nafta roster / ƏG / daily floor pairs / Kat Hizmetleri sheet / guest laundry ticket — [`era-hotel-pms/doc/HK-NAFTA-OPS.md`](../../era-hotel-pms/doc/HK-NAFTA-OPS.md). Do not sell as Opera-depth HK.

### 4.5 Distribution, B2B, yield

| Capability | ID | Status | Notes |
|---|---|---|---|
| Local channel manager | HOT-CH-01 | SHIPPED | Mappings, stop-sell, sync journal, OTA cancel by ref, health |
| Live OTA ARI (Booking.com / Expedia / Exely) | HOT-CH-02 | **STUB** | Env-gated dry-run; no vendor creds in this edition |
| Tour agency contracts + commission % | HOT-AG-01 | SHIPPED | |
| Allotment blocks + pickup | HOT-BOOK-01 | SHIPPED | Cutoff cron HEADLESS |
| Occupancy / load / child pricing flags | HOT-OCC-01 | SHIPPED | Flags default OFF; 2nd/3rd adult, extra bed, child matrix |
| Yield rules (load %) | part of HOT-OCC-01 | SHIPPED | Applied only if load flag ON |
| Pricing components (fee / meals / COGS versions) | HOT-PC-01 | SHIPPED | Version history + audit |
| Package sell + costFloor versions | HOT-PKG-01 | SHIPPED | |
| Auto-BAR from production calendar | M24 | SHIPPED | Nightly `/api/cron/auto-bar`; `dayType` + MANUAL lock |
| Unit economics (CPOR / BEP / below-floor) | HOT-UE-01 | **API** | Phase A proxy; Finance CPOR later |
| Agency portal book | HOT-AGP-01 | **API** | B2B extranet; AUTO default OFF → OPTION |
| FO agency inbox | HOT-AGP-02 | **API** | Confirm → CONFIRMED; decline → CANCELLED |
| Optional passport scan on agency book | HOT-AGP-03 | **API** | Not KBS |

**Yield honesty vs Opera:** ERA has BAR calendar, occupancy/load flags, child matrix, and auto-BAR from a production calendar. It does **not** claim Opera-class hurdle rates, best-available-rate strategy trees, or a certified CRS. Live channel push is a stub.

### 4.6 Banquets, transfers, service, migration

| Area | Path | Status | Honesty |
|---|---|---|---|
| Banquets / BEO | `/banquets*` | SHIPPED (HOT-BEO-01) | Lines, resources, staff, settlement, calendar, event P&L. **Not** full Opera S&C (blocks, function diary, BEO change-log at Opera depth) |
| Transfers | `/transfers`, `/transfers/airport` | SHIPPED (HOT-XFER-01) | Charge via postCharge routing; cancel / void |
| Guest tours | `/tours` | SHIPPED (HOT-TOUR-01) | Group roster + TOUR folio; ADR hotel-guest-tours |
| Service / maintenance WO | `/service`, `/service/guest` | SHIPPED (PRD M23) | Staff + guest request form |
| Migration PRO | `/migration` | module `hotel_migration_pro` | AZ police / registration queue |
| ElektraWeb historical import | `/settings/import` | SHIPPED (HOT-05) | SuperAdmin |
| ElektraWeb live bridge | extension + ingest API | HEADLESS (HOT-06) | Dual-run; no SatAdmin card |

### 4.7 Hotel-thin medical / SPA

Hotel owns **scheduling surfaces**; Clinic owns **clinical record**.

| Screen | Path | Role |
|---|---|---|
| Procedures | `/procedures` | Sanatorium procedure slots |
| SPA reservations | `/spa/reservations` | SPA book list |
| Staff match | `/spa/staff-match` | Therapist matching |
| Places / cabinets | `/spa/places` | Resource rooms |
| Medical (thin) | `/medical` | Jump / thin hotel medical |

Deep lab, ICD, nurse roster, contraindications, procedure TTK → **Clinic**.

### 4.8 Guest loyalty

PRD: guest loyalty tiers via platform hook `platform_loyalty` — **DONE** as a platform hook, not an Opera-class loyalty engine (points, tiers, stay-based earn/burn across a brand).

### 4.9 Management reports (API — not SHIPPED)

Catalog inspired by ElektraWeb WA0058/59 + Nafta nightly pack. Screens and PDFs exist; **no UAT evidence → not SHIPPED**.

| Hub | Path | Contents |
|---|---|---|
| Reports | `/reports` | Category tiles + shared period |
| Analysis | `/reports/analysis` | Cubes (P2) |
| Occupancy | `/reports/occupancy` | Forecast / annual / monthly-daily + PDF |
| Daily flash | `/reports/daily` | Daily management + in-house + PDF |
| Financial (ops) | `/reports/financial` | Trial balance period, cash, folio tx, department revenues — **ops**, not Finance GL |
| Agency | `/reports/agency` | Profitability / market |
| Booking | `/reports/booking` | Planned create/cancel/CRM |
| Nightly ZIP | `/reports/nightly-pack` | Configurable pack after NA; cron sends link (HEADLESS) |

### 4.10 Hotel gaps vs a full Opera Cloud property

| Opera-class area | ERA today |
|---|---|
| 27 folio styles / 8 folio windows | Routing + MASTER folio; fewer print styles |
| Certified PMS↔CRS / OHIP | Local CM SHIPPED; live OTA **STUB** |
| Multi-property chain + central reservation | Org + holding in Finance / CP; not Opera Cloud multi-property |
| Sales & Catering depth | BEO MVP only |
| Year-end calendar | STUB |
| Fiscal / KKM certified | STUB |
| Management report acceptance | API / screens, not SHIPPED |
| Agency extranet | API, not SHOW |
| Shared-twin UAT | API |
| Brand / franchise mandated interfaces | Out of scope for Nafta-class |

---

## 5. Clinic / sanatorium — `era-clinic`

**Entitlement:** `industry_clinic` (+ hotel bundle for sanatorium).  
**There is no `industry_hospital` tile.** Hospital pack = same satellite + inpatient modules (future).

### 5.1 Product lines (presets)

| Product line | `Outlet.preset` | Gate | Notes |
|---|---|---|---|
| ERA Clinic Outpatient | `outpatient` | `industry_clinic` | Polyclinic, diagnostics — core |
| ERA Clinic Inpatient Day | `inpatient_day` | + future `clinic_inpatient_day` | Ward-lite; **not** full HIS. Current inpatient is a stub until Phase 4 |
| ERA Sanatorium Clinical | `sanatorium_clinical` | clinic + hotel bundle | Requires `era-hotel-pms` + bus |
| ERA Wellness | `wellness` | `industry_clinic` | Scheduling + resources, no EMR |

Sanatorium **business** = entitlements `industry_hotel_pms` + `industry_clinic` (+ optional retail). Not a standalone sanatorium satellite.

### 5.2 In-scope clinical operations

| Area | Surfaces | Status (readiness) |
|---|---|---|
| Ops home / appointments / nurse | `/`, `/appointments`, `/nurse` | UI 🟡 |
| Nurse / lab monthly rotation | `/sanatorium/nurse-roster` | UI ✅ (CLI-38b dual view + day override) |
| Sanatorium МКБ | `/sanatorium` | UI 🟡 |
| Patient card (after contraindications) | `/patients/[id]` | UI 🟡 |
| Visit / inpatient | `/visits/[id]`, `/inpatient` | UI 🟡 |
| Diagnosis report | `/reports/diagnoses` | UI 🟡 |
| ICD favorites | `/admin/icd-favorites` | UI 🟡 |
| SatAdmin catalogs | `/admin/*` | UI 🟡 |
| Cashier | `/cashier` | UI 🟡 |
| Print | `/print/*` | UI 🟡 |
| Procedure TTK BOM | `/admin/master-data` | **API** (CLI-47; UAT open) |

**Procedure planning:** program / package quotas expand to `PROPOSED` procedure orders; doctor confirms; FIFO placement onto resources (`placeConfirmedProcedures`). Time layers: occupancy vs cabin resource gap vs guest rest vs pair rules (`resourceGapMinutes`, `patientRestMinutes`).

**Hotel capacity foresight (CLI-27, SHIPPED):** clinic reads hotel capacity; soft warn at ≤15% remaining; critical **blocks medical booking**; bus `CAPACITY_CHANGED`.

**Workforce (CLI-WF-01, SHIPPED):** CP hire → clinic `DOCTOR` login.

### 5.3 Explicitly out of clinic v1

Full HIS (OR, MAR, ward pharmacy, DRG), production HL7/FHIR, DICOM/PACS, national e-recept, full EMR, full insurance TPA / pre-auth, pharmacy warehouse (Finance or retail — **not** procedure TTK).

Fiscal / HL7: **STUB**. Edition `mvp`, pilot open, do not claim GA.

---

## 6. F&B POS — `era-fnb-pos`

**Role:** restaurant satellite. Floor / ticket / KDS / shift live here — never in PMS or ERP.

| ID | Capability | Status |
|---|---|---|
| FNB-01 | CARD pay + shift | SHIPPED |
| FNB-02 | Real KKM / NBC | **STUB** (mock) |
| FNB-03 | Admin modal CRUD (menu categories/items, tables) | SHIPPED |
| FNB-04 | Menu price history | SHIPPED |
| FNB-05 | Standalone sale / shift → Finance GL | SHIPPED (LOCAL_CASHIER only; hotel paths via NA) |
| FNB-06 | Recipe SKU + Finance deep-link (BOM SoT in Finance) | SHIPPED |
| FNB-07 | Dish image URL (no upload) | SHIPPED |
| M11 | KDS course timing | DONE (PRD) |
| M12 | Recipe / BOH depletion engine | DONE — posting → Finance |
| M13 | Delivery aggregator inbox | DONE as **platform** `delivery` (not a full Wolt/Glovo cert) |
| M14 | Labor roster / PIN clock | DONE |

**Room charge:** `POST /api/pms/room-charge` into hotel-pms. Reception can collect café tickets on `/front-cash/pending`.

**Banquet extras:** fb-pos tickets with `beoId` — extras on event day; base package on PMS master folio.

**Out of F&B v1:** PMS chessboard, medical, SPA POS, local warehouse/GL, dark kitchen, full iiko/rKeeper clone, split bill (deferred).

Readiness: UI 🟡, Demo 🟡, edition `mvp`, pilot open.

---

## 7. Finance — `era-finance-core`

Finance is the **accounting data plane**, not the SaaS front door. Registration, launcher, and billing SoT stay on the orchestrator.

### 7.1 What hospitality needs from Finance

| Need | Finance home | Hotel / POS role |
|---|---|---|
| Sales invoices / e-qaimə / AR | `/sales/invoices` | Hotel `/reports/invoices` list + `integrateToAccounting` + deep link |
| Agency AR / aging / allocate | `/crm/counterparties`, `/reporting/aging` | Hotel snapshot + checkout `PENDING_AR` / `TRANSFERRED_AR` |
| Purchases / PO | `/purchases` | Not in hotel |
| Warehouse / stock | `/inventory/*` | Hotel local HK MVP only; clinic TTK write-off via event |
| GL journals from NA / POS / clinic | event consumers | Satellites emit; Finance posts atomically |
| Bank apply / match | bank modules | Folio `BANK_TRANSFER` reference |

### 7.2 Core finance product (honest)

- Double-entry GL; adjusting journals (FIN-GL-02 SHIPPED).
- Holdings: multi-org consolidation to holding base currency (AZN) via CBAR; monthly-slice P&L.
- Inventory including statutory Forma-5 / Forma-2 PDF (**API**).
- Tax declarations (simplified / profit / payroll) — **API**, `tax_pro`; property file export pending.
- Counterparty CRM for accounting (not hotel guest CRM).
- Optional payroll mirror from CP workforce (`hr_full`).
- Many FIN-* rows remain **API-only**. Edition `mvp`. Demo ❌ on Finance Product-Readiness.

### 7.3 What Finance is not

Not a PMS. Not a POS. Not the identity provider. Not a replacement for Opera’s cashiering UI — that UI is in Hotel Front Cash.

---

## 8. Orchestrator / platform — `era-orchestrator`

### 8.1 Modules (PRD)

| ID | Module | Status |
|---|---|---|
| M1 | Auth (login, refresh, SSO) | DONE |
| M2 | Membership API | DONE |
| M3 | Entitlements validate | DONE |
| M4 | Satellite events ingress | DONE |
| M5 | Access request / transfer ownership | DONE |
| M6 | Ownership dispute | DONE |
| M7 | Billing & subscription SoT | DONE |
| M8 | Platform add-ons (notifications, booking, …) | Live |
| M9 | Launcher web | DONE |

### 8.2 Workforce hub (SHIPPED / API mix)

Hire, org units, positions, absences (7 Azerbaijan Labour Code kinds), vacation plans, personnel-order PDF, ştat (staff schedule) PDF, timesheets, CSV import/export, seat licensing + Security Admin, masked FIN on employments.

Several PDF / approve flows are **API** until UAT-SMOKE. Hire → satellite provision is **SHIPPED** for clinic (and the same pattern for hotel).

### 8.3 Platform add-ons relevant to hospitality

| Add-on | Role |
|---|---|
| `platform_workforce` | CP hire / absence / seats |
| `platform_loyalty` | Hotel loyalty hook |
| `platform_notifications_pro` | Guest notify path — hotel HOT-03 is still **STUB** (Twilio/SendGrid) |
| `delivery` | F&B aggregator inbox |
| Booking add-on | Platform booking (not Opera CRS) |

### 8.4 Topology honesty (repeat)

Bind + runtime-config Sync + PlacementJob API scaffold exist. Live SHARED pool ops and automated migrate **do not**. License defaults follow `deploymentTopology`. Do not sell as multi-tenant Opera Cloud equivalent.

---

## 9. Cross-stack journeys (the actual product)

These journeys are why ERA is comparable to “Opera + POS + SPA + 1C”, not to Opera alone.

### 9.1 In-house guest dines and charges the room

1. Waiter opens a table on F&B POS, fires KDS, pays **room charge**.
2. Hotel posts a folio charge via PMS bridge (routing rules apply).
3. Night Audit includes the charge in the business day and emits `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED`.
4. Finance posts NAS journal lines. Standalone café cash (LOCAL_CASHIER) can also emit `SATELLITE_FB_SALE_COMPLETED` without a stay.

### 9.2 Walk-in café or clinic paid at reception

1. F&B or Clinic creates a pending settlement (`POS_BRIDGE_SECRET`).
2. Reception pays or voids on `/front-cash/pending`.
3. Callback confirms to the source satellite. This is **one cash desk**, not three.

### 9.3 Agency group checkout to city ledger

1. Stay routing sends room + extras to AGENCY.
2. Checkout transfers remaining balance to CL (`PENDING_AR`) after credit/contract gate.
3. Hotel pushes `SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT`.
4. Finance ages and allocates invoices. Hotel does not invent a second AR.

### 9.4 Sanatorium stay + procedures

1. Guest is a hotel stay **and** a clinic patient (`globalPersonId`).
2. Doctor confirms proposed procedures; FIFO scheduler places them with resource-gap and rest rules.
3. CLI-27 blocks booking when hotel remaining capacity is critical.
4. Completed procedure emits TTK consumable lines → Finance stock (CLI-47 API).
5. Walk-in clinical charges can settle at hotel Front Cash.

### 9.5 Department clinic under hotel VÖEN

Clinic org `DEPARTMENT` of hotel: operational rows stay in clinic; revenue / fiscal **may** route to parent. Detach later without migrating stays or visits.

### 9.6 Owner cockpit

Owner SSO into launcher → Hotel executive / unit-economics (API), Clinic revenue summary, Finance holdings P&L, workforce seats. One identity, several satellites.

---

## 10. Hotel commercial modules (SKU)

Satellite gate: `industry_hotel_pms`. Billable keys (not 12 fine-grained leftovers):

| Key | Human name | Typical contents |
|---|---|---|
| `hotel_core` | PMS Core | Front Office, Front Cash, Night Audit |
| `hotel_housekeeping` | Housekeeping & Room Rack | `/hk/*` |
| `hotel_service` | Service & maintenance | `/service` |
| `hotel_migration_pro` | Migration PRO | AZ registration queue |
| `hotel_transfers` | Transfers & guest tours | Airport / fleet / Nafta weekend tours (tours not coded) |
| `hotel_spa_scheduling` | SPA & Scheduling | `/spa/*`, `/procedures` |
| `hotel_distribution` | Distribution | Channel manager, contracts, yield |
| `hotel_agency_portal` | Agency Portal | B2B extranet — **sold separately**, not in default City/Resort/Sanatorium bundles |
| `hotel_guest_experience` | Guest Profiles & Tasks | Guest card / tasks |
| `hotel_banquets` | Banquets & BEO | `/banquets*` |
| `hotel_medical_sanatorium` | Medical & Sanatorium | Hotel-thin `/medical` |
| `hotel_setup_advanced` | Advanced master data | Deep settings |

Clinic gate `industry_clinic` is a **separate satellite SKU**, not a hotel submodule. That is the architectural difference vs “Opera + OPERA Controls flag for activities”.

---

## 11. Comparison axes vs Oracle Opera Cloud

Use this section in NotebookLM as the scoring rubric. Scores are qualitative and edition-honest.

### 11.1 Where Opera Cloud is deeper today

| Axis | Why Opera wins |
|---|---|
| Pure hotel cashiering taxonomy | Folio windows, 20+ folio styles, cashier shifts as a 30-year product |
| Group / block sophistication | Master / sub-blocks, wash, cutoff, pickup at chain scale |
| Rate engine | BAR / hurdle / restriction trees, occupancy-driven strategy as default |
| Channel / CRS | Certified OHIP adapters; live ARI to major OTAs |
| Multi-property / brand | Native chain, central reservation, franchise reporting |
| Sales & Catering | Function diary, BEO versions, banquet forecast |
| Interface marketplace | 1,000+ certified vendors (locks, TV, PBX, key cards) |
| Page Composer / OPERA Controls | Field-level UI composition + thousands of flags |

### 11.2 Where ERA is structurally different (and often stronger for this market)

| Axis | Why ERA is the better fit for a Nafta-class / wellness property |
|---|---|
| Medical / sanatorium | First-class clinic satellite: ICD, contraindications, doctor-confirmed FIFO, nurse roster, capacity gate vs hotel occupancy |
| One cash desk across hotel + café + clinic | Unified Front Cash pending hub |
| Accounting boundary | Real GL + e-qaimə + warehouse in the same vendor; not “export to 1C and hope” |
| Identity | MDM person (FIN/passport) shared across hotel guest and clinic patient |
| Org operating mode | DEPARTMENT clinic under hotel VÖEN without merging databases |
| Workforce | CP hire → satellite role provision; Labour Code absence kinds |
| Localization | AZN, VÖEN, FIN, Baku TZ, migration/police queue as a SKU |
| Owner UX | One launcher, not Opera + iiko + Medesk + 1C passwords |
| TCO | No Oracle Hospitality list price, no OHIP interface tax, no Opera Cloud Foundation vs Premium feature gating |

### 11.3 Where both are incomplete (do not bluff)

| Axis | Opera | ERA |
|---|---|---|
| Certified AZ KKM / NBC | via local fiscal vendor | STUB |
| Live OTA without a channel manager | OHIP / OXI (paid) | Local CM yes; live ARI STUB |
| Full HIS | not Opera’s job | not clinic v1 |
| Field-proven GA at this property | decades | **pilot open** |

### 11.4 Recommended NotebookLM questions

1. For each Opera Cloud cashiering object (folio window, deposit, city ledger, night audit), what is the ERA equivalent and who owns the GL?
2. Which Opera S&C objects have no ERA counterpart beyond BEO MVP?
3. Which ERA clinic / sanatorium objects have **no** Opera Cloud counterpart?
4. What must be true (KKM, live OTA, Pilot field) before ERA can be shown as a replacement rather than a parallel stack?
5. For a TABIA/PMD-class group: which properties are Opera-mandated (brand) vs ERA-fit (wellness / unbranded / medical)?

---

## 12. Compact capability index

Statuses below are a snapshot of `docs/COVERAGE_MATRIX.md` and Product-Readiness on 2026-08-22. When they disagree, **the matrix files win**.

### 12.1 Hotel

| ID | Capability | Status |
|---|---|---|
| HOT-01 | Master data CRUD | SHIPPED |
| HOT-02 | BAR rates Excel import | BLOCKED (Nafta Excel out of AC; dynamic plans only) |
| HOT-03 | Guest notify | STUB |
| HOT-04 | e-qaimé on folio | STUB |
| HOT-05 | ElektraWeb import | SHIPPED (SuperAdmin) |
| HOT-06 | ElektraWeb live bridge | HEADLESS |
| HOT-MDM-01/02 | Guest MDM link + masked profile | SHIPPED |
| HOT-BOOK-01 | Block → Booking → RoomStay | SHIPPED |
| HOT-BOOK-02 | Reservation card Phase 0 | SHIPPED |
| HOT-BOOK-03 | Allotment cutoff cron | HEADLESS |
| HOT-FO-01/02 | Availability + sellable preview | SHIPPED |
| HOT-FO-03 | Shared twin | API |
| HOT-CASH-01..06 | Settle, pending, journal, deposit, refund, discount | SHIPPED |
| HOT-CO-01..04 | Checkout, CL transfer, per-guest close, unused-nights | SHIPPED |
| HOT-CL-01..05 | Routing, credit, agency CL, Finance snapshot, aging | SHIPPED |
| HOT-NA-01..04 | Night audit + EOD + updates | SHIPPED |
| HOT-NA-05 | Year-end | STUB |
| HOT-RPT-01/02 | Management reports + nightly ZIP | API |
| HOT-XFER-01 | Transfers | SHIPPED |
| HOT-TOUR-01 | Guest group tours | SHIPPED |
| HOT-BEO-01 | Banquets BEO | SHIPPED |
| HOT-AG-01/02 | Contracts + agency settlement | SHIPPED |
| HOT-AGP-01..03 | Agency portal | API |
| HOT-PC-01 | Pricing components | SHIPPED |
| HOT-OCC-01 | Occupancy / child / yield flags | SHIPPED |
| HOT-PKG-01 | Package sell versions | SHIPPED |
| HOT-UE-01 | Unit economics | API |
| HOT-CH-01 | Local channel manager | SHIPPED |
| HOT-CH-02 | Live OTA ARI | STUB |
| HOT-UI-01 | List filters | SHIPPED |

### 12.2 Clinic / platform workforce (hospitality-relevant)

| ID | Capability | Status |
|---|---|---|
| CLI-27 | Hotel capacity foresight | SHIPPED |
| CLI-47 | Procedure TTK → Finance stock | API |
| CLI-WF-01 | Practitioner hire → clinic login | SHIPPED |
| CP-WF-HUB-01 | Workforce hub E2E | SHIPPED |
| CP-WF-* PDF / ştat / vacation / timesheet | Approve + PDF | API (UI landed) |

### 12.3 F&B

| ID | Capability | Status |
|---|---|---|
| FNB-01 | Card pay + shift | SHIPPED |
| FNB-02 | Real KKM | STUB |
| FNB-03..07 | Admin CRUD, price history, GL sale, recipe, image URL | SHIPPED |

### 12.4 Orchestrator

| ID | Capability | Status |
|---|---|---|
| ORCH-01 | Workspace launcher + SSO | SHIPPED |
| CP-LAUNCH-01 | Launch URL from SatelliteEndpoint | API |
| CP-WF-EMP/ABS/ORG/POS | Employment, absence, org tree, positions | UI landed / API until UAT |

---

## 13. UI map (hotel shift IA)

Sidebar order: Front Office → Front Cash → Night Audit → Housekeeping → Guests → Distribution → Service → Migration → SPA → Transfers → Banquets → Medical → Reports → Settings → external (POS, Retail, Finance, Clinic).

| Work class | Home |
|---|---|
| Sell / book / stay | `/fo` |
| Stay pay + café/clinic walk-in + agency CL | `/front-cash` |
| Day close | `/night-audit` |
| Management PDFs / ZIP | `/reports` (API acceptance) |
| Cleaning / OOO / L&F | `/hk` |
| OTA + B2B + quotas | `/distribution` |
| Guest profile | `/guests` |
| GL / AR / e-invoice | **Finance** |
| POS / digital menu | **F&B** |
| Lab / deep medical | **Clinic** |

i18n: new screens require **en + az + ru**.

---

## 14. Closing statement for analysts

ERA’s hotel satellite is already a **dense operational PMS** (folio, city ledger, night audit, HK, B2B allotment, BEO MVP, local channel manager). Marketing screenshots of Opera Cloud look “light” because Alta + Page Composer hide density; Opera’s *user guides* are still deeper on chain hotel mechanics.

ERA’s distinctive claim is not “we have more folio styles than Oracle”. It is:

> **One stack for a medical/wellness resort: stay + procedures + restaurant + local GL + one owner identity — with honest stubs where the law or a vendor is not yet wired.**

Until Pilot field is signed, KKM is live, and live OTA is more than a dry-run, the correct commercial sentence is **MVP showable**, not **Opera replacement**.

---

*End of brief. Snapshot 2026-08-22. Update this file when editions or COVERAGE rows that affect hospitality sell claims change.*
