# era-fb-pos — Delivery tracker

> Код ещё не начат. Спека: [README.md](README.md).  
> Зависимости PMS: [DELIVERY.md](../DELIVERY.md) Stage 17.  
> Umbrella monorepo: [MONOREPO.md](../MONOREPO.md).

## Gate FB-0

- [ ] Repo / app в monorepo `apps/fb-pos` (см. MONOREPO)
- [ ] Docker profile `fb-pos`
- [ ] Prisma schema: Outlet, Table, Ticket, PosShift
- [ ] Seed: 1 outlet, 10 tables, demo menu
- [ ] HTTP client → PMS `POST /api/pos/room-charge`

## FB-0 — Каркас (1 спринт)

- [ ] Auth + roles FB_WAITER, FB_MANAGER
- [ ] Admin: outlet, tables, menu CRUD
- [ ] Integration settings: `PMS_BRIDGE_URL`, `POS_BRIDGE_SECRET`
- [ ] `DELIVERY-FB.md` в CI readme

## FB-1 — MVP зала Nafta (2–3 спринта)

См. [07-phases-delivery-user-stories.md](07-phases-delivery-user-stories.md).

| Блок | US | Статус |
|------|-----|--------|
| Floor map + open ticket | FB-01 | [ ] |
| KDS fire/done | FB-02 | [ ] |
| Cash/card + KKM mock | FB-03 | [ ] wireflow [10](10-wireflow-cash-fiscal.md) |
| Room charge → PMS | FB-04 | [ ] wireflow [09](09-wireflow-ticket-to-folio.md) |
| Void line | FB-05 | [ ] |
| Z-close shift | FB-06 | [ ] |
| PMS NA block on open shift | FB-07 | [ ] needs PMS Stage 17 |

**G-FB-1…7** — все [ ] до UAT ресторана.

## FB-2 — Зрелость

- [ ] Split bill (FB-08)
- [ ] Calendar full (FB-09)
- [ ] E8 consumption → ERP (FB-10)
- [ ] Real KKM NBC/Cybernet
- [ ] i18n en/ru/az

## FB-3 — Backlog

- [ ] Multi-outlet
- [ ] Standalone (no PMS)
- [ ] Room service
- [ ] Offline queue

## Verify (после появления кода)

```bash
# из корня monorepo
docker compose --profile fb-pos up -d
npm run build -w @era/fb-pos
npm run test:integration:room-charge -w @era/fb-pos
```
