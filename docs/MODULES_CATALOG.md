# ERA ecosystem — modules catalog

Functional modules per application. **Finance** = source of truth for GL, sales/purchase documents, inventory, counterparty MDM. **Orchestrator** = identity, billing, entitlements, platform add-ons. Satellites = vertical operations + events.

**Architecture:** [CONTROL_PLANE_ARCHITECTURE.md](./CONTROL_PLANE_ARCHITECTURE.md) · **Platform add-ons:** [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md)

Industry Solutions entitlements (Finance sidebar): see [industry-satellite-sync.md](../era-finance-core/docs/industry-satellite-sync.md).

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

| Module | Screens / API | Finance boundary |
|--------|-------------|------------------|
| Master data | `/admin/master-data` | Revenue codes → sync event E5 |
| Bookings & chessboard | `/`, `/bookings/new` | — |
| Folio & cash | `/folio/[id]`, cash shift | Events to orchestrator |
| Night audit | `/operations` | → GL via Finance |
| Revenue GL map | `/admin/integration` | Config for Finance journal |
| **Invoices (operational)** | `/reports/invoices` | **Read + link → Finance** |
| **Agency CL** | `/reports/agency-ledger` | **Read + link → Finance** |
| Contract pricing | `/admin/contract-pricing` | Affects folio totals |
| Channel / OTA | `/channel` | Stop-sell, sync errors |
| Housekeeping | `/housekeeping` | — |
| Medical / sanatorium | `/medical`, `/procedures` | Clinic bridge |
| Transfers | `/transfers` | Folio charge |
| Banquets BEO | `/banquets` | POS hall block |
| POS bridge | `/api/pms/*`, `/pos/calendar` | fb-pos room charge |
| **Stock MVP** | `/admin/stock` | **Local ops → link Finance** |
| RBAC / SSO | `/login`, `/admin/users` | Orchestrator SSO |
| Reports | occupancy, reconciliation | Operational only |

**Backlog:** [era-hotel-pms/doc/BACKLOG-PRODUCTION.md](../era-hotel-pms/doc/BACKLOG-PRODUCTION.md)

---

## era-fb-pos (F&B POS)

| Module | Screens / API | Notes |
|--------|---------------|-------|
| Floor & tables | `/floor` | Open ticket per table |
| Orders | `/orders` | Fire, pay, void, discount, split |
| KDS | `/kds` | Kitchen line status |
| Calendar | `/calendar` | Table reservations → open ticket |
| Menu admin | `/admin/menu` | PLU, categories |
| Shifts | Z-open / Z-close | NA guard via hotel |
| Room charge | Bridge to hotel-pms | Idempotent |
| Banquet | `outletCode: BANQUET`, `beoId` | HN-8 |
| Fiscal (stub) | Pay API mock KKM | Real NBC Wave 6+ |
| PMS lifecycle webhook | `/api/webhooks/pms/...` | Check-out notify |
| i18n | en / ru / az | next-intl |

**Backlog:** [era-fb-pos/doc/BACKLOG-PRODUCTION.md](../era-fb-pos/doc/BACKLOG-PRODUCTION.md)

---

## era-retail-pos

| Module | Notes |
|--------|-------|
| POS checkout | Shift, receipt, pay |
| Presets | grocery, apparel, electronics, pharmacy |
| Returns / void | R-11, R-12 |
| Events | `SATELLITE_RETAIL_SALE_COMPLETED`, shift closed |
| **Growth (planned)** | E-commerce storefront, tracking, delivery — via platform add-ons |

---

## era-logistics

| Module | Notes |
|--------|-------|
| Fleet & trips | Trip lifecycle |
| POD | Proof of delivery |
| Fuel reports | Per trip + rollup |
| Events | `SATELLITE_LOGISTICS_TRIP_COMPLETED` |

---

## era-construction

| Module | Notes |
|--------|-------|
| Projects / sites | Object-centric |
| Estimates (smeta) | |
| Form №2 acts | |
| Events | Construction milestones → Finance |

---

## era-crm-field

| Module | Notes |
|--------|-------|
| Leads & visits | Pre-sale only |
| WhatsApp field | Not Finance invoice delivery |
| Events | Lead conversion stubs |

---

## era-auto-sto

| Module | Notes |
|--------|-------|
| Work orders | Repair jobs |
| Parts consumption | → Finance inventory |
| Events | Visit / WO completed |
| **Growth (planned)** | Online appointment, vehicle lifecycle CRM (mileage/events) — + platform booking & notifications |

---

## era-clinic

| Module | Notes |
|--------|-------|
| Appointments & visits | K1 |
| Lab orders | K2 workflow |
| Sanatorium bridge | K5 — hotel stay episodes |
| Events | `SATELLITE_CLINIC_VISIT_COMPLETED`, lab |
| **Growth (planned)** | Online appointment, service storefront + discounts → booking — platform add-ons |

---

## era-wholesale

| Module | Notes |
|--------|-------|
| B2B orders | Assembly status |
| Credit limits | Finance AR |
| Events | Shipment → Finance |

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
