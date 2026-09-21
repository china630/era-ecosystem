# ERA Elektraweb Bridge (Chrome/Edge MV3)

Temporary dual-run extension: Elektraweb session on the desk PC ↔ this hotel-pms deployment.

**Settings UI (v0.3.13+):** Chrome **toolbar** icon only (gray / yellow / green / red circle). Click the icon → popup: Capture / Write / Flush / Open settings. **No floating lamp on the Elektraweb page** (it blocked FO grids). Prefer a normal Chrome tab for FO so the toolbar is visible; if you use “Open as window”, open Settings from `chrome://extensions` → Details → Extension options.

**Toolbar lamp**

| Color | Meaning | Operator action |
|-------|---------|-----------------|
| Gray | No ERA login | Popup or Settings → login |
| Yellow | Logged in but Capture off, or sanatorium write waiting for Elektraweb SPA session | Turn **Capture & sync** ON; on SPA desk open Elektraweb SPA |
| Green | ERA session live, capture on, no sync error | None |
| Red | JWT expired (~12h) or last ingest/outbox error | Login again; check last error in popup/Settings |

Tooltip on the toolbar icon repeats the same text (EN / RU / AZ).

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
2. Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → this folder. On update to **0.3.13+**: **Reload** the card (on-page floating lamp is removed — use toolbar popup).
3. Extension **Settings** → URL + **ERA organization ID (hotel UUID)** + ERA reception login (`emp-…` / `0000` after Workforce grant, or seed `reception` / `reception123`) → **Log in & save**.
4. Pick **This desk**. Hotel FO: open Elektraweb grids (reservations / in-house / checkout / guests / folio). Sanatorium: keep SPA open (guest folio and Tibbi Ambulator).
5. Toolbar icon → popup → **Capture & sync** ON. Lamp should turn **green**. Sanatorium: **Write** ON and keep SPA open so `LoginToken` exists.

**Operator order (inbound):** Guest Cards first, then FOCP / in-house. Extra Req is **not** on the FOCP list — open CRM → Reservations → **Reservation Notes** (`/app/grid/allresnotes`). Hotel API must be on a build that ingests `QA_EASYPMS_NOTES` and name-matches FOCP guests (no first-guest fallback).

**Guest Cards bulk (v0.3.12+):** each grid page (~100 guests) is one queue envelope and waits on MDM resolve per row. Do **not** race-scroll: after each page wait until Settings / popup **Queue** is near 0. Older builds (`MAX_QUEUE=40`) silently dropped earlier pages. Reload unpacked extension after update (**0.3.13**: no on-page lamp).

Clinic dual-run: Super-Admin `ClinicCutoverPolicy` (Sync) + `HOTEL_PMS_URL` + same `POS_BRIDGE_SECRET`. Reception: `/reception/extra-tickets`.

## Security

- Do not commit HAR files (contain Elektraweb `LoginToken`).
- Uninstall extension + set `ELEKTRAWEB_BRIDGE_ENABLED=0` at hour-X cutover (and turn off org policy write/inbound).
- Auth is staff/bridge JWT per org — no process-wide shared bridge token.

Docs: [ELEKTRAWEB-LIVE-BRIDGE.md](../../doc/ELEKTRAWEB-LIVE-BRIDGE.md) · [reverse folio ADR](../../../docs/adr/hotel-elektraweb-reverse-folio-post.md) · [SaaS Wave 1](../../../docs/SAAS_SHARED_RUNTIME.md)
