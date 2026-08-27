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

CheckOut confirmed on shared res-all page (tab filter → separate Select object). No further status HARs needed for inbound MVP.

## Reverse folio — capture session (2026-08-27)

Need **Save** (write) traffic, not only Select lists. In-house extras were captured via CDP listen (2026-08-27). Walk-in extras are the same SPA Save onto house folio **`TIBB AMBULATOR FOLIO`** — Cash Office capture is cancelled.

**Do not commit** `.har` / `_spa_listen.txt`. They contain `LoginToken` and guest PII.

### DevTools (once per file)

1. `app.elektraweb.com` already logged in (sanatorium SPA / Cash Office user).
2. F12 → **Network**.
3. Preserve log **ON**. Filter: **Fetch/XHR**.
4. Click the trash icon (clear) **right before** the Save you care about.
5. After a **successful** Save (and optional Void): Network → empty area → **Save all as HAR with content**.

### Captured vs still waiting (2026-08-27)

| Capture | Status | Notes |
|---------|--------|-------|
| In-house SPA extras | **Done** (CDP `_spa_listen.txt`) | `SP_SPA_SAVE` + `saveCheck` print — not Quick Posting |
| Walk-in extras | **Done** (CDP + operator folio check) | Same `SP_SPA_SAVE` onto `TIBB AMBULATOR FOLIO`: `RESID` 66246938, `RESNAMEID` 100670215. Cash Office HAR cancelled. |
