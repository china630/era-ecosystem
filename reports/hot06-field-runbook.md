# HOT-06 field runbook (SaaS Wave 9)

**Purpose:** human field / sanatorium-desk evidence for Elektraweb SPA Insert dual-run.  
**Does not claim:** HOT-06 **SHIPPED**, edition `ga`, or Scaffold flips. Lab already passed — see [`hot06-lab-signoff.md`](./hot06-lab-signoff.md).

Fill the **Field checklist** at the bottom only after a real desk run.

## Preconditions

1. Super-Admin: hotel org Elektraweb policy saved (`inboundEnabled`, `writeEnabled`, `elektrawebHotelId`, walk-in RESID/RESNAMEID as needed) + Sync to hotel `ElektrawebBridgePolicy`.
2. Super-Admin: clinic org cutover `elektrawebDualRun=true` + Sync `ClinicCutoverPolicy`.
3. Hotel process: `ELEKTRAWEB_BRIDGE_ENABLED=1` (pool kill switch). Property HOTELID is **not** in env — only on policy row.
4. MV3 extension on **sanatorium** desk: logged in with JWT that includes **hotel** `organizationId`; Write ON; SPA open.
5. Clinic ops: staff can open `/reception/extra-tickets`.

## Steps (SPA Insert path)

1. Doctor assigns a **paid** extra (or over-quota package extra) on a patient linked to an in-house stay when possible.
2. Reception → `/reception/extra-tickets` → select row(s) → **Issue ticket** → confirm 3-copy print opens.
3. Confirm hotel outbox has a PENDING (or claimed) row for that **hotel** `organizationId` (health / drain UI or DB). Wrong org must not appear.
4. Extension drains write → Elektraweb SPA Insert lands on guest folio (in-house) or Tibbi Ambulator walk-in house folio.
5. Nurse: extra without ticket → check-in blocked (`TICKET_REQUIRED`).
6. **Hour X (one org only):** Super-Admin turns `writeEnabled` and/or clinic `elektrawebDualRun` **off** for this org only → new Issue/drain must refuse; other orgs in the pool (if any) unaffected.

## Negatives

- JWT / session without `organizationId` → bridge auth refuse.
- HOTELID in payload ≠ policy for that org → mismatch refuse.
- `ELEKTRAWEB_BRIDGE_ENABLED=0` → write refuse even if policy `writeEnabled`.

## Field checklist

| Step | Result (pass / fail / skip) | Notes |
|------|-----------------------------|-------|
| Policy Sync visible on hotel/clinic | pending | |
| Issue ticket → outbox org stamp correct | pending | |
| Live SPA Insert on sanatorium desk | pending | |
| Walk-in → Tibbi Ambulator house folio | pending | |
| Hour-X: write + dual-run off for one org only | pending | |

### Field signoff

- Runner:
- Date:
- Verdict: **not passed** — required before HOT-06 SHIPPED / COVERAGE SHIPPED
