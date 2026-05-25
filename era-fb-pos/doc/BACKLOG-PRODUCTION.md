# F&B POS — production backlog

Source: [DELIVERY-FB.md](./DELIVERY-FB.md), [PRD.md](../PRD.md), [07-phases-delivery-user-stories.md](./07-phases-delivery-user-stories.md).

## Done (FB-0, FB-1, FB-4)

- Floor, orders, KDS, calendar shell
- Ticket lifecycle, fire, pay (stub fiscal), void, room charge, shifts
- Menu admin, auth FB_WAITER / FB_MANAGER
- Banquet `beoId`, outlet `BANQUET`
- PMS bridge (in-house, room charge, shift NA guard)

## P0 — Nafta demo (this sprint)

| ID | Task | Status |
|----|------|--------|
| F-P0-1 | Ticket discount API + UI (manager) | Done |
| F-P0-2 | Split bill API + UI | Done |
| F-P0-3 | Calendar reservation → open ticket | Done |
| F-P0-4 | i18n en/ru/az (next-intl) | Done |
| F-P0-5 | Industry vertical tile in Finance | Done (parent repo) |

## P1 — FB-2 maturity

| ID | Task | DELIVERY ref |
|----|------|--------------|
| F-P1-1 | E8 consumption → Finance ERP event | FB-10 |
| F-P1-2 | Real KKM NBC/Cybernet | FB-2 |
| F-P1-3 | Card pay UI parity with cash | FB-03 |
| F-P1-4 | PRD status sync — mark MVP Done where DELIVERY FB-1 is done | Doc drift |

## P2 — FB-3 backlog

- Multi-outlet
- Standalone walk-in (no hotel)
- Room service mode
- Offline queue

## Finance / hotel boundary

- Room charge and folio: **hotel-pms** bridge only
- Recipe consumption and inventory valuation: **Finance** (E8 event)
- Fiscal guest receipt: fb-pos operational; GL impact via hotel night audit / Finance

## Verify

```bash
cd era-fb-pos && npm run build
docker compose up -d fb-pos hotel-pms
node era-hotel-pms/scripts/test-pos-bridge.mjs
```
