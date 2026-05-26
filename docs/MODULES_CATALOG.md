# ERA ecosystem — modules catalog

Functional modules per application. **Finance** = source of truth for GL, sales/purchase documents, inventory, counterparty MDM. **Orchestrator** = identity, billing, entitlements, platform add-ons. Satellites = vertical operations + events.

**Versions:** [PRODUCT_VERSIONING.md](./PRODUCT_VERSIONING.md) — **v1.0** = shipped; **v1.1** / **v2.0** = planned.

**Architecture:** [CONTROL_PLANE_ARCHITECTURE.md](./CONTROL_PLANE_ARCHITECTURE.md) · **Platform add-ons:** [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md)

Industry Solutions entitlements (Finance sidebar): see [industry-satellite-sync.md](../era-finance-core/docs/industry-satellite-sync.md).

**Industry modules:** [cross-app roadmap](#industry-module-roadmap) · research index [`ERPs/`](../ERPs/) · versioning rules [PRODUCT_VERSIONING.md](./PRODUCT_VERSIONING.md).

---

## Industry module roadmap

Module IDs — each app **`PRD.md` §4**. **M11 / M12** (promotions, customer at POS) — только **`era-retail-pos`**.

### Shipped in v1.0

| App | Module | Capability | Owner | Status |
|-----|--------|------------|-------|--------|
| era-retail-pos | M7, M11, M12, M2 ext, M13 | Product cache, promos, customer, X-report, BOPIS | SATELLITE + platform | **MVP** |
| era-crm-field | M4 ext, M8, M9 | Visit geo, next-contact, lead score | SATELLITE + platform | **MVP** |
| era-clinic | M5 ext, M6, M9, M14 | Critical lab, price cache, reschedule, telehealth | SATELLITE + platform | **MVP** |
| era-logistics | M3, M4 ext, M7, M8, M9, M13 | Waybill, POD media, fleet, multi-stop, driver API, tracking | SATELLITE + platform | **MVP** |
| era-construction | M6, M7, M9 | Daily log, punch list, subcontractor claims | SATELLITE | **MVP** |
| era-auto-sto | M6, M8, M9, M10 | Intake, shop floor, parts status, vehicle history | SATELLITE | **MVP** |
| era-wholesale | M5, M6 | TTN, pick waves | SATELLITE | **MVP** |
| era-fb-pos | M11, M12, M13 | KDS courses, recipe depletion, delivery inbox | SATELLITE + platform | **MVP** |
| era-hotel-pms | M20–M23 | Yield, loyalty, room-service QR, maintenance WO | SATELLITE + platform | **MVP** |

### Planned v1.1

| App | Module | Capability | Owner |
|-----|--------|------------|-------|
| era-retail-pos | M14–M16 | Mobile stock, replenishment, supplier SRM | SATELLITE + FINANCE |
| era-crm-field | M10 | Pipeline automation | SATELLITE |
| era-clinic | M10–M13 | EHR lite, LIS import, insurance, inpatient | SATELLITE + FINANCE |
| era-logistics | M10–M12 | Rate matrix, COD clearing, hub cross-dock | FINANCE + SATELLITE |
| era-construction | M8, M10–M12 | Gantt, equipment hours, CDE, timesheets | SATELLITE / DEFERRED |
| era-auto-sto | M5 ext, M7, M11 | Bay calendar, VIN catalogue, B2B parts PO | SATELLITE + FINANCE |
| era-wholesale | M7 | EDI / buyer API export | SATELLITE |
| era-fb-pos | M14 | Labor roster / PIN clock | SATELLITE |

### Planned v2.0

| App | Module | Capability | Owner |
|-----|--------|------------|-------|
| era-retail-pos | M8–M10 | Offline queue, fiscal KKM, marketplace sync | SATELLITE + FINANCE |
| era-auto-sto | M12 | Tool crib / equipment | SATELLITE |
| Platform | CP-B3–B8 | Booking, portal, payments, loyalty, domain, delivery → **Live** | orchestrator |

---

## Platform add-ons (orchestrator — cross-cutting)

Sold via `organization_modules` / pricing catalog; API under `/platform/*` on **era-365-orchestrator**. Not duplicated in satellites.

| Add-on | Slug (draft) | Serves |
|--------|--------------|--------|
| Notifications Pack | `platform_notifications` | WA / email / SMS — **Live** (v1.0) |
| Online Booking Widget | `platform_booking` | Clinic, auto-sto, retail, hotel — **MVP** (v1.0); **Live** → v2.0 |
| Customer Portal | `platform_portal` | Orders, visits, documents — **MVP** (v1.0); **Live** → v2.0 |
| Payment links & deposits | `platform_payments` | Pay-by-link, deposits — **MVP** (v1.0); **Live** → v2.0 |
| Loyalty & promotions | `platform_loyalty` | Promo codes, points — **MVP** (v1.0); **Live** → v2.0 |
| Custom domain & white-label | `platform_domain` | Branded storefront — **MVP** (v1.0); **Live** → v2.0 |
| Delivery orchestration | `platform_delivery` | Retail + logistics — **MVP** (v1.0); **Live** → v2.0 |

Detail: [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md).

---

## era-finance-core (ERP / accounting satellite)

| Module | Routes / area | Notes |
|--------|---------------|-------|
| Chart of accounts (NAS) | `/chart-of-accounts` | Template + org COA |
| Journal / GL | NAS entries, mapping | Satellite event worker |
| Sales invoices | `/sales/invoices` | **Source of truth** for issued invoices |
| Purchases | `/purchases` | Supplier receipts, PO |
| Inventory | `/inventory/*` | Warehouses, movements, audits, settings |
| CRM / counterparties | `/crm/counterparties` | MDM; reconciliation per agency |
| Bank & cash | Banking pro, kassa | Tier-gated |
| Tax / compliance | Tax pro, trade pro | AZ integrations |
| HR & payroll | HR module | |
| Manufacturing | Recipes, orders, release | Tier 2+ |
| Fixed assets | FA registry | |
| IFRS mapping | IFRS reports | Tier 3 |
| Industry Solutions UI | Redirect → Orch `:3100` | **Orchestrator only** (SP9); Finance `/industry/*` redirects |
| In-app staff notifications | Bell in web shell | **Not** customer Notifications Pack |
| Satellite GL dispatch | API worker | Consumes orchestrator events → journals |

**Billing & platform (2026-05):** subscription, billing, referrals, early-access, public pricing — **orchestrator only**. Finance web proxies via `/cp/*`. Notifications Pack live when `ERA_NOTIFICATIONS_PACK=true`. See [CP-BILLING-MIGRATION.md](./CP-BILLING-MIGRATION.md).

**Moving out to orchestrator:** ~~subscription snapshot, `/api/billing/*`~~ **Done (CP-BILLING)**. Quota metering authority on CP. WhatsApp Pack via `/platform/notifications/v1/send`.

---

## era-hotel-pms (Hospitality PMS)

| Module | Since | Area | Status |
|--------|-------|------|--------|
| M1–M15 Core PMS | — | book, folio, NA, HK, channel, ERP | **DONE** (see DELIVERY) |
| M16 POS bridge | — | fb-pos room charge | **DONE** |
| M17 Sanatorium / medical | — | clinic bridge | **DONE** |
| M18 Stock MVP | — | `/admin/stock` | **MVP** |
| M19 Banquets BEO | — | `/banquets` | **MVP** |
| M20 Yield management | v1.0 | Dynamic BAR rules | **MVP** |
| M21 Guest loyalty | v1.0 | Tiers, points | **MVP** + PLATFORM |
| M22 Room service QR | v1.0 | In-room ordering → fb-pos | **MVP** |
| M23 Maintenance WO | v1.0 | HK → engineering tasks | **MVP** |
| Invoices / agency CL | — | reports | Read → Finance |

**Backlog:** [era-hotel-pms/doc/BACKLOG-PRODUCTION.md](../era-hotel-pms/doc/BACKLOG-PRODUCTION.md) · PRD module table: [era-hotel-pms/PRD.md](../era-hotel-pms/PRD.md)

---

## era-fb-pos (F&B POS)

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
| M11 KDS course timing | v1.0 | fire-course API | **MVP** |
| M12 Recipe / BOH engine | v1.0 | ticket close depletion | **MVP** |
| M13 Delivery aggregator | v1.0 | delivery-inbox | **MVP** |
| M14 Labor roster PIN | v1.1 | — | **PLANNED** |
| Banquet BEO | — | — | HN-8 hotel |

**Backlog:** [era-fb-pos/doc/BACKLOG-PRODUCTION.md](../era-fb-pos/doc/BACKLOG-PRODUCTION.md)

---

## era-retail-pos

| Module | Since | Notes |
|--------|-------|-------|
| M0–M6(d) | — | Shell, shift, checkout, presets — **MVP** |
| M7 Product lookup | v1.0 | Read cache Finance SKU | **MVP** |
| M8 Offline queue | v2.0 | — | **PLANNED** |
| M9 Fiscal KKM | v2.0 | — | **PLANNED** |
| M10 Marketplace sync | v2.0 | — | **PLANNED** |
| M11 Promotions (lite) | v1.0 | Cart before pay | **MVP** |
| M12 Customer at POS | v1.0 | Phone / loyalty ref | **MVP** |
| M2 X-report | v1.0 | Mid-shift without Z-close | **MVP** |
| M13 Omnichannel OMS | v1.0 | BOPIS | **MVP** |
| M14 Mobile stock / labels | v1.1 | WMS lite | **PLANNED** |
| M15 Auto-replenishment | v1.1 | — | **PLANNED** (FINANCE) |
| M16 Supplier SRM | v1.1 | — | **PLANNED** (FINANCE) |
| Events | — | sale completed, shift closed |
| Growth | — | Platform on pay — DELIVERY R5 |

---

## era-logistics

| Module | Since | Notes |
|--------|-------|-------|
| M0 Shell | — | **MVP** |
| M1 Fleet | — | **MVP** (vehicles + `/fleet` alerts) |
| M2 Trips | — | **MVP** |
| M3 Waybill | v1.0 | Путевой лист | **MVP** |
| M4 POD (+ media) | v1.0 | Text + photo/signature | **MVP** |
| M5 Fuel reports | v1.0 | — | **MVP** |
| M6 Customs hub | v1.0 | — | **MVP** |
| M7 Fleet compliance | v1.0 | Doc expiry alerts | **MVP** |
| M8 Multi-stop trips | v1.0 | `trip_points` | **MVP** |
| M9 Driver mobile API | v1.0 | Driver trips API | **MVP** |
| M10 Rate matrix | v1.1 | Tariffs | **PLANNED** (FINANCE) |
| M11 COD clearing | v1.1 | — | **PLANNED** (FINANCE) |
| M12 Hub cross-dock | v1.1 | — | **PLANNED** |
| M13 Customer tracking | v1.0 | Public tracking token | **MVP** |
| Events | — | `TRIP_COMPLETED` |
| Growth | — | DELIVERY L4 |

---

## era-construction

| Module | Since | Notes |
|--------|-------|-------|
| M0 Shell | — | **MVP** |
| M1 Project / site | — | **MVP** (C1) |
| M2 BOQ (смета) | — | **MVP** stub (C1) |
| M3 Material requisition | — | **MVP** (C2) |
| M4 Progress act (КС) | — | **MVP** (C1) |
| M5 Photo report | — | **DEFERRED** |
| M6 Field daily log | v1.0 | — | **MVP** |
| M7 Punch list / defects | v1.0 | — | **MVP** |
| M8 Gantt / CPM | v1.1 | — | **PLANNED** |
| M9 Subcontractor claims | v1.0 | — | **MVP** |
| M10 Site equipment hours | v1.1 | — | **PLANNED** |
| M11 CDE drawings | v1.1 | — | **PLANNED** |
| M12 Labor timesheets | v1.1 | — | **PLANNED** |
| Events | — | `PROGRESS_ACT_APPROVED` |
| Growth | — | Platform on act — DELIVERY C3 |

---

## era-crm-field

| Module | Since | Notes |
|--------|-------|-------|
| M0 Shell | — | **MVP** |
| M1 Pipeline | — | **MVP** (C1) |
| M2 Lead card / timeline | — | **MVP** |
| M3 Inbox stub | — | **MVP** |
| M4 Visit (+ geo) | v1.0 | Visit log + lat/lng | **MVP** |
| M5 Convert lead | v1.0 | — | **MVP** |
| M6 Finance handoff link | v1.0 | convert → Finance | **MVP** |
| M7 Live WA Business API | v2.0 | — | **PLANNED** |
| M8 Next-contact reminder | v1.0 | — | **MVP** |
| M9 Lead scoring / SLA | v1.0 | — | **MVP** |
| M10 Pipeline automation | v1.1 | — | **PLANNED** |
| Events | — | converted, visit logged |
| Growth | — | DELIVERY C4 |

---

## era-auto-sto

| Module | Since | Notes |
|--------|-------|-------|
| M0 Shell | — | **MVP** |
| M1 Customer vehicle card | — | **PLANNED** |
| M2 Work order | — | **MVP** |
| M3 Labor lines | — | **PLANNED** |
| M4 Parts lines | — | **PLANNED** |
| M5 Appointment + bays | v1.0 / v1.1 | Appointments **MVP**; bay/lift extend → **v1.1** |
| M6 Interactive intake | v1.0 | — | **MVP** |
| M7 VIN / parts catalogue API | v1.1 | TecDoc… | **PLANNED** |
| M8 Shop floor timer | v1.0 | — | **MVP** |
| M9 Parts status on WO | v1.0 | — | **MVP** |
| M10 Vehicle history (VIN) | v1.0 | — | **MVP** |
| M11 B2B parts procurement | v1.1 | FINANCE PO | **PLANNED** |
| M12 Tool crib | v2.0 | — | **PLANNED** |
| Events | — | `WORK_ORDER_CLOSED` |

---

## era-clinic

| Module | Since | Notes |
|--------|-------|-------|
| M0 Shell | — | **MVP** |
| M1 Patient ref | — | **MVP** |
| M2 Practitioners / rooms | — | **MVP** |
| M3 Appointments | — | **MVP** |
| M4 Visit card | — | **MVP** |
| M5 Lab (+ critical flag) | v1.0 | Critical flags on results | **MVP** |
| M6 Price cache | v1.0 | Finance price list | **MVP** |
| M7 Notifications | v2.0 | → platform pack | **PLANNED** |
| M8 Patient portal | v2.0 | — | **PLANNED** |
| M9 Multi-room drag schedule | v1.0 | Reschedule API | **MVP** |
| M10 EHR / CPOE lite | v1.1 | — | **PLANNED** |
| M11 LIS HL7 import | v1.1 | — | **PLANNED** |
| M12 Insurance eligibility | v1.1 | FINANCE | **PLANNED** |
| M13 Inpatient beds | v1.1 | — | **PLANNED** |
| M14 Telehealth + portal | v1.0 | — | **MVP** |
| K5 Sanatorium bridge | — | **MVP** |
| Events | — | visit + lab completed |
| Growth | — | DELIVERY K6 |

---

## era-wholesale

| Module | Since | Notes |
|--------|-------|-------|
| M0 Shell | — | **MVP** |
| M1 B2B order entry | — | **MVP** |
| M2 Credit limit display | — | **MVP** |
| M3 Pick/pack workflow | — | **MVP** |
| M4 Confirm shipment | — | **MVP** |
| M5 Delivery note (TTN) | v1.0 | — | **MVP** |
| M6 Pick wave / route lite | v1.0 | — | **MVP** |
| M7 EDI / buyer API | v1.1 | — | **PLANNED** |
| Events | — | `ORDER_CONFIRMED` |

---

## era-365-orchestrator (control plane)

| Module | Notes |
|--------|-------|
| Auth / SSO | Login, exchange, switch org |
| Entitlements validate | Billing block, module gate |
| Event gateway | Fan-out to Finance worker |
| MDM Phase 1 | Global person registry |
| RBAC | Memberships, access requests, ownership |
| **Billing (target SoT)** | Post-paid invoices, modules, tier meter — migrate from Finance |
| **Platform add-ons API** | Notifications, booking, portal, … — [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md) |
| Launcher web (planned) | Entitled apps from one snapshot |

**ADR:** [control-plane-billing-migration.md](../era-365-orchestrator/doc/adr/control-plane-billing-migration.md)

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
