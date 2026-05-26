# ERA Hotel PMS — Delivery tracker

MVP go-live criteria from [clone-spec/12-user-stories-index.md](clone-spec/12-user-stories-index.md) (must stories).

## Gate before UAT

- [x] Fill [13-nafta-validation-checklist.md](clone-spec/13-nafta-validation-checklist.md) — draft 2026-05 (confirm with Nafta on site)
- [x] **Frozen scope:** all must stories except full B2C and POS (restaurant = satellite phase 2)

## UI i18n (en / ru / az)

- [x] `next-intl` + `messages/{en,ru,az}.json` — see [i18n.md](i18n.md)
- [x] Language switcher (cookie `NEXT_LOCALE`, `DEFAULT_LOCALE` in `.env`)
- [x] All app pages translated (nav, login, chessboard, folio, operations, bookings, HK, channel, medical, room plan, reports, admin, POS)

## Stage 0 — Infrastructure

- [x] `docker-compose.yml` — PostgreSQL + Redis + app (dev / prod profiles)
- [x] `Dockerfile` multi-stage + `scripts/docker-entrypoint.sh`
- [x] `REDIS_URL` in `.env.example`
- [x] `src/lib/redis.ts`

## Stage 1 — Master data (MD-01 … MD-04)

- [x] Prisma: HotelProfile, RoomType, RatePlan, MealPlan, RevenueCode, Department
- [x] API: `/api/hotel/profile`, `/api/master/*`
- [x] UI stub: `/admin/master-data`

## Stage 2 — PMS core (PMS-01, 02, 03, 07)

- [x] Reservation + Stay, assign, arrivals, cancel/no-show
- [x] Check-in opens folio + room charge
- [x] Chessboard: arrivals, assign, status colors

## Stage 3 — Folio & cash (FIN-01 … FIN-03, FIN-05)

- [x] Folio, charges, payments, routing rules
- [x] Check-out balance guard
- [x] Cash shift API

## Stage 4 — Night audit (NA-01, NA-02)

- [x] BusinessDay, NightAuditRun
- [x] `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED` event
- [x] `/operations` UI + API

## Stage 5 — Satellite bridge (doc 19)

- [x] Checkout event from FolioCharge (revenue code SKUs)
- [x] Redis retry queue + `/api/integration/retry`

## Stage 6 — HK, channel, medical

- [x] Housekeeping tasks + OOO
- [x] Channel sync errors + OTA cancel stub
- [x] Medical alerts, orders, lab, procedure → folio

## Deferred (post-MVP)

- [ ] PMS-04 Room Plan drag-resize (pointer DnD — buttons +1/+2 done)
- [ ] OpenAPI ERP ([18-erp-integration.md](clone-spec/18-erp-integration.md))
- [ ] Phase 2 modules ([14-phase2-roadmap.md](clone-spec/14-phase2-roadmap.md))

## Stage 7 — RBAC, seat licensing, SSO (sprint)

- [x] Prisma `User`, `Role`, `HotelProfile.organizationId`
- [x] `src/lib/auth/*` — scrypt, JWT (jose), permissions matrix
- [x] `POST /api/auth/login`, `logout`, `GET /api/auth/me`
- [x] `middleware.ts` — 401 on `/api/*` (public: login, sso/exchange, mock integration)
- [x] `POST /api/admin/users` + seat check ([20-seat-licensing.md](clone-spec/20-seat-licensing.md))
- [x] Mock `POST /api/integration/mock-licensing`
- [x] `POST /api/auth/sso/exchange` — Financial_Auditor (cross-system, no seat quota)
- [x] UI: `/login`, `/bookings/new`, `/folio/[reservationId]`, `/admin/users`
- [x] Chessboard: AppNav, permission-gated actions, folio link

**Demo logins (after seed):** `admin` / `admin123` (Hotel_Admin), `reception` / `reception123` (Receptionist).

**Env:** `AUTH_JWT_SECRET` (min 16 chars), `LICENSING_SEAT_LIMIT` (default 10 in `.env.example`), `ERA_SSO_SHARED_SECRET` for SSO stub.

**Docs:** [21-satellite-rbac.md](clone-spec/21-satellite-rbac.md), [20-seat-licensing.md](clone-spec/20-seat-licensing.md).

## Stage 9 — Room Plan + Occupancy (PMS-04, PMS-06)

- [x] `GET /api/reports/occupancy` + `/reports/occupancy` (30/14 days, REPORTS_READ)
- [x] `GET /api/room-plan` + `/room-plan` Gantt grid
- [x] `PATCH /api/reservations/[id]/schedule` — extend dates, room conflict + OOO checks
- [x] UI: +1 / +2 nights on selected bar; seed `manager` / `manager123`

## Stage 8 — Operations UI backlog (sprint)

