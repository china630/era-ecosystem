# KKM policy — Hotel PMS ↔ FB-POS bridge

## Room charge (folio posting)

- **FB table pay (cash/card):** fiscal receipt via `KKM_DRIVER` (default `mock`) on `POST /api/tickets/{id}/pay`.
- **Room charge:** `POST /api/tickets/{id}/room-charge` posts to PMS folio **without** table-side KKM. Guest fiscalization happens at hotel checkout / invoice (E2/E7), not at POS.

## Regression

```bash
node era-hotel-pms/scripts/test-pos-bridge.mjs
```

Assert room-charge response has no `fiscal.receiptId` from FB KKM driver.
