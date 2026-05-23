# F&B POS documentation moved

Canonical **era-fb-pos** specification lives in the sibling submodule:

**[`../../era-fb-pos/doc/README.md`](../../era-fb-pos/doc/README.md)**

## What stays in era-hotel-pms

- PMS **bridge server**: `POST /api/pos/room-charge`, `GET /api/pms/in-house`, folio summary, pos-shift-status
- Night audit guard on open fb-pos shifts
- Quick posting on folio (WA0135)
- OpenAPI server copy: [`openapi/fb-pos-pms-bridge.yaml`](./openapi/fb-pos-pms-bridge.yaml)

## What moved to era-fb-pos

- `doc/fb-pos/*` product spec
- Floor / KDS / waiter UI (`http://localhost:3200` in dev)
- POS domain database (outlets, tables, tickets, menu)