- [x] `/housekeeping` — tasks, complete, OOO, mark INSPECTED
- [x] No-show list on `/operations` + cancel/no-show
- [x] `/channel` — sync error journal
- [x] `/medical` — alerts, orders, lab, procedure → folio
- [x] `POST /api/folios/charges/:id/void` + Manager button on folio page
- [x] `assertPermission` on remaining API route groups

## Что дальше (разработка после каркаса)

| Приоритет | Задача | Stories | Статус |
|-----------|--------|---------|--------|
| 1 | Форма **новой брони** | PMS-01 | [x] `/bookings/new` |
| 2 | **Folio UI** + void (Manager) | FIN-01, FIN-03 | [x] `/folio/[id]` |
| 3 | **Assign HK-03** hint in UI | HK-03 | [x] API + chessboard note |
| 4 | **Housekeeping** page | HK-01, HK-04 | [x] `/housekeeping` |
| 5 | **No-show** перед night audit | PMS-07 | [x] `/operations` |
| 6 | **Channel** journal | CH-01, CH-02 | [x] `/channel` |
| 7 | **Medical** UI | MED-01…04 | [x] `/medical` |
| 8 | **Room Plan** | PMS-04 | [x] `/room-plan` (+1/+2 nights) |
| 9 | Отчёты occupancy 30 дней | PMS-06 | [x] `/reports/occupancy` |
| 10 | Встреча Nafta → чеклист 13 | gate UAT | on-site confirm |
| 11 | Integration + closure polish | Stage 10–11 | [x] |

**Миграции:** `20260522120000_phase1_full`, `20260523100000_auth_rbac`, `20260524100000_phase1_closure`, `20260525100000_phase2_erp_fiscal`, `20260526100000_phase2_queue`, `20260527100000_stage17_pos_bridge`. При конфликте: `docker compose down -v` → `npx prisma migrate deploy` → `npm run db:seed`.

## Stage 10 — Outbound real-time

- [x] События: `FOLIO_CHARGE_POSTED`, `FOLIO_PAYMENT_RECEIVED`, `FOLIO_CHARGE_VOIDED` ([22-outbound-integration-policy.md](clone-spec/22-outbound-integration-policy.md))
- [x] `integrationSettingsJson` на HotelProfile + env fallback
- [x] Admin UI: `/admin/integration` + outbound journal

## Stage 11 — Phase 1 closure polish

- [x] Cash shift UI on `/operations` (FIN-05)
- [x] Night audit wizard steps + run history (NA-01)
- [x] Channel stop-sell CH-01 on `/channel`
- [x] Master data forms MD-01–04 on `/admin/master-data`
- [x] Quick guest create on `/bookings/new`
- [x] UAT smoke: [UAT-SMOKE.md](UAT-SMOKE.md)

## Phase 2 — очередь (Stages 12–15)

Roadmap: [clone-spec/14-phase2-roadmap.md](clone-spec/14-phase2-roadmap.md) · POS bridge: [23-pos-bridge.md](clone-spec/23-pos-bridge.md)

### Stage 12 — P2-A ERP

- [x] `FiscalDocument` + fiscal status read-only на folio (ERP-02, G2-2)
- [x] E6 inbound: `POST /api/integration/erp/inbound` (webhook + `ERP_INBOUND_WEBHOOK_SECRET`)
- [x] Admin simulate E6: `POST /api/integration/erp/simulate`
- [x] E1 payload: `revenueLines` + `paymentLines` + `nightAuditId`
- [x] Fiscal docs при check-out (COMPANY / guest VÖEN)
- [x] E2 `SATELLITE_HOTEL_INVOICE_ISSUED` + `POST /api/folios/[folioId]/issue-invoice` + folio UI
- [x] E4 agency city ledger: `GET /api/agencies/[id]/ledger` + `/reports/agency-ledger`
- [x] E5 `SATELLITE_HOTEL_MASTER_DATA_SYNC` — manual push + debounced on revenue-code POST
- [x] Reconciliation: `GET /api/reports/reconciliation` + `/reports/reconciliation`
- [x] OpenAPI: [erp-inbound-e6.yaml](openapi/erp-inbound-e6.yaml), [erp-outbound-catalog.yaml](openapi/erp-outbound-catalog.yaml)

### Stage 13 — P2-B AZ compliance

- [x] Tourism registry: `TourismSubmission`, mock adapter, check-in/out hooks, `/operations` retry
- [x] KKM mock: `FiscalProvider`, E7 `PAYMENT_FISCALIZED`, receipt on folio payments
- [ ] Реальный NBC/Cybernet KKM — отложено

### Stage 14 — P2-C POS bridge (в PMS)

