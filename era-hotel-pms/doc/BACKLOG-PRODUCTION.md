# Hotel PMS — production backlog

Source: [DELIVERY.md](./DELIVERY.md), [clone-spec/14-phase2-roadmap.md](./clone-spec/14-phase2-roadmap.md), Nafta manifest.  
Finance boundary: [../../docs/HOSPITALITY_FINANCE_BOUNDARY.md](../../docs/HOSPITALITY_FINANCE_BOUNDARY.md)

## Done (Nafta Waves 1–5)

- PMS core, folio, night audit, RBAC, HK, channel, medical, room plan
- ERP bridge, fiscal docs, agency ledger **operational**, invoice center **operational**
- GL revenue mapping → Finance NAS journal
- Contract pricing, banquets, transfers, sanatorium packages, procedures
- POS bridge for fb-pos, stock MVP (local)
- Finance deep links on invoices / agency CL / stock (when `NEXT_PUBLIC_FINANCE_WEB_URL` set)

## P0 — Nafta demo polish

| ID | Task | Notes |
|----|------|-------|
| H-P0-1 | Wire `SATELLITE_HOTEL_INVOICE_ISSUED` in Finance dispatch | Draft sales invoice from folio issue — **done** |
| H-P0-2 | City ledger snapshot event → Finance reconciliation | Complement agency CL deep link — **done** (dispatch meta) |
| H-P0-3 | On-site UAT checklist 13 with Nafta | Gate sign-off |
| H-P0-4 | Hospitality launcher tile group (orchestrator) | hotel + fb + finance shortcuts — **done** |

## P1 — Shipped in v1.1 / v2.0 (local MVP)

| ID | Task | Status |
|----|------|--------|
| H-P1-1 | PMS-04 Room plan drag-resize | **done** (v1.1) |
| H-P1-2 | HK mobile PWA `/hk/mobile` | **done** (v1.1) |
| H-P1-3 | B2C booking engine | **done** (v2.0 MVP — `/b2c`, public rates API) |
| H-P1-4 | Door locks integration | **done** (v2.0 — adapter + check-in unlock) |
| H-P1-5 | Auto email reports (WA0345+) | **done** (v1.1 cron) |
| H-P1-6 | NBC/Cybernet KKM adapter | **done** (v2.0 stub; prod certs below) |
| H-P1-7 | Full PO / fixed assets / DMENU | **out of scope** — Finance |

### NBC / fiscal production (pre-GA)

| Env | Purpose |
|-----|---------|
| `ERA_FISCAL_PROVIDER` | `mock` (default local) · `nbc` · `cybernet` |
| `ERA_NBC_KKM_CERT_PATH` | Production PKCS#12 path (backlog until cert issued) |
| `ERA_NBC_KKM_ENDPOINT` | Vendor API base URL |

Local UAT uses **mock**. Production cutover requires certified adapter (not blocking GA).

### OTA (pre-GA stub)

| Env | Purpose |
|-----|---------|
| `ERA_OTA_MODE` | `stub` (default) |
| `ERA_OTA_WEBHOOK_SECRET` | Optional HMAC header `x-era-ota-secret` |
| `POST /api/integrations/ota/:channel` | Webhook ingest MVP |

## P2 — Elektraweb parity

### Shipped Wave B (2026-06-01)

- Reservation Card pricing/charge-all, FO reports, HK/distribution/SPA MVP screens
- See [ELEKTRAWEB-PARITY.md](./ELEKTRAWEB-PARITY.md)

### Remaining (Wave C+)

- OTA live connectors (Booking.com, Expedia, Exely) — adapter shells exist; **not live** without vendor creds (HOT-CH-02 / H-BL-25)
- e-qaimə production adapter
- ~1243 screen manifest — optional merge from NotebookLM
- OpenAPI ERP hardening (already stubbed — mark DELIVERY stale `[ ]` as done)

## Finance boundary (do not duplicate in hotel)

| Domain | Action |
|--------|--------|
| Sales invoices | Keep operational list; accounting in Finance |
| Agency GL / aging / invoice matching | Keep city ledger **ops** snapshot + transfer handoff; aging/match in Finance (**H-BL-48**) |
| Payment terms master | Finance (or contract mirror); hotel enforces at checkout-to-CL |
| Purchases | Remove from hotel scope; link only |
| Warehouse | Local consumption MVP only; master stock in Finance |

## Doc hygiene

- [ ] Mark DELIVERY «OpenAPI ERP» and «Phase 2 modules» checkboxes — review vs current state
- [x] Wave 5 stages 22–24 documented in DELIVERY

---

## Product gaps — not covered by other satellites (2026-06-14)

