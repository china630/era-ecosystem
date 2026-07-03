# Design regression golden snapshots

Generate after starting hotel (`:3201`) and clinic (`:3203`) against demo seed:

```bash
npm run bootstrap:local:demo   # if needed
cd packages/satellite-kit && npm run build && cd ../..
# restart hotel + clinic dev servers to pick up Field* changes
npm run test:design-regression:update
```

**Credentials (clinic):** `chingiz@era.com` / `12345678` (see `e2e/design-regression/auth/helpers.ts`).

**Browser:** uses system Chrome (`channel: 'chrome'`) — no `playwright install chromium` required on Windows.

Expected files:

- `hotel/hotel-reservation-create.png`
- `hotel/hotel-reservation-edit.png`
- `hotel/hotel-guest-card.png`
- `clinic/clinic-appointment-create.png`

Commit updated PNGs in the same PR as intentional UI layout changes.
