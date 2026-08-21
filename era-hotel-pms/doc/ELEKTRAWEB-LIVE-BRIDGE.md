# Elektraweb live bridge — browser extension (dual-run)

> **Stage:** planned (docs 2026-07-15) · **ADR:** [docs/adr/hotel-elektraweb-live-bridge.md](../../docs/adr/hotel-elektraweb-live-bridge.md)  
> **App:** `era-hotel-pms` · **Prerequisite:** Excel bootstrap ([ELEKTRAWEB-IMPORT.md](./ELEKTRAWEB-IMPORT.md))  
> **Pilot:** Nafta sanatorium · **Duration:** ≤ ~2 weeks until hour-X cutover

Temporary **Chrome/Edge MV3** extension that intercepts Elektraweb SPA API traffic and mirrors **guests, reservations, and open folio lines** into ERA so:

1. Hotel ops stay on Elektraweb (SoT).
2. ERA hotel DB stays a live mirror (including folio for soft cutover).
3. Clinic runs fully on ERA using hotel lifecycle events.

**Not** a paid Eptera official API integration. **Not** a permanent product feature — disable at cutover.

---

## Implementation status

**MVP coded (2026-07-15):**

| Piece | Location |
|-------|----------|
| Extension (login form + intercept) | `extensions/elektraweb-bridge/` |
| Login | `POST /api/integrations/elektraweb-bridge/login` |
| Ingest | `POST /api/integrations/elektraweb-bridge` |
| Health | `GET /api/integrations/elektraweb-bridge/health` |

### Tenant binding (critical)

Hotel PMS is a **single-org satellite**. Writes always use `ERA_SATELLITE_ORGANIZATION_ID`.

| Check | Mechanism |
|-------|-----------|
| Which ERA org | Server env `ERA_SATELLITE_ORGANIZATION_ID` (never taken from Elektraweb) |
| Which Elektraweb property | Env `ELEKTRAWEB_HOTEL_ID` (Nafta `31606`) |
| Extension session | Login form → JWT embeds **both** org id + Elektraweb hotel id |
| Every row | `HOTELID` in payload must equal `ELEKTRAWEB_HOTEL_ID` or ingest returns **409** |

### Extension login form

Yes — Options page: ERA Hotel URL + staff login/password → bridge JWT (12h). Roles: Hotel_Admin, Manager, Receptionist, NightAuditor (+ OWNER/DIRECTOR). Optional shared `ELEKTRAWEB_BRIDGE_TOKEN` without form.

Docs: [extensions/elektraweb-bridge/README.md](../extensions/elektraweb-bridge/README.md)

## 1. Status and ownership

| Item | Value |
|------|--------|
| Coverage ID | `HOT-06` (API — extension MVP; UAT dual-run pending) |
| SoT during dual-run | Elektraweb |
| SoT after hour X | ERA Hotel PMS |
| Writer into ERA | Bridge ingest only (no FO dual-write in ERA UI) |
| Clinic | ERA — episodes from `CHECKED_IN` / booking / checkout events |

---

## 2. Operator UI entry points (Elektraweb)

Open these grids so list/detail XHR fire under the logged-in session. Observed app shell version: **v18.0.580** (subject to vendor upgrade).

