# Evrostar Wave 6 — FaceID / attendance → DRAFT timesheet

**ADR:** [evrostar-workforce-pilot.md](../adr/evrostar-workforce-pilot.md) wave 6  
**Capability:** `CP-WF-ATT-01` (**API**, not SHIPPED — needs field tablet UAT)  
**Depends on:** Wave 1 (timesheet), Wave 2 (`WorkforcePlace`)

## Goal

Vendor-agnostic tablets POST punches; CP stores immutable raw events and rebuilds **DRAFT** timesheet cells (`source=faceid`). Approve month + payroll stay waves 1/5. No FaceID SDK, no pay from biometrics, no ƏMAS.

## Preconditions

1. Collect vendor **personRef** values (badge / FIN / vendor user id) **before** go-live.
2. Places exist (`/workspace/workforce/places`).
3. Create devices: `/workspace/workforce/attendance` → Add device → copy `att_…` token once.
4. Map each personRef → employment (same org only; two VÖEN = two mappings).

## Ingest contract

`POST /platform/v1/workforce/attendance/punches`

- Auth: `Authorization: Bearer att_<deviceToken>` (per-device; **not** user JWT, **not** `SATELLITE_EVENT_SERVICE_TOKEN`).
- Optional: device created with `requireHmac` → `X-Attendance-Signature: sha256=<hmac-sha256(body, bearerToken)>`.
- Body (Zod, `@era/contracts` `workforceAttendancePunchBatchSchema`):

```json
{
  "punches": [
    {
      "occurredAt": "2026-09-16T16:00:00.000Z",
      "direction": "IN",
      "personRef": "badge-42",
      "externalId": "vendor-event-1",
      "placeCode": "SITE_A"
    }
  ]
}
```

- Idempotent on `(deviceId, externalId)`.
- Unmapped personRef → punch `UNMAPPED` (no timesheet write until mapped).

CSV fallback (HR): same pipeline via UI **Import CSV**  
`occurredAt,direction,personRef[,externalId,placeCode]`.

## Rebuild

`POST /platform/v1/workforce/attendance/rebuild` body `{ "from", "to" }` **or** `?from=&to=`  
or UI button. Optional `usePlannedIfOpen=true` fills OPEN (no OUT) from roster planned hours only — default **false** (no invented 8h).

Nightly cron `15 0 * * *` Asia/Baku rebuilds **yesterday** for orgs with recent punches.

Pairs IN→OUT **same place** (Asia/Baku); night OUT next calendar day → hours on **IN** date. Caps from that day's ShiftType / 24h.

Skips: month `APPROVED`, cell `APPROVED`, `lockedFromAbsence`. New punches still append; rebuild leaves locked cells.

## Isolation

Device org A cannot write employment org B. Two tablets on one physical site for two firms = two devices + two identity maps.

## UAT (lab)

1. Bad token → 401.
2. Create device + identity; ingest IN/OUT; rebuild → DRAFT cell `source=faceid`.
3. Duplicate `externalId` → no double hours.
4. Approve cell / absence lock → rebuild skips.
5. Night IN 20:00 OUT 08:00 → one WORK day on IN date.

## Out of scope

ZKTeco/Hikvision SDK, on-prem agent product, auto-approve month, geofence, face templates in ERA, pay from punch.

## Evidence

Jest: `workforce-attendance.wave6.spec.ts`. COVERAGE stays **API** until field tablet + UAT-SMOKE. **P1:** attendance UI exposes `usePlannedIfOpen` (default off) + employment FIO from persons map — still not SHIPPED.
