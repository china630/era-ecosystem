# DELIVERY-FB

PRD: [../PRD.md](../PRD.md) · User stories: [07-phases-delivery-user-stories.md](./07-phases-delivery-user-stories.md)

PMS bridge (ready): [era-hotel-pms/doc/DELIVERY.md](../../era-hotel-pms/doc/DELIVERY.md) Stage 17.

## FB-0 — Каркас

- [x] App in monorepo `era-fb-pos` (port 3200, Docker)
- [x] UI shell: floor, orders, kds, calendar pages
- [x] Prisma: Ticket model + related domain schema
- [x] `POST /api/tickets` + room charge stub API
- [x] doc/DOCUMENTATION-INDEX.md + UAT-SMOKE.md
- [ ] Auth FB_WAITER / FB_MANAGER
- [ ] Menu CRUD admin
- [ ] PMS bridge client wired + integration test

## FB-1 — MVP Nafta (G-FB-1…7)

- [ ] FB-01 Floor + open ticket
- [ ] FB-02 KDS fire/done
- [ ] FB-03 Cash/card + KKM mock
- [ ] FB-04 Room charge → PMS
- [ ] FB-05 Void line
- [ ] FB-06 Z-close shift
- [ ] FB-07 PMS NA block on open shift

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
# node era-hotel-pms/scripts/test-pos-bridge.mjs  # when added
```
