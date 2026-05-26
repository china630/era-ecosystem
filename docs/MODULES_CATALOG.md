# ERA ecosystem — modules catalog

Functional modules per application. **Finance** = source of truth for GL, sales/purchase documents, inventory, counterparty MDM. **Orchestrator** = identity, billing, entitlements, platform add-ons. Satellites = vertical operations + events.

**Architecture:** [CONTROL_PLANE_ARCHITECTURE.md](./CONTROL_PLANE_ARCHITECTURE.md) · **Platform add-ons:** [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md)

Industry Solutions entitlements (Finance sidebar): see [industry-satellite-sync.md](../era-finance-core/docs/industry-satellite-sync.md).

**Industry enrichment (Gemini ERP research):** [Industry enrichment backlog](#industry-enrichment-backlog-gemini-erp--era) below · source files in [`ERPs/`](../ERPs/).

---

## Industry enrichment backlog (Gemini ERP → ERA)

Cross-cutting backlog from [`ERPs/`](../ERPs/) decomposition. Full module IDs are in each app **`PRD.md` §4**. **W1** = implementation queue now · **W2** = documented next wave (same enrichment program).

**Note:** **M11 / M12** module IDs exist only in **`era-retail-pos`** (promotions at checkout, customer at POS).

### W1 — implementation queue (4 apps)

| App | PRD module | Capability | Owner | Status |
|-----|------------|------------|-------|--------|
| era-retail-pos | M11, M12, M7, M2 ext | Promotions, customer, product cache, X-report | SATELLITE + platform_loyalty | **MVP** |
| era-crm-field | M4 ext, M8 | Visit geo, next-contact | SATELLITE + notifications | **MVP** |
| era-clinic | M5 ext, M6 | Critical lab, price cache | SATELLITE | **MVP** |
| era-logistics | M3, M4 ext, M7 | Waybill, POD media, fleet compliance | SATELLITE | **MVP** |

### W2 — documented backlog (all industry satellites)

| App | PRD module | Capability | Gemini | Owner | Status |
|-----|------------|------------|--------|-------|--------|
| era-retail-pos | M13 | Omnichannel OMS (pickup, BOPIS) | 03 §6 | PLATFORM `delivery` + retail | **W2 MVP** |
| era-retail-pos | M14 | Mobile stock / label check (WMS lite) | 03 §7 | SATELLITE stub | W2 DEFERRED |
| era-retail-pos | M15 | Auto-replenishment / PO suggest | 03 §4 | FINANCE purchases | W2 DEFERRED |
| era-retail-pos | M16 | Supplier contracts & invoice match | 03 §8 | FINANCE | W2 DEFERRED |
| era-construction | M6 | Field daily log (прораб) | 05 §3 | SATELLITE | **W2 MVP** |
| era-construction | M7 | Punch list / defects | 05 §3 | SATELLITE | **W2 MVP** |
| era-construction | M8 | Gantt / CPM scheduling | 05 §2 | DEFERRED | W2 DEFERRED |
| era-construction | M9 | Subcontractor progress claims | 05 §5 | SATELLITE lite | **W2 MVP** |
| era-construction | M10 | Site equipment / machine hours | 05 §6 | SATELLITE | W2 DEFERRED |
| era-construction | M11 | CDE / drawing versions | 05 §7 | DEFERRED | W2 DEFERRED |
| era-construction | M12 | Labor timesheets / SKUD | 05 §8 | DEFERRED | W2 DEFERRED |
| era-auto-sto | M5 | Appointment + bay calendar | 02 §1 | SATELLITE + booking | W2 PLANNED |
| era-auto-sto | M6 | Interactive intake (photos, checklist) | 02 §1 | SATELLITE | **W2 MVP** |
| era-auto-sto | M7 | Parts catalogue VIN / cross | 02 §3 | DEFERRED integration | W2 DEFERRED |
| era-auto-sto | M8 | Shop floor time tracking | 02 §4 | SATELLITE | **W2 MVP** |
| era-auto-sto | M9 | Parts status on WO | 02 §3 | SATELLITE | **W2 MVP** |
| era-auto-sto | M10 | Vehicle history by VIN | 02 §7 | SATELLITE | **W2 MVP** |
| era-auto-sto | M11 | B2B parts order from WO | 02 §6 | FINANCE PO | W2 DEFERRED |
| era-auto-sto | M12 | Tool crib / equipment | 02 §8 | DEFERRED | W2 DEFERRED |
| era-wholesale | M5 | Delivery note / TTN | retail OMS | SATELLITE | **W2 MVP** |
| era-wholesale | M6 | Pick route / wave (lite) | 03 §7 | SATELLITE | **W2 MVP** |
| era-wholesale | M7 | EDI / buyer API export | — | DEFERRED | W2 DEFERRED |
| era-logistics | M8 | Multi-stop trip / trip_points | 06 §2 | SATELLITE | **W2 MVP** |
| era-logistics | M9 | Driver mobile workflow API | 06 §3 | SATELLITE | **W2 MVP** |
| era-logistics | M10 | Rate matrix / tariff engine | 06 §7 | FINANCE | W2 DEFERRED |
| era-logistics | M11 | COD split & clearing | 06 §4 | FINANCE | W2 DEFERRED |
| era-logistics | M12 | Hub cross-dock scanning | 06 §6 | DEFERRED | W2 DEFERRED |
| era-logistics | M13 | Customer tracking portal | 06 §8 | PLATFORM portal | **W2 MVP** |
| era-clinic | M9 | Multi-room drag reschedule | 07 §1 | SATELLITE | **W2 MVP** |
| era-clinic | M10 | EHR templates / CPOE lite | 07 §2 | SATELLITE stub | W2 DEFERRED |
| era-clinic | M11 | LIS analyzer import (HL7/file) | 07 §3 | DEFERRED | W2 DEFERRED |
| era-clinic | M12 | Insurance / DMS eligibility | 07 §6 | FINANCE contracts | W2 DEFERRED |
| era-clinic | M13 | Inpatient / bed management | 07 §7 | DEFERRED | W2 DEFERRED |
| era-clinic | M14 | Telehealth + patient portal | 07 §8 | PLATFORM portal | **W2 MVP** |
| era-crm-field | M9 | Lead scoring / SLA | Kommo | SATELLITE | **W2 MVP** |
| era-crm-field | M10 | Pipeline automation rules | Bitrix | DEFERRED | W2 DEFERRED |
| era-fb-pos | M11 | KDS course timing | 04 §2 | SATELLITE | **W2 MVP** |
| era-fb-pos | M12 | Recipe / BOH depletion engine | 04 §3 | FINANCE mfg + SATELLITE | **W2 MVP** |
| era-fb-pos | M13 | Delivery aggregator inbox | 04 §6 | PLATFORM delivery | **W2 MVP** |
| era-fb-pos | M14 | Labor roster / PIN clock | 04 §8 | SATELLITE | W2 DEFERRED |
| era-hotel-pms | M20 | Yield management (dynamic BAR) | 01 §1 | SATELLITE | **W2 MVP** |
| era-hotel-pms | M21 | Guest loyalty tiers | 01 §7 | PLATFORM loyalty | **W2 MVP** |
| era-hotel-pms | M22 | Room service QR menu | 01 §6 | SATELLITE + fb-pos | **W2 MVP** |
| era-hotel-pms | M23 | Maintenance work orders | 01 §5 ext | SATELLITE | **W2 MVP** |

**Plans:** W1/W2 enrichment programs **complete** 2026-05-28 (Cursor plans archived/removed). Next: DEFERRED rows below + per-app DELIVERY.

---

## Platform add-ons (orchestrator — cross-cutting)

Sold via `organization_modules` / pricing catalog; API under `/platform/*` on **era-365-orchestrator**. Not duplicated in satellites.

| Add-on | Slug (draft) | Serves |
|--------|--------------|--------|
| Notifications Pack | `platform_notifications` | WA / email / SMS transactional — **Live (CP-B2)** |
| Online Booking Widget | `platform_booking` | Clinic, auto-sto, retail pickup, hotel spa — **MVP API (CP-B3)** |
| Customer Portal | `platform_portal` | Orders, visits, documents, pay — **MVP API (CP-B4)** |
| Payment links & deposits | `platform_payments` | Invoice pay-by-link, booking deposit — **MVP API (CP-B5)** |
| Loyalty & promotions | `platform_loyalty` | Promo codes, points — **MVP API (CP-B6)** |
| Custom domain & white-label | `platform_domain` | Branded storefront — **MVP API (CP-B7)** |
| Delivery orchestration | `platform_delivery` | Retail + logistics — **MVP API (CP-B8)** |

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

| Module | Wave | Area | Status |
|--------|------|------|--------|
| M1–M15 Core PMS | — | book, folio, NA, HK, channel, ERP | **DONE** (see DELIVERY) |
| M16 POS bridge | — | fb-pos room charge | **DONE** |
| M17 Sanatorium / medical | — | clinic bridge | **DONE** |
| M18 Stock MVP | — | `/admin/stock` | **MVP** |
| M19 Banquets BEO | — | `/banquets` | **MVP** |
| M20 Yield management | **W2** | Dynamic BAR rules | **PLANNED** |
| M21 Guest loyalty | **W2** | Tiers, points | **PLATFORM** |
| M22 Room service QR | **W2** | In-room ordering → fb-pos | **PLANNED** |
| M23 Maintenance WO | **W2** | HK → engineering tasks | **PLANNED** |
| Invoices / agency CL | — | reports | Read → Finance |

**Backlog:** [era-hotel-pms/doc/BACKLOG-PRODUCTION.md](../era-hotel-pms/doc/BACKLOG-PRODUCTION.md) · PRD module table: [era-hotel-pms/PRD.md](../era-hotel-pms/PRD.md)

---

## era-fb-pos (F&B POS)

| Module | Wave | Screens / API | Notes |
|--------|------|---------------|-------|
| M0 Shell | — | layout | **IN_PROGRESS** |
| M1 Menu / outlet | — | `/admin/menu` | **PLANNED** |
| M2 Floor + ticket | — | `/floor` | **PLANNED** |
| M3 KDS | — | `/kds` | **PLANNED** |
| M4 Payments | — | pay API | **PLANNED** |
| M5 Room charge | — | PMS bridge | **PLANNED** |
| M6 Shifts X/Z | — | Z-close | **PLANNED** |
| M7 Void / discount | — | — | **PLANNED** |
| M8 Split bill | — | — | **DEFERRED** |
| M9 Recipe consumption | — | — | **DEFERRED** |
| M10 i18n | — | — | **DEFERRED** |
| M11 KDS course timing | **W2** | `/kds` | Fire by course |
| M12 Recipe / BOH engine | **W2** | admin | Depletion stub → Finance |
| M13 Delivery aggregator | **W2** | — | **PLATFORM** `delivery` |
| M14 Labor roster PIN | **W2** | — | **DEFERRED** |
| Banquet BEO | — | — | HN-8 hotel |

**Backlog:** [era-fb-pos/doc/BACKLOG-PRODUCTION.md](../era-fb-pos/doc/BACKLOG-PRODUCTION.md)

---

## era-retail-pos

| Module | Wave | Notes |
|--------|------|-------|
| M0–M6(d) | — | Shell, shift, checkout, presets — **MVP** |
| M7 Product lookup | **W1** | Read cache Finance SKU — **PLANNED** |
| M8 Offline queue | — | **DEFERRED** |
| M9 Fiscal KKM | — | **DEFERRED** |
| M10 Marketplace sync | — | **DEFERRED** |
| **M11 Promotions (lite)** | **W1** | Cart before pay + `platform_loyalty` |
| **M12 Customer at POS** | **W1** | Phone / loyalty ref |
| M2 X-report | **W1** | Mid-shift without Z-close |
| M13 Omnichannel OMS | **W2** | BOPIS, pickup — `platform_delivery` |
| M14 Mobile stock / labels | **W2** | **DEFERRED** |
| M15 Auto-replenishment | **W2** | **FINANCE** |
| M16 Supplier SRM | **W2** | **FINANCE** |
| Events | — | sale completed, shift closed |
| Growth | — | Platform on pay — DELIVERY R5 |

---

## era-logistics

| Module | Wave | Notes |
|--------|------|-------|
| M0 Shell | — | **MVP** |
| M1 Fleet | — | **PLANNED** |
| M2 Trips | — | **MVP** |
| M3 Waybill | **W1** | Путевой лист — **PLANNED** |
| M4 POD (+ media) | W1/W2 | Text **MVP**; photo URL **W1** |
| M5 Fuel reports | — | **MVP** |
| M6 Customs hub | — | **MVP** (L3) |
| M7 Fleet compliance | **W1** | Doc expiry alerts |
| M8 Multi-stop trips | **W2** | `trip_points` |
| M9 Driver mobile API | **W2** | Workflow для водителя |
| M10 Rate matrix | **W2** | **FINANCE** |
| M11 COD clearing | **W2** | **FINANCE** |
| M12 Hub cross-dock | **W2** | **DEFERRED** |
| M13 Customer tracking | **W2** | **PLATFORM** portal |
| Events | — | `TRIP_COMPLETED` |
| Growth | — | DELIVERY L4 |

---

## era-construction

| Module | Wave | Notes |
|--------|------|-------|
| M0 Shell | — | **MVP** |
| M1 Project / site | — | **PLANNED** |
| M2 BOQ (смета) | — | **PLANNED** |
| M3 Material requisition | — | **MVP** (C2) |
| M4 Progress act (КС) | — | **MVP** (C1) |
| M5 Photo report | — | **DEFERRED** |
| M6 Field daily log | **W2** | Прораб: объём, погода, фото |
| M7 Punch list / defects | **W2** | Задачи субподрядчику |
| M8 Gantt / CPM | **W2** | **DEFERRED** |
| M9 Subcontractor claims | **W2** | Акты субподряда lite |
| M10 Site equipment hours | **W2** | **DEFERRED** |
| M11 CDE drawings | **W2** | **DEFERRED** |
| M12 Labor timesheets | **W2** | **DEFERRED** |
| Events | — | `PROGRESS_ACT_APPROVED` |
| Growth | — | Platform on act — DELIVERY C3 |

---

## era-crm-field

| Module | Wave | Notes |
|--------|------|-------|
| M0 Shell | — | **MVP** |
| M1 Pipeline | — | **MVP** (C1) |
| M2 Lead card / timeline | — | **MVP** |
| M3 Inbox stub | — | **MVP** |
| M4 Visit (+ geo) | W1 | Visit log; geo **W1 PLANNED** |
| M5 Convert lead | — | **MVP** |
| M6 Finance handoff link | — | **PLANNED** |
| M7 Live WA Business API | — | **DEFERRED** |
| M8 Next-contact reminder | **W1** | `platform_notifications` |
| M9 Lead scoring / SLA | **W2** | **DEFERRED** |
| M10 Pipeline automation | **W2** | **DEFERRED** |
| Events | — | converted, visit logged |
| Growth | — | DELIVERY C4 |

---

## era-auto-sto

| Module | Wave | Notes |
|--------|------|-------|
| M0 Shell | — | **MVP** |
| M1 Customer vehicle card | — | **PLANNED** |
| M2 Work order | — | **MVP** |
| M3 Labor lines | — | **PLANNED** |
| M4 Parts lines | — | **PLANNED** |
| M5 Appointment + bays | **W2** | Календарь постов + `platform_booking` |
| M6 Interactive intake | **W2** | Фото, чеклист приёмки |
| M7 VIN / parts catalogue API | **W2** | **DEFERRED** (TecDoc…) |
| M8 Shop floor timer | **W2** | План/факт нормо-часов |
| M9 Parts status on WO | **W2** | ordered → arrived → issued |
| M10 Vehicle history (VIN) | **W2** | Timeline ремонтов |
| M11 B2B parts procurement | **W2** | **FINANCE** PO |
| M12 Tool crib | **W2** | **DEFERRED** |
| Events | — | `WORK_ORDER_CLOSED` |

---

## era-clinic

| Module | Wave | Notes |
|--------|------|-------|
| M0 Shell | — | **MVP** |
| M1 Patient ref | — | **MVP** |
| M2 Practitioners / rooms | — | **MVP** |
| M3 Appointments | — | **MVP** |
| M4 Visit card | — | **MVP** |
| M5 Lab (+ critical flag) | W1 | K2 **MVP**; critical UI **W1** |
| M6 Price cache | **W1** | Finance price list |
| M7 Notifications | — | **DEFERRED** → platform |
| M8 Patient portal | — | **DEFERRED** |
| M9 Multi-room drag schedule | **W2** | K3 |
| M10 EHR / CPOE lite | **W2** | **DEFERRED** |
| M11 LIS HL7 import | **W2** | **DEFERRED** |
| M12 Insurance eligibility | **W2** | **FINANCE** |
| M13 Inpatient beds | **W2** | **DEFERRED** |
| M14 Telehealth + portal | **W2** | **PLATFORM** |
| K5 Sanatorium bridge | — | **MVP** |
| Events | — | visit + lab completed |
| Growth | — | DELIVERY K6 |

---

## era-wholesale

| Module | Wave | Notes |
|--------|------|-------|
| M0 Shell | — | **MVP** |
| M1 B2B order entry | — | **MVP** |
| M2 Credit limit display | — | **MVP** |
| M3 Pick/pack workflow | — | **MVP** |
| M4 Confirm shipment | — | **MVP** |
| M5 Delivery note (TTN) | **W2** | Печать/экспорт накладной |
| M6 Pick wave / route lite | **W2** | Волна сборки |
| M7 EDI / buyer API | **W2** | **DEFERRED** |
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
