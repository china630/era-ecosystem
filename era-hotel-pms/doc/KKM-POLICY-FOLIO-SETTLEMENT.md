# Folio settlement — KKM policy (Nafta default)

Nafta P2 split checkout supports multiple tender lines (`CASH`, `CARD`, `LOYALTY_POINTS`, `COMPANY_ACCOUNT`).

## Receipt mode

| Setting | Behavior |
|---------|----------|
| `PER_TENDER` (default) | One fiscal receipt per `CASH` / `CARD` line in `settleFolio` |
| `SINGLE` | One combined receipt (requires legal review before enable) |

Configure via `HotelProfile.integrationSettingsJson`:

```json
{
  "mixedTenderReceiptMode": "PER_TENDER"
}
```

## Flow

1. Applied deposits (H-BL-10/41) reduce balance before settlement — apply on check-in **and** settle/checkout (`DEPOSIT` method). See [ADR](../../docs/adr/hotel-city-ledger-and-fo-money.md).
2. CARD lines may capture pre-auth (H-BL-02) via `authorizationId`.
3. LOYALTY_POINTS burns orchestrator ledger (`POST platform/loyalty/v1/points/burn`).
4. Checkout blocked until **guest** folio balance ≤ 0 — COMPANY/AGENCY may leave-on-CL when gate passes (**H-BL-40**).
5. Payment refunds after settle = **H-BL-42** (mock fiscal; not void charge).

## API

- `POST /api/folios/settle` — `{ folioId, lines: [{ method, amount, … }] }`
- `GET /api/folios/settle?folioId=` — balance preview

See `src/lib/services/folio-settlement.service.ts`.
