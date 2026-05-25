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
- [x] FB-03 Cash/card + KKM mock — `POST /api/tickets/{id}/pay` (stub fiscal receipt)
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

- [ ] FB-08 Split bill
- [ ] FB-09 Calendar → ticket
- [ ] FB-10 E8 consumption → ERP
- [ ] Real KKM NBC/Cybernet
- [ ] i18n en/ru/az

## FB-3 — Backlog

- [ ] Multi-outlet
- [ ] Standalone walk-in profile
- [ ] Room service
- [ ] Offline queue

## Verify

```bash
cd era-fb-pos && npm run build
docker compose up -d fb-pos hotel-pms
node era-hotel-pms/scripts/test-pos-bridge.mjs
# fb-pos bridge (stub): FB_POS_PMS_STUB=1 npm run dev — then POST /api/tickets/{id}/room-charge
```
