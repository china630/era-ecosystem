# ERA Elektraweb Bridge (Chrome/Edge MV3)

Temporary dual-run extension: Elektraweb session on the desk PC ↔ this hotel-pms deployment.

**Settings UI:** toolbar **lamp** (gray / yellow / green / red) **and the same circle on the Elektraweb page** (bottom-right; drag to move). Needed when Chrome **Open as window** hides the extension toolbar. Click the on-page circle for Capture / Write / settings. Locale EN / RU / AZ.

**Toolbar / on-page lamp**

| Color | Meaning | Operator action |
|-------|---------|-----------------|
| Gray | No ERA login | Settings → **Log in & save** |
| Yellow | Logged in but Capture off, or sanatorium write waiting for Elektraweb SPA session | Turn **Capture & sync** ON; on SPA desk open Elektraweb SPA |
| Green | ERA session live, capture on, no sync error | None |
| Red | JWT expired (~12h) or last ingest/outbox error | Settings → log in again, or fix the error shown in popup |

Tooltip on the toolbar icon repeats the same text (EN / RU / AZ). Popup, Settings, and the on-page overlay show a matching dot.

Chrome **Install as app / Open as window:** the toolbar lamp is hidden. Use the floating circle on `app.elektraweb.com` (not a bookmarklet). First login still uses Settings (opens a normal Chrome tab).

**Login:** Options asks for ERA Hotel PMS URL + staff login/password. Server returns a **bridge JWT** that embeds:

- `organizationId` = `ERA_SATELLITE_ORGANIZATION_ID` of that hotel instance  
- `elektrawebHotelId` = `ELEKTRAWEB_HOTEL_ID` (e.g. Nafta `31606`)

Every ingest rejects payloads whose `HOTELID` ≠ that value → no cross-tenant spill.

## Desk roles

| Setting | PC | What runs |
|---------|----|-----------|
| **Hotel front office** | FO | Inbound only (`Select` JSON → ERA). Write toggle ignored. |
| **Sanatorium reception** | SPA (guest folio + Tibbi Ambulator house folio) | Inbound optional + **write** drain of extra tickets (`GET …/outbox` → `SP_SPA_SAVE` + ack). |

Write must **not** run on FO: extras need the three-copy SPA ticket on the sanatorium desk. See [ADR reverse folio](../../../docs/adr/hotel-elektraweb-reverse-folio-post.md).

## Install

1. Hotel `.env`:
   ```env
   ELEKTRAWEB_BRIDGE_ENABLED=1
   ELEKTRAWEB_BRIDGE_WRITE_ENABLED=1
   ELEKTRAWEB_HOTEL_ID=31606
   ELEKTRAWEB_SPA_DEPID=133387
   ELEKTRAWEB_SPA_CURRENCY_ID=10
   ELEKTRAWEB_WALKIN_RESID=66246938
   ELEKTRAWEB_WALKIN_RESNAMEID=100670215
   ERA_SATELLITE_ORGANIZATION_ID=<your-nafta-org-uuid>
   AUTH_JWT_SECRET=<same as hotel>
   POS_BRIDGE_SECRET=<same as clinic>
   ```
2. Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → this folder.
3. Extension **Settings** → URL + **ERA organization ID (hotel UUID)** + ERA reception login (`emp-…` / `0000` after Workforce grant, or seed `reception` / `reception123`) → **Log in & save**.
4. Pick **This desk**. Hotel FO: open Elektraweb grids (reservations / in-house / checkout / guests / folio). Sanatorium: keep SPA open (guest folio and Tibbi Ambulator).
5. Popup or Settings → **Capture & sync** ON. Toolbar lamp should turn **green** (yellow if capture is still off; red if login expired). Sanatorium: **Write** ON and keep SPA open so `LoginToken` exists.

Clinic dual-run: Super-Admin `ClinicCutoverPolicy` (Sync) + `HOTEL_PMS_URL` + same `POS_BRIDGE_SECRET`. Reception: `/reception/extra-tickets`.

## Security

- Do not commit HAR files (contain Elektraweb `LoginToken`).
- Uninstall extension + set `ELEKTRAWEB_BRIDGE_ENABLED=0` at hour-X cutover (and turn off org policy write/inbound).
- Auth is staff/bridge JWT per org — no process-wide shared bridge token.

Docs: [ELEKTRAWEB-LIVE-BRIDGE.md](../../doc/ELEKTRAWEB-LIVE-BRIDGE.md) · [reverse folio ADR](../../../docs/adr/hotel-elektraweb-reverse-folio-post.md) · [SaaS Wave 1](../../../docs/SAAS_SHARED_RUNTIME.md)