Source: hospitality business-process review vs ecosystem readiness (hotel + fb + clinic + finance + orchestrator).

**Rule:** do not duplicate capabilities that already live on a sibling satellite — see § Covered elsewhere below.

### P2 — Nafta-relevant product gaps

| ID | Task | Primary owner | Status | Notes |
|----|------|---------------|--------|-------|
| H-BL-01 | **Split folio settlement** | hotel-pms | **Done** | `FolioSettlement`, `POST /api/folios/settle`, folio UI wizard; [KKM-POLICY-FOLIO-SETTLEMENT.md](./KKM-POLICY-FOLIO-SETTLEMENT.md) |
| H-BL-02 | **Card pre-auth / hold lifecycle** | orchestrator + hotel | **Done (mock)** | `CardAuthorization`, CP `POST authorizations` stub, check-in hold API; **UI:** reservation card Folio tab — list + place hold / release |
| H-BL-03 | **Credit limit on room charge** | hotel-pms | **Done** | `creditLimitAzn` + bridge enforce `CREDIT_LIMIT`; **UI:** reservation card Billing field — edit limit, remaining vs folio balance |
| H-BL-04 | **Meal entitlement + F&B gate** | hotel-pms + fb-pos | **Done** | `GET /api/pms/guest-entitlements`; fb-pos zero-post gate |
| H-BL-05 | **Strict operational business date** | hotel-pms | **Done** | `currentBusinessDate`, NA advance, posting guards |
| H-BL-06 | **Guest omnichannel** | hotel-pms + orchestrator | **Done (platform notify)** | `trySendPlatformNotification`; **Partial (vendor STUB)** — Twilio/SendGrid not wired |
| H-BL-07 | **Guest Intelligence pilot** | hotel-pms + MDM | **Done** | [NAFTA-GUEST-INTELLIGENCE.md](./NAFTA-GUEST-INTELLIGENCE.md), `/reports/guest-dedup` |
| H-BL-08 | **Dynamic pricing Stage 25 completion** | hotel-pms | **Done** | BAR API/UI, `quoteReservationStay`, NA/recalc wired |
| H-BL-09 | **Early / late check-in-out charges** | hotel-pms | **Done** | Policy JSON, preview API, post on check-in/out; **UI:** reservation card left panel — early/late fee preview on time change |
| H-BL-10 | **Prepayment / deposit full lifecycle** | hotel-pms | **Done** | HELD/APPLIED@check-in/settle/checkout/REFUNDED; see H-BL-41 |

### P5 — FO money close + City Ledger (2026-08-03)

Honest audit vs Opera-like CL. ADR: [docs/adr/hotel-city-ledger-and-fo-money.md](../../docs/adr/hotel-city-ledger-and-fo-money.md). Coverage: `HOT-CASH-*` / `HOT-CL-*` / `HOT-CO-*` / `HOT-NA-*` in [COVERAGE_MATRIX.md](../../docs/COVERAGE_MATRIX.md).

| ID | Task | Primary owner | Status | Notes |
|----|------|---------------|--------|-------|
| H-BL-40 | **Transfer to City Ledger at checkout** | hotel-pms | **Done** | PENDING_AR → TRANSFERRED_AR; contract + credit-limit gate; guest ledger cannot leave balance |
| H-BL-41 | **Deposit apply / offset at settle & checkout** | hotel-pms | **Done** | Extend H-BL-10; DEPOSIT settle lines; checkout auto-apply |
| H-BL-42 | **Folio payment refunds** | hotel-pms (+ fiscal) | **Done** | `refundFolioPayment`; mock fiscal; agency path via settlement |
| H-BL-43 | **Checkout discounts (manual + automatic)** | hotel-pms | **Done** | DISCOUNT charge at settle/checkout; promo/`discountPct` |
| H-BL-44 | **Night Audit polish** | hotel-pms | **Done** | Exceptions, auto no-show, trial preview on `/operations` |
| H-BL-45 | **Selective / per-guest folio close** | hotel-pms | **Done** | `POST /api/folios/[id]/close` + folio UI |
| H-BL-46 | **Agency prepaid/postpaid settlement + commission** | hotel-pms + Finance | **Done (ops)** | Hotel apply on TRANSFERRED_AR; commission accrual; bank match in Finance |
| H-BL-47 | **List filter enrichment (HOT UI standard)** | hotel-pms | **Done** | EraListFilterBar depth on FO lists + allotment/reservations |
| H-BL-48 | **Finance AR: terms, aging, invoice matching** | era-finance-core | **Done** | `paymentTermsDays`; aging; `/sales/invoices/allocate` |

### P6 — Nafta early leave (docs 2026-08-21)

