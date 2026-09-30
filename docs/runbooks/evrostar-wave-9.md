# Evrostar Wave 9 — Live floor board + geofence review

**ADR:** [cp-workforce-floor-attendance.md](../adr/cp-workforce-floor-attendance.md) decisions 1, 2, 7  
**Capability:** `CP-WF-FLOOR-01` (**API**, not SHIPPED — needs HR UAT-SMOKE)  
**Depends on:** Wave 6 (`CP-WF-ATT-01` punches + DRAFT rebuild), Wave 2 places/roster

## Goal

HR sees **who is expected on site today** (Asia/Baku) from roster + IN/OUT punches, and a queue of **SUSPICIOUS** punches. Geofence and shift-window flags never drop a punch; DRAFT rebuild skips `SUSPICIOUS` until HR **Accept**. Finance payroll is unchanged. Breaks, phone app, and money math stay later waves.

## Preconditions

1. Places exist; optionally set `latitude` / `longitude` / `radiusMeters` / `graceMinutes` / `allowOutside` on `/workspace/workforce/places`.
2. Devices + identity maps from Wave 6.
3. Roster assignments so the board knows who is expected (`DAY_OFF` does not appear in “not arrived”).

## Ingest policy

`POST /platform/v1/workforce/attendance/punches` (same Wave 6 contract) plus optional `latitude` / `longitude`.

- Punch is always stored.
- `reviewStatus=SUSPICIOUS` when any of: `OUTSIDE_RADIUS`, `OUTSIDE_WINDOW`, `MULTI_PLACE`.
- No coordinates → geofence silent. Empty `radiusMeters` → geofence off.
- `allowOutside` only labels the card; accept is still required.
- Raw `occurredAt` / `direction` / `personRef` stay immutable.

## Rebuild

`POST …/attendance/rebuild` includes only `CLEAR` and `ACCEPTED`. After Accept, HR runs rebuild (no auto month rebuild). Optional Accept overlay `occurredAt` lives in the journal; rebuild uses the latest ACCEPT overlay without rewriting the punch row.

## Floor API / UI

- `GET /platform/v1/workforce/attendance/floor?date=` (default `todayBakuYmd()`), optional `orgUnitId` / `placeId`.
- Expected people: assignment **or** brigade assignment + **day override** (`DAY_OFF` skipped; EXTRA/SWAP applied).
- Response includes `persons` MDM display names (same batch as timesheet).
- Suspicious queue is filtered to the board date.
- `GET …/punches/:id` — punch + journal (UI: click card / queue row).
- `POST …/punches/:id/accept` — `reason` required; optional `occurredAt` overlay.
- Screen: `/workspace/workforce/floor` (sidebar next to attendance); place filter on the page.

## UAT (lab)

1. Punch outside radius → stored SUSPICIOUS; rebuild → no DRAFT cell.
2. Accept with reason → rebuild → DRAFT; punch `occurredAt` unchanged if overlay used.
3. Inside radius / no coords → CLEAR → rebuild writes as Wave 6.
4. Second IN while OPEN on another place → `MULTI_PLACE`.
5. APPROVED timesheet cell → rebuild skips.

## Out of scope

BREAK_START/END, employee requests, OT/night money in Finance, Evrostar allowances, dedicated phone app, face templates / photo storage.

## Evidence

Jest: `workforce-attendance.wave9.spec.ts` (+ Wave 6 suite still green). COVERAGE `CP-WF-FLOOR-01` = **API** until UI UAT-SMOKE.
