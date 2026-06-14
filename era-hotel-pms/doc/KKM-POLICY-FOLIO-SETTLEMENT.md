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

1. Applied deposits (H-BL-10) reduce balance before settlement.
2. CARD lines may capture pre-auth (H-BL-02) via `authorizationId`.
3. LOYALTY_POINTS burns orchestrator ledger (`POST platform/loyalty/v1/points/burn`).
4. Checkout blocked until folio balance ≤ 0 after settlement.

## API

- `POST /api/folios/settle` — `{ folioId, lines: [{ method, amount, … }] }`
- `GET /api/folios/settle?folioId=` — balance preview

See `src/lib/services/folio-settlement.service.ts`.