| ID | Task | Primary owner | Status | Notes |
|----|------|---------------|--------|-------|
| H-BL-49 | **Unused-nights refund at checkout** | hotel-pms | **Done** | ADR [hotel-early-checkout-unused-nights.md](../../docs/adr/hotel-early-checkout-unused-nights.md); HOT-CO-04 SHIPPED; net of 18% VAT; default CASH; all folios |

**Already MVP (do not re-scope as greenfield):** transfers `HOT-XFER-01`, banquets `HOT-BEO-01`, settle `HOT-CASH-01`, agency CL snapshot `HOT-CL-03`, NA core `HOT-NA-01`.

### P7 — Guest group tours (docs 2026-08-23 — not coded)

| ID | Task | Primary owner | Status | Notes |
|----|------|---------------|--------|-------|
| H-BL-50 | **Nafta weekend tours** (`/tours`, roster, `TOUR` charge, desk/folio line-pay) | hotel-pms | **Done** | ADR [hotel-guest-tours.md](../../docs/adr/hotel-guest-tours.md); ops [TOURS-NAFTA-OPS.md](./TOURS-NAFTA-OPS.md); HOT-TOUR-01 SHIPPED. Not concierge. Not `/front-cash/pending`. |

### P3 — Future / optional parity

| ID | Task | Primary owner | Status | Notes |
|----|------|---------------|--------|-------|
| H-BL-20 | Excursions & concierge catalog | hotel-pms | **Done** | `ConciergeProduct/Order`, `/concierge`, folio charge on complete |
| H-BL-21 | Smart minibar (IoT) | hotel-pms + vendor | **Done (adapter)** | `MinibarEvent`, `POST /api/integrations/minibar-sensor` |
| H-BL-22 | Guest dispatch | hotel-pms | **Done** | `DispatchVehicle/Request`, `/dispatch` board |
| H-BL-23 | KBS / AZ tourism registry | compliance gateway | **Done (mock+live stub)** | `tourism-registry.service`, ADR, submit API |
| H-BL-24 | e-qaimə production adapter | Finance + hotel | **Stub** | `eqaime.service`, fiscal read-only fields, ADR — prod cert pending |
| H-BL-25 | OTA Booking.com / Expedia live | hotel-pms channel | **Partial (adapters STUB/dry-run)** | Adapter shells + webhook/ARI push exist; **live vendor sync not done** until credentials + certification. See HOT-CH-02. |
| H-BL-26 | Guest CRM P2/P3 buttons | hotel-pms | **Done** | [GUEST-CRM-ELECTRAWEB.md](./GUEST-CRM-ELECTRAWEB.md), extension pages |
| H-BL-27 | Loyalty redeem at checkout | orchestrator + hotel | **Done** | `GET /api/loyalty/balance`, settlement burn (P2) |
| H-BL-28 | Procedure compatibility rules | era-clinic | **Done** | `ProcedureCompatibilityRule`, clinic + hotel validate |

### P4 — B2B / distribution

| ID | Task | Primary owner | Notes |
|----|------|---------------|-------|
| H-BL-30 | **B2B contract management / agency sales** | hotel distribution | **Done** — `SalesContract`, `ContractAllotment`, `/admin/contracts`, reservation `salesContractId`, ADR |
| H-BL-31 | **Full MICE / Sales & Catering** | hotel-pms + era-fnb-pos | **Done (MVP)** — BEO lines/resources/staff/settlement/P&L (HOT-BEO-01); not full Opera S&C |

**Guest CRM boundary:** operational guest profile = **hotel-pms** (`hotel_guest_experience`). **`era-crm`** = field sales leads only — not for 7k guest DB ([ELEKTRAWEB-PARITY § Glossary](./ELEKTRAWEB-PARITY.md)).

### Covered elsewhere — do not re-implement in hotel

| Capability | Owner |
|------------|-------|
| Procurement RFQ, supplier scorecard, HR document vault | era-finance-core |
| EMR, queue board, LIS profiles, sanatorium clinical chart | era-clinic |
| Split restaurant bill, KDS, daily menu, recipe depletion | era-fnb-pos |
| GL, month-end, agency GL reconciliation, master stock | era-finance-core |
| Loyalty earn, booking widget, portal, payment links, notifications API | era-orchestrator platform add-ons |
| MDM person registry, merge, org register | era-orchestrator MDM |
| OTA Exely ingest/push, glPosted, door lock adapter, satellite audit | hotel-pms — **done** (Nafta W0–W3) |

Roadmap index: [DEVELOPMENT_ROADMAP.md § Hospitality product backlog](../../docs/DEVELOPMENT_ROADMAP.md#hospitality-product-backlog-post-nafta-w3).
