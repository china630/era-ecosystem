# ERA ecosystem — modules catalog

Functional modules per application. **Finance** = source of truth for GL, sales/purchase documents, inventory, counterparty MDM. **Orchestrator** = identity, billing, entitlements, platform add-ons. Satellites = vertical operations + events.

**Versions:** [PRODUCT_VERSIONING.md](./PRODUCT_VERSIONING.md) — **v1.0** / **v1.1** / **v2.0** = shipped.

**Full readiness (Doc / API / UI / actors):** [COVERAGE_MATRIX.md](./COVERAGE_MATRIX.md). Module **DONE** here = minimum API + DELIVERY checkbox; actor UI may still be `[~]` until COVERAGE_MATRIX row is **SHIPPED**.

**Sell / show / pilot:** DONE ≠ edition `ga`. Commercial honesty → [`docs/acceptance/`](./acceptance/README.md) Product-Readiness + [`docs/editions/`](./editions/) ([ERA-Acceptance-Standard](./products/ERA-Acceptance-Standard.md)).

**Architecture:** [CONTROL_PLANE_ARCHITECTURE.md](./CONTROL_PLANE_ARCHITECTURE.md) · **Platform add-ons:** [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md)

Industry Solutions entitlements (Finance sidebar): see [industry-satellite-sync.md](../era-finance-core/docs/industry-satellite-sync.md).

