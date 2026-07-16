# Bridge HAR workspace (local only)

Drop Elektraweb DevTools HAR files here for analysis. **Do not commit** raw HAR / summaries — they contain `LoginToken` and guest PII (gitignored).

Findings: [ELEKTRAWEB-LIVE-BRIDGE.md](../../ELEKTRAWEB-LIVE-BRIDGE.md) §6.

## Captured (2026-07-15)

| Local file (Downloads) | Domain | Key Select objects |
|------------------------|--------|--------------------|
| `reservations.elektraweb.com.har` | Reserved list | `QA_HOTEL_RESERVATION_RESERVATION`, detail, `QA_HOTEL_RES_GUEST` |
| `reservations-inhouse.elektraweb.com.har` | In-house | `QA_HOTEL_RESERVATION` (`RESSTATEID=3`) |
| `reservations-checkout.elektraweb.com.har` | Reserved + CheckOut tab | `QA_HOTEL_RESERVATION_RESERVATION` + `QA_HOTEL_RESERVATION_CHECKOUT` (`RESSTATEID=4`) |
| `guests.elektraweb.com.har` | Guests | `QG_HOTEL_GUEST_SIMPLE`, `QA_HOTEL_GUEST_RECORD`, `QG_HOTEL_GUEST_ID` |
| `folios.elektraweb.com.har` | Folio day list | `Q_HOTELFOLIOACTION`, `HOTEL_FOLIOTRANS` |

CheckOut confirmed on shared res-all page (tab filter → separate Select object). No further status HARs needed for MVP.
