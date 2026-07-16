# ERA Elektraweb Bridge (Chrome/Edge MV3)

Temporary dual-run extension: while FO works in Elektraweb, intercepted `/Select/*` JSON is forwarded to this hotel-pms deployment.

**Login form:** yes — Options page asks for ERA Hotel PMS URL + staff login/password. Server returns a **bridge JWT** that embeds:

- `organizationId` = `ERA_SATELLITE_ORGANIZATION_ID` of that hotel instance  
- `elektrawebHotelId` = `ELEKTRAWEB_HOTEL_ID` (e.g. Nafta `31606`)

Every ingest rejects payloads whose `HOTELID` ≠ that value → no cross-tenant spill.

## Install

1. Hotel `.env`:
   ```env
   ELEKTRAWEB_BRIDGE_ENABLED=1
   ELEKTRAWEB_HOTEL_ID=31606
   ERA_SATELLITE_ORGANIZATION_ID=<your-nafta-org-uuid>
   AUTH_JWT_SECRET=<same as hotel>
   ```
2. Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → this folder.
3. Extension **Options** → URL (e.g. `http://127.0.0.1:3201`) + ERA reception/admin login → **Log in & save**.
4. Open Elektraweb grids (reservations / in-house / checkout tab / guests / folio). Popup → **Capture & sync** ON.

## Security

- Do not commit HAR files (contain Elektraweb `LoginToken`).
- Uninstall extension + set `ELEKTRAWEB_BRIDGE_ENABLED=0` at hour-X cutover.
- Optional shared token auth: `ELEKTRAWEB_BRIDGE_TOKEN` (Bearer) without login form.

Docs: [ELEKTRAWEB-LIVE-BRIDGE.md](../../doc/ELEKTRAWEB-LIVE-BRIDGE.md)
