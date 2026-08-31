# EW ↔ ERA reservation notes field map

**Status:** Accepted (import/bridge alignment)  
**Date:** 2026-08-30  
**Context:** Nafta «Front office with notes» Excel exports nine free-text note columns. ERA already stored them as `ReservationNote.noteType` codes, but the FO-with-Notes **wide** import and live bridge only persisted a subset — package migration and dual-run need the full set.

## Map

| Elektraweb column | ERA `noteType` | Used for medical SKU? |
|-------------------|----------------|------------------------|
| Extra Req | `EXTRA_REQ` | Yes — `ERA-PKG` / phrases (primary) |
| Res Note | `RES_NOTE` | Yes — phrases |
| Price Note | `PRICE_NOTE` | Hint only in live resolve; **migration** may infer catalog sell |
| CIn Note | `CIN_NOTE` | Yes — phrases |
| `#COut Note#` | `COUT_NOTE` | No (ops) |
| Room Note | `ROOM_NOTE` | No (ops; channel room-detail noise ignored for SKU) |
| Cancel Note | `CANCEL_NOTE` | No |
| Payment Note | `PAYMENT_NOTE` | No |
| Invoice Note | `INVOICE_NOTE` | No |

## Decision

1. Do **not** invent new note-type codes for EW — reuse existing `RESERVATION_NOTE_TYPES`.
2. Wide import (`reservation-notes` adapter) and live-bridge upsert must write **all nine** columns when present.
3. Price→SKU inference stays in **migration tooling** (`reports/nafta-ew-notes-2026/`), not in live `resolveMedicalSku` (discount/BAR bleed).

## Related

- Extract: `reports/nafta-ew-notes-2026/README.md`
- Dual-run SKU: `docs/adr/nafta-medical-sku-dual-run.md`
- Import matrix: `era-hotel-pms/doc/ELEKTRAWEB-IMPORT.md`