- [x] `POST /api/pos/room-charge` (`POS_BRIDGE_SECRET` / `FOLIO_CHARGE`)
- [x] `PosResource` / `PosReservation` API + `/pos/calendar`
- [x] `PosShift` NA guard — Stage 17 (`PosBridgeShift`)

### Stage 15 — P2-D Stock MVP

- [x] `Warehouse`, `Product`, `StockMovement`, `Recipe` / `RecipeLine`
- [x] `/admin/stock` + APIs under `/api/stock/*`
- [x] Optional consumption on room-charge (`STOCK_CONSUMPTION_ENABLED` + `productSku`)
- [ ] Full PO / fixed assets / DMENU — out of scope

### Stage 17 — PMS bridge for fb-pos (FB-1 prep)

OpenAPI: [fb-pos-pms-bridge.yaml](openapi/fb-pos-pms-bridge.yaml) v0.3 · Wireflows: [09](../../era-fb-pos/doc/09-wireflow-ticket-to-folio.md), [10](../../era-fb-pos/doc/10-wireflow-cash-fiscal.md)

- [x] `GET /api/pms/in-house` — поиск гостя (`query`, `roomNumber`, `limit`)
- [x] `GET /api/pms/reservations/{id}/folio-summary` — `allowRoomCharge`, `denyReason`
- [x] `POST /api/pos/room-charge` — **Idempotency-Key** / `externalTicketId` (+ `GET /api/pms/room-charges`)
- [x] `GET /api/pms/pos-shift-status` — open POS shifts для night audit UI
- [x] `PUT /api/pms/pos-shift-status` — fb-pos push open/close Z
- [x] `PosShift` NA guard — блок night audit при open `PosBridgeShift`
- [x] PMS → fb-pos webhook on check-out (`FB_POS_WEBHOOK_URL`, fire-and-forget)
- [x] Middleware: `POS_BRIDGE_SECRET` на `/api/pms/*` и room-charge без JWT
- [x] Prisma: `PosBridgeShift`, `PosRoomChargeIdempotency` — migration `20260527100000_stage17_pos_bridge`
- [x] E2E script — `node scripts/test-pos-bridge.mjs` (PMS bridge smoke)
- [x] **SP3 regression:** `era-fb-pos` FB-1 calls `POST /api/pos/room-charge` via `HOTEL_PMS_URL`; re-run script + [UAT-SMOKE §11](UAT-SMOKE.md) after fb-pos changes

### Stage 16+ — P2-E backlog (без сроков)

- [x] **era-fb-pos** — сателлит: [../../era-fb-pos/doc/README.md](../../era-fb-pos/doc/README.md); shell FB-0 на :3200
- [ ] HK mobile PWA `/hk/mobile`
- [ ] B2C booking engine
- [ ] Door locks integration
- [x] `era-fb-pos` full (floor, KDS, POS Z-shift) — [DELIVERY-FB.md](../../era-fb-pos/doc/DELIVERY-FB.md) Wave 2 UI + auth
- [ ] PMS-04 drag-resize room plan
- [ ] Auto email reports (WA0345+)

### Stage 18 — SAN-PKG (Wave 3 Nafta)

- [x] `RatePlanPackageLine` — package routing to revenue codes (ROOM / TREATMENT / BOARD)
- [x] `medicalFlag` rate plans: check-in defers charges; night audit EOD posts package bundle
- [x] Revenue codes `PKG`, `TREATMENT`, `BOARD`; seed MEDICAL package @ 180 AZN/night
- [x] Folio routing rules unchanged (single guest folio default per Q1)
- [x] Traceability: [doc/nafta/README.md](doc/nafta/README.md)
- [x] UAT: [UAT-SMOKE.md](UAT-SMOKE.md) § SAN-PKG

### Stage 19 — PROC-SCHED (Wave 3 Nafta)

- [x] `ProcedureService`, `ProcedureAppointment`, `RatePlanProcedureInclusion`
- [x] `/procedures` UI + `/api/procedures/*` — book, finish, no-show
- [x] Conflict check: staff + place overlap
- [x] Finish: included in package → audit only; extra → MEDICAL folio charge
- [x] UAT: [UAT-SMOKE.md](UAT-SMOKE.md) § PROC-SCHED

**Migration:** `20260528100000_wave3_sanatorium`

### Stage 21 — BANQUET BEO (Wave 4 Nafta HN-8)

- [x] `BanquetSaloon`, `BanquetMenuPackage`, `BanquetEvent` + `BanquetEventStatus`
- [x] Hall block via `PosResource` (`BANQUET_HALL`) + `PosReservation` on confirm
- [x] `/banquets` UI + `/api/banquets/*` — create draft BEO, confirm, deposit payment on folio
- [x] Seed: saloon **NAFTANI-HALL**, menu package, sample BEO
- [x] fb-pos: `beoId` on ticket, outlet `BANQUET` — [DELIVERY-FB.md](../../era-fb-pos/doc/DELIVERY-FB.md) banquet section
- [x] UAT: [UAT-SMOKE.md](UAT-SMOKE.md) § BANQUET

