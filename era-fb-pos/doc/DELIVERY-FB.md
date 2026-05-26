# DELIVERY-FB

PRD: [../PRD.md](../PRD.md) · User stories: [07-phases-delivery-user-stories.md](./07-phases-delivery-user-stories.md)

PMS bridge (ready): [era-hotel-pms/doc/DELIVERY.md](../../era-hotel-pms/doc/DELIVERY.md) Stage 17.

## FB-0 — Каркас

- [x] App in monorepo `era-fb-pos` (port 3200, Docker)
- [x] UI shell: floor, orders, kds, calendar pages
- [x] Prisma: Ticket model + related domain schema
- [x] `POST /api/tickets` + room charge bridge API
- [x] doc/DOCUMENTATION-INDEX.md + UAT-SMOKE.md
- [x] Auth FB_WAITER / FB_MANAGER — login + RBAC on pay/fire/void/shift/menu
- [x] Menu CRUD admin — `GET/POST /api/menu`, `/admin/menu`
- [x] PMS bridge client wired (`HOTEL_PMS_URL` / stub) + `GET /api/health`

## FB-1 — MVP Nafta (G-FB-1…7)

- [x] FB-01 Floor + open ticket — `/floor` wired to `POST /api/tickets`
- [x] FB-02 KDS fire/done — `/orders` fire + `/kds` mark done via API
- [x] FB-03 Cash/card + KKM — `POST /api/tickets/{id}/pay` + `src/lib/kkm/` (`KKM_DRIVER=mock`)
- [x] FB-04 Room charge → PMS — `POST /api/tickets/{id}/room-charge`, `GET /api/in-house`
- [x] FB-05 Void line — `POST /api/tickets/{id}/lines/{lineId}/void`
- [x] FB-06 Z-close shift — `POST /api/shifts/open|close` + PMS `pos-shift-status`
- [x] FB-07 PMS NA block on open shift — shift open pushes `OPEN` to hotel-pms bridge

## FB-4 — Banquet service day (HN-8)

- [x] Outlet `BANQUET` in seed + menu extra PLU
- [x] `beoId` optional on `Ticket`; filter `GET /api/tickets?beoId=`
- [x] Create banquet ticket: `POST /api/tickets` with `outletCode: "BANQUET"` and hotel BEO id
- [x] Room charge bridge for extras — same `POST /api/tickets/{id}/room-charge` as FB-04

## FB-2 — Зрелость

- [x] FB-08 Split bill — `POST /api/tickets/{id}/split` + UI checkboxes on `/orders`
- [x] FB-09 Calendar → ticket — `POST /api/reservations/{id}/open-ticket` on `/calendar`
- [x] FB-10 E8 consumption → ERP — `STOCK_CONSUMPTION_ENABLED=true` + `SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED`
- [x] KKM adapter + mock — `src/lib/kkm/`; vendor NBC/Cybernet = separate driver when hardware available
- [x] i18n en/ru/az — `next-intl` + `messages/{en,ru,az}.json`
- [x] FB-08 Manager discount — `POST /api/tickets/{id}/discount` + UI on `/orders`

## FB-3 — Product depth (quartet Track C)

- [x] Multi-outlet — `GET /api/outlets`, `POST /api/outlets/select`, cookie `era_fb_outlet_id`, ticket filter
- [x] Standalone walk-in — `serviceChannel: WALK_IN`, `walkInLabel` on `POST /api/tickets`
- [x] Room service — `POST /api/tickets/room-service`, `serviceChannel: ROOM_SERVICE`
- [x] Offline queue — `src/lib/offline-queue.ts` + `POST /api/offline/replay`

## Verify

```bash
cd era-fb-pos && npm run build
docker compose up -d fb-pos hotel-pms
node era-hotel-pms/scripts/test-pos-bridge.mjs
node scripts/quartet-smoke.mjs
```

## FB-5 — Platform (Wave B/C)

- [x] Notifications on ticket pay — `@era/satellite-kit`
- [x] Entitlement-gated hooks — `runPlatformCommerceHooks` on pay (portal/pay/delivery/loyalty/domain/booking)
- [x] Billing snapshot UI — `GET /api/admin/integration-settings` + `/admin/integration`
- [x] Wave E-B booking — booking slot gated by `platform_booking` module

## FB-6 — Quartet smoke (Track A)

- [x] Health in `scripts/quartet-smoke.mjs`
- [x] UAT steps in [UAT-SMOKE.md](./UAT-SMOKE.md) § Quartet

## W2-E — Enrichment (Gemini ресторанный ERP)

- [x] M11: KDS course timing / fire delay
- [x] M12: Recipe depletion on ticket close (link Finance manufacturing)
- [x] M13: Delivery aggregator order inbox
- [ ] M14: Labor roster PIN — deferred

## SP8 — Platform RBAC consumer (§2.1)

- [x] Hybrid: local `FB_WAITER` / `FB_MANAGER`; platform OWNER/ACCOUNTANT via SSO (`financeRole`)
- [x] `/admin/integration` — platform SSO only (`PLATFORM_SESSION_REQUIRED` without `financeRole`)
- [x] `PlatformSessionBarServer` — Finance team/billing deep links
- [x] No local Orch RBAC API (N/A matrix)