| Domain | UI URL | Typical Elektraweb Excel analogue |
|--------|--------|-----------------------------------|
| Reservations | [app.elektraweb.com/app/grid/res-all/reservation](https://app.elektraweb.com/app/grid/res-all/reservation) | Reservations / FOCP |
| Folio posting / lines | [app.elektraweb.com/app/grid/toplu-islem-girisi](https://app.elektraweb.com/app/grid/toplu-islem-girisi) | Folio Transactions |
| Guest cards | [app.elektraweb.com/app/grid/guest-card-simple](https://app.elektraweb.com/app/grid/guest-card-simple) | Guest Cards |

Backend REST/Graph paths are **not** the same as these UI routes. Capture them via Discovery (§6).

---

## 3. Architecture

```text
┌─────────────────────────────────────┐
│  FO PC: Chrome + extension (MV3)    │
│  Session: Elektraweb login + 2FA    │
│  Tabs: res-all / guest-card / folio │
└──────────────┬──────────────────────┘
               │ intercept JSON responses
               │ (declarativeNetRequest / debugger /
               │  page-injected fetch hook — TBD impl)
               ▼
┌─────────────────────────────────────┐
│  POST /api/integrations/            │
│       elektraweb-bridge             │
│  Bearer ELEKTRAWEB_BRIDGE_TOKEN     │
│  body: { sourceUrl, capturedAt,     │
│          entityHint?, raw }         │
└──────────────┬──────────────────────┘
               │ normalize + Zod
               │ reuse externalRef keys
               ▼
┌─────────────────────────────────────┐
│  Guest / Reservation / FolioCharge  │
│  status-diff → lifecycle emit       │
│  → clinic bus / clinic-bridge       │
└─────────────────────────────────────┘
```

### Design rules

| Rule | Rationale |
|------|-----------|
| Extension = thin forwarder | Vendor JSON changes; mapping stays in hotel-pms |
| Prefer XHR/fetch intercept over DOM | SPA grids virtualize; DOM breaks on v18 upgrades |
| Same `externalRef` as Excel | Idempotent with bootstrap; no duplicate guests/res |
| Order in each batch: guest → reservation → folio | Avoid orphan charges |
| Hash / etag dedupe on server | Grids refetch often |
| Read-only toward Elektraweb | No auto clicks Save/Post |

---

## 4. Entity scope (MVP = cutover-ready mirror)

### 4.1 Guests — P0

| ERA field / behavior | Elektraweb source (Excel parity) | Notes |
|----------------------|----------------------------------|--------|
| `Guest.externalRef` | Guest Id | Required |
| Name parts / `fullName` | Name, Last Name | Ops cache |
| Passport / FIN | Passport No, National Id No | → `resolvePersonIdentity` → `globalPersonId` |
| Phone, email, nationality, VIP, visitCount | Guest Cards columns | Soft fields |
| Grey list / GDPR | Flags if present | Optional |

**Clinic need:** stable `globalPersonId` when identifiers exist. Incomplete cards: follow Excel skip policy for cancelled/future without stay ([ELEKTRAWEB-IMPORT.md](./ELEKTRAWEB-IMPORT.md) §15.5); always upsert cards linked to **in-house / arriving** reservations.

### 4.2 Reservations — P0

| ERA field / behavior | Elektraweb source (Excel parity) | Notes |
|----------------------|----------------------------------|--------|
| `Reservation.externalRef` | Res Id | Required |
| Guest link | Guest Id preferred; name fallback last resort | Bridge must prefer Guest Id from API |
| Room type / room | Room Type, Room No | Resolve existing master data |
| Dates | Arrival, Departure | |
| Status | State | **Critical** for lifecycle |
| Adults / children | Adult, TChd | |
| Agency / voucher | Agency, Voucher | Soft |
| Rate / package | Rate code if in payload | Map to `RatePlan`; medical → `programCode` |

**Status-diff → events** (must call hotel service paths, not silent Prisma-only write):

| Transition (examples) | Emit / side effect |
|-----------------------|--------------------|
| → In-house / CheckedIn | `SATELLITE_HOTEL_GUEST_CHECKED_IN` (+ clinic bridge) |
| Room number change while in-house | `SATELLITE_HOTEL_ROOM_CHANGED` |
| → CheckedOut | `SATELLITE_HOTEL_GUEST_CHECKED_OUT` |
| New medical reserved stay | `SATELLITE_HOTEL_SANATORIUM_BOOKING_CREATED` when applicable |

Exact Elektraweb status strings must be mapped via Discovery + `mapReservationStatus` (Excel helper) extended as needed.

### 4.3 Folio — P0 (same phase)

| ERA field / behavior | Elektraweb source (Excel parity) | Notes |
|----------------------|----------------------------------|--------|
| `FolioCharge.externalRef` | Folio line Id | Required |
| Reservation link | Res Id | **Required** — do not link by Guest Name alone |
| Revenue code | Revenue Code | Must exist from Excel dictionaries |
| Amount | Income / Local Amount | AZN |
| Business date | Date | |
| Description | Notes / Doc Note / Guest Name | Concat ok |

**Include:** open / active lines for in-house + unsettled deferred (`T{ResId}`) per [deferred-checkout ADR](../../docs/adr/hotel-deferred-corporate-checkout.md).  
**Exclude:** multi-year closed archive, pure POS house ledger (`999 FB`) unless needed for reconciliation.

**Dual-run rule:** do **not** run ERA night audit posting on mirrored medical stays (would double-post vs Elektraweb). Mirror for display, balance, and cutover; live posting switches to ERA only after bridge off.

---

## 5. Planned hotel ingest API

> Not implemented yet — contract for implementation.

### `POST /api/integrations/elektraweb-bridge`

| Item | Spec |
|------|------|
| Auth | `Authorization: Bearer <ELEKTRAWEB_BRIDGE_TOKEN>` (dedicated secret; not staff JWT) |
| Content-Type | `application/json` |
| Body | See schema below |
| Response 202/200 | `{ accepted, entity, upserted, skipped, eventsEmitted[], errors[] }` |
| Idempotency | Prefer `Idempotency-Key: sha256(url+body)` header or server hash |

```ts
// Conceptual contract (Zod on server)
{
  capturedAt: string;       // ISO
  sourceUrl: string;        // full request URL that returned JSON
  pageUrl?: string;         // browser tab URL (res-all / guest-card / …)
  method?: string;          // GET/POST
  entityHint?: 'guest' | 'reservation' | 'folio' | 'unknown';
  elektrawebAppVersion?: string; // e.g. "v18.0.580"
  raw: unknown;             // vendor JSON as-is (array or object)
}
```

Optional batch endpoint: `POST .../elektraweb-bridge/batch` with `items: BridgeEnvelope[]` processed guest→reservation→folio.

### `GET /api/integrations/elektraweb-bridge/health`

Returns last success timestamp, counts (24h), last error — for FO supervisor / dual-run dashboard (minimal UI ok).

### Env

| Variable | Purpose |
|----------|---------|
| `ELEKTRAWEB_BRIDGE_TOKEN` | Shared secret for extension → hotel |
| `ELEKTRAWEB_BRIDGE_ENABLED=1` | Kill switch (503 when off) |
| `ELEKTRAWEB_BRIDGE_ALLOWED_ORIGINS` | Optional allowlist of Elektraweb hosts |

Extension stores: hotel base URL + token in extension options (not in git).

---

## 6. Discovery (API shape from HAR)

UI: `app.elektraweb.com` · API: `api.s05.elektraweb.com` (Nafta `HOTELID=31606`; other properties may use `api.sXX`).

Auth: JSON body field **`LoginToken`** on each `POST` (not `Authorization` Bearer). Extension forwards responses only — never persist/export the token.

Envelope:

```text
POST https://api.s05.elektraweb.com/Select/{OBJECT}
Content-Type: application/json
Body: { Action: "Select", Object, Select[], Where[], OrderBy?, LoginToken, ... }
Response: { DataTypes, ResultSets: [ rows[] ], SQL?, TotalCount? }
```

Raw HAR = gitignored (`*.har`) — live tokens + guest PII.

### 6.1 Reservations — DONE

| View / filter | UI | Select object | Where highlight |
|---------------|-----|---------------|-----------------|
| Future / reserved | `/app/grid/res-all/reservation` | `QA_HOTEL_RESERVATION_RESERVATION` | `HOTELID=31606` |
| In-house | `/app/grid/res-all/inHouse` | `QA_HOTEL_RESERVATION` | `RESSTATEID=3` + `HOTELID` |
| Check-out (tab on same res-all page) | `/app/grid/res-all/…` tab | `QA_HOTEL_RESERVATION_CHECKOUT` | `HOTELID` (sample: all rows CheckOut) |
| Card open | (from either grid) | `QA_EASYPMS_RESDETAIL` + `QA_HOTEL_RES_GUEST` | by Res Id |

Same browser page + tab filter is enough: each tab hits a **different Select object** (F5 alone may re-fetch only the active tab — mixed HAR with both Reservation list + CheckOut tab is fine).

| `RESSTATEID` | `RESSTATE` (confirmed) | ERA / clinic |
|--------------|------------------------|--------------|
| `2` | `Reservation` | reserved / arrive soon |
| `3` | `InHouse` | check-in → clinic episode |
| `4` | `CheckOut` | check-out → close clinic episode |

| Field | List reserved | List in-house | List check-out | ERA |
|-------|---------------|---------------|----------------|-----|
| `RESID` / `ID` | yes | yes | yes | `Reservation.externalRef` |
| `RESSTATE` / `RESSTATEID` | yes | yes | yes | status + lifecycle |
| `CHECKIN` / `CHECKOUT` | yes | yes | yes | dates |
| `ROOMNO` / `ROOMTYPECODE` | partial / yes | yes / yes | yes | room — **strip** trailing `S` (`707S`→`707`); never create virtual room |
| `RATECODE` / `RATECODEID` | yes | yes | yes | rate / medical program |
| `AGENCY` | yes | yes | yes | agency |
| `GUESTNAMES` | yes | yes | yes | display |
| `RESGUESTID` / `CONTACTGUESTID` | ~36–47% | ~83% | ~93% | soft guest link |
| Detail `GUESTID` + `QA_HOTEL_RES_GUEST` | when card opened | when card opened | when card opened | hard `Guest.externalRef` |
| Detail `RECORDTYPE` / `RESTYPE` / `ROOMCOUNT` / `ROOMCNT` | often missing on list | — | — | share second-guest signal when present on card |
| `SHARENO` | optional | optional | optional | display label only |

**Shared twin:** after reservation upsert, `applyElektrawebSharePair` (`elektraweb-share-map.ts`) pairs SHARE / Room Count 0 / `…S` with the NORMAL neighbor on the same physical door. **Do not** clear `shareEligible` when EW later sets Record Type NORMAL after first-out. Canon: [hotel-shared-twin-assignment.md](../../docs/adr/hotel-shared-twin-assignment.md).

**Extension:** allowlist all three list objects + detail/guest-on-stay when FO opens a card.

### 6.2 Guests — DONE

UI: `/app/grid/guest-card-simple` (config also references `guest-cards`).

| Call | Object | Role |
|------|--------|------|
| List | `QG_HOTEL_GUEST_SIMPLE` | ~100 rows/page; `ID` = Guest Id |
| Card | `QA_HOTEL_GUEST_RECORD` | full profile |
| Identity docs | `QG_HOTEL_GUEST_ID` | `ID_NUMBER` / type (passport etc.) |
| Address / comm | `QG_HOTEL_GUEST_ADDRESS`, `QG_HOTEL_GUEST_COMM` | optional |

| Field | List fill (sample) | ERA |
|-------|-------------------|-----|
| `ID` | 100% | `Guest.externalRef` |
| `NAME` / `LNAME` / `FULLNAME` | 100% | name ops-cache |
| `PASSPORTNO` | ~95% | MDM / identity |
| `NATIONALIDNO` (FIN) | often empty on list | use when present; card/doc child may help |
| `PHONE` | ~50% | ops |
| `BIRTHDATE` | ~94% | ops |
| `COUNTRYCODE` / nationality | yes | nationality |

### 6.3 Folio — DONE

UI: `/app/grid/toplu-islem-girisi`

| Call | Object | Role |
|------|--------|------|
| Day list (main) | `Q_HOTELFOLIOACTION` | lines for date range (sample: `TDATE` = today) |
| Line detail | `HOTEL_FOLIOTRANS` | one `ID` |

| Field | Notes | ERA |
|-------|-------|-----|
| `ID` | folio line id | `FolioCharge.externalRef` |
| `RESID` / `INITIALRESID` | **always linked in sample** | reservation `externalRef` |
| `CTOTAL` / `MCTOTAL` | **amount** (AZN); do **not** use `REVENUE` for money — that is the **name** |
| `REVCODE` / `REVID` / `REVENUE` | code + id + name (e.g. SPA MEDIKAL) | map to `RevenueCode` (may need code crosswalk vs Excel string codes) |
| `TDATE` | business date | `businessDate` |
| `ROOMNO` / `GUESTNAMES` | display; link via `RESID` | — |
| `DEPCODE` | department | soft |
| `POSCHECKID` | often set (SPA/POS) | soft |

Sample day list: 73 lines, mostly `RESSTATEID=3` (in-house). Amount always on `CTOTAL`/`MCTOTAL`; `REVCODE` empty on some payment/adjustment rows.

**Dual-run filter:** prefer open in-house / current-day (and unsettled) — not multi-year archive.

### 6.4 Still useful (non-blocking)

| Item | Why |
|------|-----|
| Revenue code crosswalk `REVCODE` ↔ ERA `RevenueCode.code` | folio upsert without unknown-code errors |
| FO PC list + hotel-pms staging URL | extension rollout |
| ERA night audit posting **off** during dual-run | no double post |

`RESSTATEID=4` / `CheckOut` confirmed via mixed HAR (`QA_HOTEL_RESERVATION_CHECKOUT`) — separate CheckOut-only capture not required.

---

## 7. Extension package (planned layout)

```text
era-hotel-pms/extensions/elektraweb-bridge/
  manifest.json          # MV3, host_permissions: app.elektraweb.com + api.*.elektraweb.com
  background.js          # service worker: queue + POST bridge
  content-or-hook.js     # response capture strategy
  options.html           # hotel URL + token + enable toggle
  README.md              # load unpacked steps
```

### Install (operator)

1. `chrome://extensions` → Developer mode → Load unpacked.
2. Options: paste hotel URL + bridge token; Enable = on.
3. Open Elektraweb grids (§2); perform normal FO work.
4. Health: hotel admin ping or extension badge (green = last sync &lt; N min).

### Security

- Token scoped to bridge route only; rotatable at cutover.
- Do not log full `raw` bodies to browser console in production builds.
- Uninstall extension on all FO machines at hour X; rotate/delete `ELEKTRAWEB_BRIDGE_TOKEN`.

---

## 8. Dual-run runbook

### 8.1 Before bridge

1. Excel wizard complete for master + guests + reservations + folio baseline ([IMPORT_FILE_CHECKLIST](./nafta/IMPORT_FILE_CHECKLIST.md)).
2. Medical rate plans mapped (`medicalFlag` / `programCode`).
3. Clinic bridge env set (`CLINIC_URL`, `CLINIC_BRIDGE_SECRET` / event bus).
4. `ELEKTRAWEB_BRIDGE_ENABLED=1` + token set on hotel-pms.
5. Extension on all agreed FO PCs.

### 8.2 During dual-run

| Do | Don't |
|----|--------|
| Work reservations/folio in Elektraweb | Edit same stays in ERA FO UI |
| Open guest/reservation/folio grids after busy periods | Assume background sync without any UI traffic |
| Watch bridge health / error counts | Run ERA night audit on mirrored medical in-house |
| Clinic ops entirely in ERA Clinic | Expect clinic without Guest Id / FIN on guest |

### 8.3 Hour X (cutover)

1. Soft freeze FO changes for N minutes; force grid refresh → last sync green.
2. Reconcile: in-house count ERA vs Elektraweb; open folio sum spot-check.
3. Disable bridge (`ELEKTRAWEB_BRIDGE_ENABLED=0`); uninstall extensions; revoke token.
4. Elektraweb → read-only / decommission plan.
5. Enable ERA as SoT (reception on hotel-pms); night audit + folio posting on.
6. Clinic continues — no bulk re-import required if lifecycle already open.

---

## 9. Failure modes

| Symptom | Likely cause | Mitigation |
|---------|--------------|------------|
| Clinic empty, hotel has guests | Upsert without lifecycle emit | Fix ingest to call check-in services on status-diff |
| Duplicate guests | Missing Guest Id / name fallback | Prefer API Guest Id; reconcile Excel externalRef |
| Orphan folio lines | Res not mirrored yet | Batch order + retry queue |
| Sync silent on one desk | Extension missing / disabled | FO PC checklist |
| Sudden mass errors | Elektraweb upgraded (new v18.x) | Version gate + pause bridge |
| Balance drift | ERA audit ran in dual-run | Kill audit for mirrored stays |

---

## 10. Relation to Excel import

| Phase | Tool |
|-------|------|
| Bootstrap history + master | `/admin/import` Excel wizard |
| Dual-run delta (≤2 weeks) | This live bridge |
| After cutover | ERA native + OTA adapters ([hotel-ota-adapter-strategy](../../docs/adr/hotel-ota-adapter-strategy.md)) |

Bridge field maps should stay aligned with adapters:

- `src/lib/import/adapters/guests.adapter.ts`
- `src/lib/import/adapters/reservations.adapter.ts`
- `src/lib/import/adapters/folios.adapter.ts`

Prefer shared normalize helpers over copy-paste when implementing.

---

## 11. Alternatives not chosen (this pilot)

| Option | Why not for Nafta 2-week window |
|--------|----------------------------------|
| Paid Eptera API | Cost; long procurement |
| Playwright VM + persistent profile | Heavier ops; 2FA re-login; preferred only if extension host policy blocks FO installs |
| Nightly Excel only | Too slow for clinic day-ops |

---

## 12. References

| Doc | Role |
|-----|------|
| [ADR hotel-elektraweb-live-bridge](../../docs/adr/hotel-elektraweb-live-bridge.md) | Decision |
| [ELEKTRAWEB-IMPORT.md](./ELEKTRAWEB-IMPORT.md) | Bootstrap + externalRef |
| [NAFTA_SANATORIUM_UAT.md](../../docs/NAFTA_SANATORIUM_UAT.md) §6.2 | Cutover scope |
| [hotel-deferred-corporate-checkout.md](../../docs/adr/hotel-deferred-corporate-checkout.md) | T-room folio |
| [INTEGRATION_SSO_EVENTS.md](../../docs/INTEGRATION_SSO_EVENTS.md) | Hotel lifecycle events |
| [elektraweb API pricing (vendor)](https://www.elektraweb.com/en/api-integrations) | Why official API skipped |
