# OpenAPI — контракты ERA

| Файл | Версия | Сторона | Статус |
|------|--------|---------|--------|
| [fb-pos-pms-bridge.yaml](fb-pos-pms-bridge.yaml) | 0.2.0 | fb-pos ↔ hotel-pms | partial impl in PMS |
| [erp-inbound-e6.yaml](erp-inbound-e6.yaml) | 0.1.0 | ERP → PMS | impl |
| [erp-outbound-catalog.yaml](erp-outbound-catalog.yaml) | draft | PMS/fb-pos → ERP | catalog |

**Umbrella target:** `packages/contracts/openapi/` — см. [MONOREPO.md](../MONOREPO.md).

Stay amendment / pricing (not in YAML yet; Next.js routes):

- `POST /api/reservations/{id}/amendments` and `…/amendments/preview` — product change from date
- `POST /api/reservations/{id}/pricing/spread` — stay-total / nightly / stay-% spread
- `POST /api/reservations/{id}/relocate` — door move (comp upgrade when types differ)
- `GET /api/reservations/{id}/room-changes` — occupancy log

Просмотр: Swagger Editor, Redoc, или `npx @redocly/cli preview-docs doc/openapi/fb-pos-pms-bridge.yaml`.