**Migration:** `20260528140000_wave4_banquet`

### Stage 20 — TRANSFER (Wave 4 Nafta HN-7)

- [x] `TransferVehicle`, `TransferOrder` — IN/OUT directions, fleet assignment
- [x] `/transfers` UI + `/api/transfers/*` — book, assign vehicle, complete
- [x] Complete: posts `TRANSFER` revenue on folio when not yet charged
- [x] Seed: 2 vehicles, sample IN transfer for in-house guest Ali Mammadov
- [x] UAT: [UAT-SMOKE.md](UAT-SMOKE.md) § TRANSFER

**Migration:** `20260528130000_wave4_transfer`

### Stage 22 — GL-BRIDGE (Wave 5 Nafta NW-1)

- [x] `HotelRevenueGlMapping` — revenue code → NAS GL account (601–606 seed)
- [x] Night audit E1 enriches `revenueLines` with `glAccountCode`; orchestrator `@era/contracts` `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED`
- [x] Finance `SatelliteEventDispatchService.handleHotelNightAudit` — multi-line NAS journal
- [x] Admin `/admin/integration` — GL mapping table + `PUT /api/master/revenue-gl-mappings`
- [x] UAT: [UAT-SMOKE.md](UAT-SMOKE.md) § GL-BRIDGE

**Migration:** `20260528150000_wave5_gl_bridge`

### Stage 23 — INVOICE-AGENCY (Wave 5 Nafta NW-2)

- [x] `/reports/invoices` — all fiscal documents + `integrateToAccounting` toggle (PROC-35)
- [x] `GET /api/reports/invoices`, `PATCH /api/reports/invoices/[id]`
- [x] Agency CL summary: city ledger, cash paid, net amount (PROC-21 / WA_CASH_02)
- [x] `GET /api/reports/agency-cl-summary` + enhanced `/reports/agency-ledger`
- [x] UAT: [UAT-SMOKE.md](UAT-SMOKE.md) § INVOICE-AGENCY

**Migration:** `20260528160000_wave5_invoice_agency`

### Stage 24 — CONTRACT-PRICING (Wave 5 Nafta NW-3)

- [x] `ContractPricingRule` — DISCOUNT/SUPPLEMENT % by agency + rate plan + date range (PROC-24)
- [x] `/admin/contract-pricing` CRUD + `/api/admin/contract-pricing`
- [x] Booking quote `/api/bookings/quote` + contract-adjusted `totalAmount` on create
- [x] Seed: TRAVEL-AZ −10% on STANDARD rate
- [x] UAT: [UAT-SMOKE.md](UAT-SMOKE.md) § CONTRACT-PRICING

**Migration:** `20260528170000_wave5_contract_pricing`


## Platform (Wave B3)

- [x] Invoice issued guest notification — `trySendPlatformNotification` on `issueFolioInvoice`
- [x] Spa/booking widget resource (CP-B3 hotel spa) — `POST /api/spa/slots` → `createBookingSlot` (MVP)
- [x] Payment link on folio invoice — `createPaymentLink` in `issueFolioInvoice` (Wave D)
- [x] Billing snapshot consumer — `GET /api/platform/billing-snapshot` (Wave D)
- [x] Wave E-A commerce — portal link on folio invoice (`issueFolioInvoice`)
- [x] Wave E-C billing UI — `platformSubscription` on `GET /api/hotel/integration-settings` + admin read-only block (§2.2.1 Live)
- [x] Quartet Track A — POS bridge CI + [KKM-POLICY-FB-BRIDGE.md](./KKM-POLICY-FB-BRIDGE.md)
- [x] Entitlement-gated platform hooks on folio invoice — `@era/satellite-kit` `runPlatformCommerceHooks`

## SP8 — Platform RBAC consumer (§2.1)

- [x] Hybrid local ops + SSO platform roles (`isCrossSystem` on SSO user)
- [x] `PlatformSessionBarServer` in layout — Finance deep links
- [x] No local join-org / memberships (N/A)
- [x] Wave F §4 — delivery/loyalty on folio invoice; `createCustomDomain` on integration-settings PATCH

Client: `@era/satellite-kit`.

## W2-E — Enrichment (Gemini отельный ERP)

PRD M20–M23 · [MODULES_CATALOG](../../docs/MODULES_CATALOG.md)

- [x] M20: Yield management rules (BAR by occupancy stub)
- [x] M21: Guest loyalty tier hook → `platform_loyalty`
- [x] M22: Room service QR menu → fb-pos ticket
- [x] M23: Maintenance work order from HK