**Industry modules:** [cross-app roadmap](#industry-module-roadmap) · research index [`ERPs/`](../ERPs/) · versioning rules [PRODUCT_VERSIONING.md](./PRODUCT_VERSIONING.md).

---

## Industry module roadmap

Module IDs — each app **`PRD.md` §4**. **M11 / M12** (promotions, customer at POS) — только **`era-retail-pos`**.

**Canonical detail:** per-app sections below. Summary rows are rolled-up only; status matches those tables.

**Open MVP index:** [MVP backlog (priority)](#mvp-backlog-priority).

### Shipped in v1.0

| App | Module | Capability | Owner | Status |
|-----|--------|------------|-------|--------|
| era-retail-pos | M7, M11, M12, M2 ext, M13 | Product cache, promos, customer, X-report, BOPIS | SATELLITE + platform | **DONE** |
| era-crm | M4 ext, M8, M9 | Visit geo, next-contact, lead score | SATELLITE + platform | **DONE** |
| era-clinic | M5 ext, M6, M9, M14 | Critical lab, price cache, reschedule, telehealth | SATELLITE + platform | **DONE** |
| era-logistics | M3–M9 | Waybill, POD, fleet, multi-stop, driver API | SATELLITE + platform | **DONE** |
| era-logistics | M13 | Customer tracking token | SATELLITE | **DONE** |
| era-construction | M6, M7, M9 | Daily log, punch list, subcontractor claims | SATELLITE | **DONE** |
| era-auto-service | M6, M8, M9, M10 | Intake, shop floor, parts status, vehicle history | SATELLITE | **DONE** |
| era-wholesale | M5, M6 | TTN, pick waves | SATELLITE | **DONE** |
| era-fnb-pos | M11, M12, M13 | KDS courses, recipe depletion, delivery inbox | SATELLITE + platform | **DONE** |
| era-hotel-pms | M20–M23 | Yield, loyalty, room-service QR, maintenance WO | SATELLITE + platform | **DONE** |

### Shipped in v1.1

| App | Module | Capability | Owner | Status |
|-----|--------|------------|-------|--------|
| era-retail-pos | M14–M16 | Mobile stock, replenishment, supplier SRM | SATELLITE + FINANCE | **DONE** |
| era-crm | M10 | Pipeline automation | SATELLITE | **DONE** |
| era-clinic | M10–M13 | EHR lite, LIS import, insurance, inpatient | SATELLITE + FINANCE | **DONE** |
| era-logistics | M10–M12 | Rate matrix, COD clearing, hub cross-dock | FINANCE + SATELLITE | **DONE** |
| era-construction | M8, M10–M12 | Gantt, equipment hours, CDE, timesheets | SATELLITE | **DONE** |
| era-auto-service | M5 ext, M7, M11 | Bay calendar, VIN catalogue, B2B parts PO | SATELLITE + FINANCE | **DONE** |
| era-wholesale | M7 | EDI / buyer API export | SATELLITE | **DONE** |
| era-fnb-pos | M14 | Labor roster / PIN clock | SATELLITE | **DONE** |
| era-hotel-pms | — | Room plan DnD, HK mobile, email reports, OpenAPI review | SATELLITE | **DONE** |

### Shipped in v2.0

| App | Module | Capability | Owner | Status |
|-----|--------|------------|-------|--------|
| era-retail-pos | M8–M10 | Offline queue, fiscal KKM, marketplace webhooks | SATELLITE + FINANCE | **DONE** |
| era-auto-service | M12 | Tool crib / equipment checkout | SATELLITE | **DONE** |
| era-crm | M7 ext | Live WhatsApp Business API (Orch + CRM stage hook) | PLATFORM + SATELLITE | **DONE** |
| era-clinic | M8 | Patient portal `/portal` | SATELLITE | **DONE** |
| era-hotel-pms | — | NBC KKM adapter, B2C rates widget, door locks | SATELLITE | **DONE** |
| Platform | CP-B3–B8 | Booking, portal, payments, loyalty, domain, delivery | orchestrator | **Live** |
| era-orchestrator + Finance | — | MDM registration cutover (`ERA_MDM_REGISTRATION_CUTOVER`) | orchestrator | **DONE** |

### Shipped in v3.0

| App | Module | Capability | Owner | Status |
|-----|--------|------------|-------|--------|
| era-crm | M11–M16 | Party profile, lead card, create UI, CSV import, Finance auto-CP, FIN/MDM | SATELLITE + FINANCE + contracts | **DONE** |

### Planned in v3.1+ (Bitrix backlog)

| App | Module | Capability | Status |
|-----|--------|------------|--------|
| era-crm | M17–M21 | Inbox 2-way, timeline, merge, Partner hook, import mapper | **DEFERRED (v3.1)** |
| era-crm | M22–M28 | KPI, Contact/Company split, quotes, calendar, comms | **DEFERRED (v4.0)** |
| era-crm | M29–M30 | Mobile field sales, field ACL | **DEFERRED (v5.0+)** |

See ADR [crm-lead-party-model §8](../adr/crm-lead-party-model-and-prospect-import.md#8-bitrix24-benchmark-backlog-deferred).

---

## Platform add-ons (orchestrator — cross-cutting)

Sold via `organization_modules` / pricing catalog; API under `/platform/*` on **era-orchestrator**. Not duplicated in satellites.

| Add-on | Slug (draft) | Serves |
|--------|--------------|--------|
| Notifications Pack | `platform_notifications` | WA / email / SMS — **Live** (v1.0) |
| Online Booking Widget | `platform_booking` | Clinic, auto-sto, retail, hotel — **Live** (v2.0) |
| Customer Portal | `platform_portal` | Orders, visits, documents — **Live** (v2.0) |
| Payment links & deposits | `platform_payments` | Pay-by-link, deposits — **Live** (v2.0) |
| Loyalty & promotions | `platform_loyalty` | Promo codes, points — **Live** (v2.0) |
| Custom domain & white-label | `platform_domain` | Branded storefront — **Live** (v2.0) |
| Delivery orchestration | `platform_delivery` | Retail + logistics — **Live** (v2.0) |

Detail: [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md).

---

## era-finance-core (ERP / accounting satellite)

| Module | Routes / area | Status | Notes |
|--------|---------------|--------|-------|
| Chart of accounts (NAS) | `/chart-of-accounts` | **DONE** | Template + org COA |
| Journal / GL | NAS entries, mapping | **DONE** | Satellite event worker |
| Sales invoices | `/sales/invoices` | **DONE** | **Source of truth** for issued invoices |
| Purchases | `/purchases` | **DONE** | Supplier receipts, PO |
| Inventory | `/inventory/*` | **DONE** | Warehouses, movements, audits, settings |
| CRM / counterparties | `/crm/counterparties` | **DONE** | MDM; reconciliation per agency |
| Bank & cash | Banking pro, kassa | **DONE** | Tier-gated |
| Tax / compliance | Tax pro, trade pro | **DONE** | AZ integrations |
| HR & payroll | HR module | **DONE** | |
| Manufacturing | Recipes, orders, release | **MVP** | Tier 2+ |
| Fixed assets | FA registry | **DONE** | |
| IFRS mapping | IFRS reports | **MVP** | Tier 3 |
| Industry Solutions UI | Redirect → Orch `:3000` | **DONE** | **Orchestrator only** (SP9); Finance `/industry/*` redirects |
| In-app staff notifications | Bell in web shell | **DONE** | **Not** customer Notifications Pack |
| Satellite GL dispatch | API worker | **DONE** | Consumes orchestrator events → journals |
| Billing meter (Phase 16) | `/admin/config/billing/*` | **DONE** | recordUsage + intraday tier invoice |

**Billing & platform (2026-05):** subscription, billing, referrals, early-access, public pricing — **orchestrator only**. Finance web proxies via `/cp/*`. Notifications Pack live when `ERA_NOTIFICATIONS_PACK=true`. See [CP-BILLING-MIGRATION.md](./CP-BILLING-MIGRATION.md).

**Moving out to orchestrator:** ~~subscription snapshot, `/api/billing/*`~~ **Done (CP-BILLING)**. Quota metering authority on CP. WhatsApp Pack via `/platform/notifications/v1/send`.

---

## era-hotel-pms (Hospitality PMS)

### Commercial modules (`pricing_modules` — not platform add-ons)

| Module key | Human name | Typical bundle |
|------------|------------|----------------|
| `industry_hotel_pms` | Hotel PMS (satellite gate) | — |
| `hotel_core` | PMS Core (FO, Front Cash, Night Audit) — Wave B FO live; **P5 FO money / CL ops open** ([ADR](./adr/hotel-city-ledger-and-fo-money.md)) | City+ |
| `hotel_housekeeping` | Housekeeping & Room Rack | City+ |
| `hotel_distribution` | Distribution (Channel + Contracts) | Resort |
| `hotel_agency_portal` | Agency Portal (B2B extranet) | Optional SKU — not in bundles; [ADR](./adr/hotel-agency-portal.md) |
| `hotel_guest_experience` | Guest Profiles & Tasks | Resort |
| `hotel_spa_scheduling` | SPA & Scheduling | Resort / Sanatorium |
| `hotel_transfers` | Transfers & guest tours | Resort |
| `hotel_banquets` | Banquets & BEO | Resort |
| `hotel_medical_sanatorium` | Medical & Sanatorium | Sanatorium |
| `hotel_setup_advanced` | Advanced master data | Optional |

Legacy aliases (dual-read): `hotel_front_office|hotel_front_cash|hotel_night_audit` → `hotel_core`; `hotel_channel_ota|hotel_contracts_yield` → `hotel_distribution`.

Bundles: `hotel_bundle_city`, `hotel_bundle_resort`, `hotel_bundle_sanatorium` — see [`docs/adr/hotel-module-taxonomy.md`](./adr/hotel-module-taxonomy.md).

### Delivered features (product)

| Feature area | Scope | Status |
|--------------|-------|--------|
| PMS Core | book, folio, NA, HK, channel | **DONE** (ops core) |
| Front cash settle | multi-method + hub pending | **DONE** |
| City Ledger ops snapshot | agency ledger + Finance event | **DONE** (ops; not AR) |
| Transfer to AR / deposit@CO / refunds / CO discounts | P5 H-BL-40…43 | **OPEN** |
| Night Audit | EOD core | **DONE**; polish H-BL-44 **OPEN** |
| POS bridge | fb-pos room charge | **DONE** |
| Sanatorium / medical | clinic bridge | **DONE** |
| Stock MVP | `/admin/stock` | **DONE** |
| Banquets BEO | `/banquets` | **DONE** (MVP) |
| Transfers | `/transfers` | **DONE** (MVP) |
| Agency contracts | `/admin/contracts` | **DONE**; prepaid/postpaid settlement H-BL-46 **OPEN** |
| Yield management | Dynamic BAR | **DONE** |
| Guest loyalty | Platform hook | **DONE** + PLATFORM |
| Room service QR | fb-pos bridge | **DONE** |
| Maintenance WO | HK → engineering | **DONE** |

**Backlog:** [era-hotel-pms/doc/BACKLOG-PRODUCTION.md](../era-hotel-pms/doc/BACKLOG-PRODUCTION.md) § P5 · [ADR hotel-city-ledger-and-fo-money](./adr/hotel-city-ledger-and-fo-money.md) · [ELEKTRAWEB-PARITY](../era-hotel-pms/doc/ELEKTRAWEB-PARITY.md)

---

## era-fnb-pos (F&B POS)

| Module | Since | Screens / API | Notes |
|--------|-------|---------------|-------|
| M0 Shell | — | layout | **DONE** (FB-0) |
| M1 Menu / outlet | — | `/admin/menu` | **DONE** |
| M2 Floor + ticket | — | `/floor` | **DONE** |
| M3 KDS | — | `/kds` | **DONE** |
| M4 Payments | — | pay API | **DONE** |
| M5 Room charge | — | PMS bridge | **DONE** |
| M6 Shifts X/Z | — | Z-close | **DONE** |
| M7 Void / discount | — | — | **DONE** |
| M8 Split bill | — | — | **DONE** (FB-2) |
| M9 Recipe consumption | — | E8 event | **DONE** |
| M10 i18n | — | en/ru/az | **DONE** |
| M11 KDS course timing | v1.0 | fire-course API | **DONE** |
| M12 Recipe / BOH engine | v1.0 | ticket close depletion | **DONE** |
| M13 Delivery aggregator | v1.0 | delivery-inbox | **DONE** |
| M14 Labor roster PIN | v1.1 | `/api/labor/clock` | **DONE** |
| Banquet BEO | — | — | HN-8 hotel |

**Backlog:** [era-fnb-pos/doc/BACKLOG-PRODUCTION.md](../era-fnb-pos/doc/BACKLOG-PRODUCTION.md)

---

## era-retail-pos

| Module | Since | Notes |
|--------|-------|-------|
| M0–M6(d) | — | Shell, shift, checkout, presets — **DONE** |
| M7 Product lookup | v1.0 | Read cache Finance SKU | **DONE** |
| M8 Offline queue | v2.0 | IndexedDB + sync API | **DONE** |
| M9 Fiscal KKM | v2.0 | `ERA_FISCAL_PROVIDER` | **DONE** |
| M10 Marketplace sync | v2.0 | Umico/Kaspi webhook stub | **DONE** |
| M11 Promotions (lite) | v1.0 | Cart before pay | **DONE** |
| M12 Customer at POS | v1.0 | Phone / loyalty ref | **DONE** |
| M2 X-report | v1.0 | Mid-shift without Z-close | **DONE** |
| M13 Omnichannel OMS | v1.0 | BOPIS | **DONE** |
| M14 Mobile stock / labels | v1.1 | WMS lite | **DONE** |
| M15 Auto-replenishment | v1.1 | Finance proxy | **DONE** |
| M16 Supplier SRM | v1.1 | supplier-match | **DONE** |
| Events | — | sale completed, shift closed |
| Growth | — | Platform on pay — DELIVERY R5 |

---

## era-logistics

| Module | Since | Notes |
|--------|-------|-------|
| M0 Shell | — | **DONE** |
| M1 Fleet | — | **DONE** (vehicles + `/fleet` alerts) |
| M2 Trips | — | **DONE** |
| M3 Waybill | v1.0 | Путевой лист | **DONE** |
| M4 POD (+ media) | v1.0 | Text + photo/signature | **DONE** |
| M5 Fuel reports | v1.0 | — | **DONE** |
| M6 Customs hub | v1.0 | — | **DONE** |
| M7 Fleet compliance | v1.0 | Doc expiry alerts | **DONE** |
| M8 Multi-stop trips | v1.0 | `trip_points` | **DONE** |
| M9 Driver mobile API | v1.0 | Driver trips API | **DONE** |
| M10 Rate matrix | v1.1 | Tariffs | **DONE** |
| M11 COD clearing | v1.1 | `/api/cod` | **DONE** |
| M12 Hub cross-dock | v1.1 | `/api/hub` | **DONE** |
| M13 Customer tracking | v1.0 | Public tracking token | **DONE** |
| Events | — | `TRIP_COMPLETED` |
| Growth | — | DELIVERY L4 |

---

## era-construction

| Module | Since | Notes |
|--------|-------|-------|
| M0 Shell | — | **DONE** |
| M1 Project / site | — | **DONE** (C1) |
| M2 BOQ (смета) | — | **DONE** stub (C1) |
| M3 Material requisition | — | **DONE** (C2) |
| M4 Progress act (КС) | — | **DONE** (C1) |
| M5 Photo report | — | **DEFERRED** |
| M6 Field daily log | v1.0 | — | **DONE** |
| M7 Punch list / defects | v1.0 | — | **DONE** |
| M8 Gantt / CPM | v1.1 | gantt bars API | **DONE** |
| M9 Subcontractor claims | v1.0 | — | **DONE** |
| M10 Site equipment hours | v1.1 | equipment hours | **DONE** |
| M11 CDE drawings | v1.1 | CDE metadata | **DONE** |
| M12 Labor timesheets | v1.1 | timesheet CSV | **DONE** |
| Events | — | `PROGRESS_ACT_APPROVED` |
| Growth | — | Platform on act — DELIVERY C3 |

---

## era-crm

| Module | Since | Notes |
|--------|-------|-------|
| M0 Shell | — | **DONE** |
| M1 Pipeline | — | **DONE** (C1) |
| M2 Lead card / timeline | — | **DONE** |
| M3 Inbox stub | — | **DONE** |
| M4 Visit (+ geo) | v1.0 | Visit log + lat/lng | **DONE** |
| M5 Convert lead | v1.0 | — | **DONE** |
| M6 Finance handoff link | v1.0 | convert → Finance | **DONE** |
| M7 Live WA Business API | v2.0 | Orch WABA + CRM stage | **DONE** |
| M8 Next-contact reminder | v1.0 | — | **DONE** |
| M9 Lead scoring / SLA | v1.0 | — | **DONE** |
| M10 Pipeline automation | v1.1 | pipeline-rules | **DONE** |
| M11 Party profile | v3.0 | individual + legal, VÖEN, sector, partner tag | **DONE** |
| M12 Lead card page | v3.0 | `/leads/[id]` | **DONE** |
| M13 Create lead UI | v3.0 | form on `/leads` | **DONE** |
| M14 Prospect import | v3.0 | CSV/XLSX from e-taxes enrichment | **DONE** |
| M15 Finance auto-CP | v3.0 | extended convert event | **DONE** |
| M16 Individual FIN | v3.0 | MDM `globalPersonId` | **DONE** |
| M17–M21 | v3.1 | Bitrix backlog: inbox, timeline, merge, Partner, import mapper | **DEFERRED** |
| M22–M28 | v4.0 | KPI, Contact/Company, custom fields, quotes, calendar, comms | **DEFERRED** |
| M29–M30 | v5.0+ | Mobile, field ACL | **DEFERRED** |
| Events | — | converted, visit logged |
| Growth | — | DELIVERY C4 · v3.0 ADR [crm-lead-party-model](../adr/crm-lead-party-model-and-prospect-import.md) |

---

## era-auto-service

| Module | Since | Notes |
|--------|-------|-------|
| M0 Shell | — | **DONE** |
| M1 Customer vehicle card | — | `/api/vehicles` + WO UI | **DONE** |
| M2 Work order | — | **DONE** |
| M3 Labor lines | — | `/api/work-orders/:id/labor-lines` | **DONE** |
| M4 Parts lines | — | `/api/work-orders/:id/part-lines` + stock check | **DONE** |
| M5 Appointment + bays | v1.0 / v1.1 | Appointments + bay/lift | **DONE** |
| M6 Interactive intake | v1.0 | — | **DONE** |
| M7 VIN / parts catalogue API | v1.1 | TecDoc mock | **DONE** |
| M8 Shop floor timer | v1.0 | — | **DONE** |
| M9 Parts status on WO | v1.0 | — | **DONE** |
| M10 Vehicle history (VIN) | v1.0 | — | **DONE** |
| M11 B2B parts procurement | v1.1 | FINANCE PO | **DONE** |
| M12 Tool crib | v2.0 | `/api/tools` checkout | **DONE** |
| Events | — | `WORK_ORDER_CLOSED` |

---

## era-clinic

Product lines & presets: [ADR clinic-product-lines-and-presets](./adr/clinic-product-lines-and-presets.md) · [CLINIC-FULL-IMPLEMENTATION-PLAN.md](../era-clinic/doc/CLINIC-FULL-IMPLEMENTATION-PLAN.md)

| Module | Since | Notes | Pricing key |
|--------|-------|-------|--------------|
| M0 Shell | — | **DONE** | `clinic_shell` |
| M1 Patient ref | — | **DONE** | `clinic_patients` |
| M2 Practitioners / rooms | — | **DONE** | `clinic_schedule` |
| M3 Appointments | — | **DONE** | `clinic_appointments` |
| M4 Visit card | — | **DONE** | `clinic_visit` |
| M5 Lab (+ critical flag) | v1.0 | Critical flags on results — **DONE** | `clinic_lab` |
| M6 Price cache | v1.0 | Finance price list — **DONE** | `clinic_service_catalog` |
| M7 Notifications | v2.0 | → platform pack — **DONE** | `clinic_notifications` |
| M8 Patient portal | v2.0 | `/portal` session — **DONE** | `clinic_portal` |
| M9 Multi-room drag schedule | v1.0 | Reschedule API — **DONE** | `clinic_reschedule` |
| M10 EHR / CPOE lite | v1.1 | visit CPOE — **DONE** | `clinic_ehr` |
| M11 LIS HL7 import | v1.1 | `/api/lab/import` — **DONE** | `clinic_lis_import` |
| M12 Insurance eligibility | v1.1 | FINANCE proxy — **DONE** | `clinic_insurance` |
| M13 Inpatient beds | v1.1 | ward-lite stub → preset `inpatient_day` — **PARTIAL** | `clinic_inpatient` |
| M3e Procedure TTK | — | BOM → Finance inventory — **API** (CLI-47; UAT open) | — |
| M14 Telehealth + portal | v1.0 | **DONE** | `clinic_telehealth` |
| K5 Sanatorium bridge | — | **DONE** | — |
| Presets | 2026-06 | outpatient / sanatorium / inpatient_day / wellness — **PLANNED** | — |
| Events | — | visit + lab completed | — |
| Growth | — | DELIVERY K6 | — |

Satellite gate: `industry_clinic`. Clinic module keys live in orchestrator `pricing_modules` (`satelliteKey = industry_clinic`), default free.

---

## era-wholesale

| Module | Since | Notes |
|--------|-------|-------|
| M0 Shell | — | **DONE** |
| M1 B2B order entry | — | **DONE** |
| M2 Credit limit display | — | **DONE** |
| M3 Pick/pack workflow | — | **DONE** |
| M4 Confirm shipment | — | **DONE** |
| M5 Delivery note (TTN) | v1.0 | — | **DONE** |
| M6 Pick wave / route lite | v1.0 | — | **DONE** |
| M7 EDI / buyer API | v1.1 | `/api/edi/export` | **DONE** |
| Events | — | `ORDER_CONFIRMED` |

---

## era-orchestrator (control plane)

| Module | Notes | Status |
|--------|-------|--------|
| M1 Auth / SSO | Login, exchange, switch org | **DONE** |
| M2 Memberships / RBAC | Access, transfer, disputes | **DONE** |
| M3 Entitlements validate | Billing block, module gate | **DONE** |
| M4 Event gateway | Fan-out to Finance worker | **DONE** |
| M5 MDM Phase 1 | Global person registry + satellite `linkPersonIdentity` | **DONE** |
| M6 Ownership dispute | CP1 procedure | **DONE** |
| M7 Billing SoT | CP-BILLING post-paid | **DONE** |
| M8 Platform add-ons API | [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md) CP-B2–B8 | **Live** |
| M9 Launcher web | `:3100` module grid | **DONE** |

**ADR:** [control-plane-billing-migration.md](../era-orchestrator/doc/adr/control-plane-billing-migration.md)

---

## Platform reference data (`era-data-hub` / `platform_reference_data`)

ADDON — not an industry satellite. CBAR FX, HS tariffs, calendar, banks, geo, COA templates.

| ID | Capability | API | Status |
|----|------------|-----|--------|
| DH-FX-01 | CBAR FX ingest + `/registry/v1/fx/*` | rates, range, convert | **SHIPPED** |
| DH-CAL-01 | Production calendar AZ multi-year | `/calendar/az/*` | **SHIPPED** |
| DH-HS-01 | HS tariff effective-dated | `/hs/:code/tariff` | **SHIPPED** |
| FC-DH-HANDOFF | Industry Finance proxies (fx/hs/voen preview) | finance API | **SHIPPED** |

ADR: [reference-data-ecosystem.md](./adr/reference-data-ecosystem.md) · [fx-rates-ecosystem.md](./adr/fx-rates-ecosystem.md) · [era-data-hub.md](./adr/era-data-hub.md) · consumer: [DATA-HUB-CONSUMER.md](../era-data-hub/doc/DATA-HUB-CONSUMER.md).

---

## Banking (Core Banking System — `industry_banking`)

Two apps (ADR D9): **`era-bank-core`** = headless regulated engine (CBS); **`era-bank`** = operational satellite (`industry_banking`); **`era-bank-dbo`** = customer channel. Licensed per bank (one deployment = one bank). Bank's corporate ERP stays in **finance-core**.

**Product envelope:** Full commercial AZ CBS (PRD §4 + FC/XO roadmap) — **mvp** until product-depth + Pilot field; not ga. SSOT: [Bank-Capability-Inventory.md](./acceptance/Bank-Capability-Inventory.md) · [Bank-Full-CBS-Roadmap.md](./acceptance/Bank-Full-CBS-Roadmap.md). Live/cert: [CERTIFICATION-TRACK.md](../era-bank/doc/CERTIFICATION-TRACK.md).

**Docs:** [era-bank-core/PRD.md](../era-bank-core/PRD.md) · [TZ.md](../era-bank-core/TZ.md) · [era-bank/PRD.md](../era-bank/PRD.md) · ADR [era-bank-core.md](./adr/era-bank-core.md) · [Bank-Acceptance-System](./acceptance/Bank-Acceptance-System.md).

| Module key | Module | Layer | Status |
|------------|--------|-------|--------|
| `banking_core` | Kernel: CBAR GL, posting, CIF, accounts/holds, EOD/EOM, Product Factory, Branch/МФР, audit | L1 mandatory | **MVP (lab)** |
| `banking_deposits` | Deposits/savings (+ADİF tagging) | L2 | **MVP (lab)** |
| `banking_loans` | Loans + schedule/repay; lines/app WF; AKB/ƏMDK/ECL paths | L2 | **MVP (lab)** — live AKB/certified ECL DECLARED |
| `banking_cards` | Cards issuing/limits; processor gateway; 3DS/dispute stubs | L2 | **MVP** — mock gateway; live YC-E2 |
| `banking_payments` | Payments hub + SO/VA/cheque/sweep | L2 | **MVP (lab)** — stub rails; live YC-E1 |
| `banking_aml` | AML/CFT/KYC + FMN + case/RTF lab | L2 | **MVP (lab)** — seed screen; live sanctions BLOCKED |
| `banking_treasury` | Treasury / ALM / liquidity GAP | L2 | **MVP (lab)** — not full markets FO |
| `banking_dbo` | Digital banking + H2H/OB + ASAN/SİMA | L2 | **MVP (lab)** — ASAN stub; live YC-E3 |
| `banking_regreporting` | CBAR prudential + FATCA/CRS | L2 | **MVP (lab)** — stub templates; live YC-E5 |
| `banking_risk` | ECL/RWA/CAR/LCR + IRRBB/OpRisk inputs | L2 | **MVP (lab)** — not certified |
| `banking_trade` | LC / BG / DC / SCF / SWIFT outbox | L2 | **MVP (lab)** — ops `/trade`; SWIFT stub |
| `banking_collections` | Collections / recovery SoD | L2 | **MVP (lab)** — ops `/collections` |
| `banking_cash` | Vault/till/CIT + inventory + queue | L2 | **MVP (lab)** — ops `/cash` + `/fees` |
| `banking_islamic` | Murabaha/Mudarabah window | L2 | **MVP (lab)** — ops `/islamic` |
| `banking_wealth` | Safekeeping positions (thin) | L2 | **MVP (lab)** — ops `/wealth`; no FO/CSD |

**Still OUT (do not sell):** derivatives FO, own ATM/scheme, pension/PSA, enterprise MIS/BPM/DMS, multi-entity holding — see Capability Inventory. Do not mark MODULES **DONE** as edition ga.

A `banking_*` module spans engine + ops UI (except `banking_dbo` → `era-bank-dbo`). Money is ACID; no parallel ledger in risk. Phases P0–P7 + risk lab in PRD §7 / TZ §12–§14.

---

## MVP backlog (priority)

Tracked closure: [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) § MVP backlog closure. **Closed 2026-05-26** except tier-gated rows below.

| P | App | Module | Status | Work |
|---|-----|--------|--------|------|
| P0 | era-auto-service | M1, M3, M4 | **DONE** | WO UI, VÖEN lookup, stock check on parts |
| P0 | era-finance-core | Billing meter | **DONE** | Intraday invoice + `billing-meter.service.spec.ts` |
| P0 | era-orchestrator | M9 Launcher | **DONE** | SP9 UAT |
| P1 | era-retail-pos | M0–M7, M11–M13 | **DONE** | TZ/UAT/SMOKE; M1 via shift preset + outlets doc |
| P2 | era-wholesale | M0–M6 | **DONE** | TZ/UAT/SMOKE |
| P2 | era-clinic | M0–M4, K5 | **DONE** | MDM intake + sanatorium smoke |
| P3 | era-logistics | M0–M2, M13 | **DONE** | Core shell + tracking UAT |
| P3 | era-construction | M0–M4 | **DONE** | Core C1/C2 UAT (M2 BOQ stub documented) |
| P3 | era-crm | M0–M3 | **DONE** | Pipeline/inbox UAT |
| P4 | era-finance-core | Manufacturing, IFRS | **MVP** | Tier 2+/3 — backlog until tier UAT |
| P4 | era-orchestrator | M1–M6 | **DONE** | CP DELIVERY parity |
| — | era-construction | M5 Photo report | **DEFERRED** | v3.1 / ERPs |

---

## Reference deployment pattern

Example stack for a hospitality operator (one of many possible bundles):

1. **Orchestrator** — SSO, billing, entitlements  
2. **Finance** — GL, invoices, purchases, inventory  
3. **Hotel PMS** — operations  
4. **fb-pos** — F&B  

Not a product priority — any vertical mix uses the same control plane + platform add-ons model.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-26 | Product versions v1.0 / v1.1 / v2.0; removed wave/Gemini labels from catalog |
| 2026-05-26 | Sync module statuses with DELIVERY |
| 2026-05-25 | **Module maturity:** false PLANNED cleared (v1.1 → DONE); v1.0/v2.0 hospitality/retail/FB promoted; Auto M1/M3/M4 API; Finance Status column; Orch launcher **MVP** |
| 2026-05-26 | **MVP backlog closure:** roadmap summary sync; READINESS §4 regen; catalog MVP→DONE (except Manufacturing/IFRS tier); Auto WO UI; Phase 16 intraday invoice |
