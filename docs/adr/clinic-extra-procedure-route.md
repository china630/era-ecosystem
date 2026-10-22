# Clinic — extra procedure route

## Status

Accepted, 2026-10-22.

## Context

A doctor can prescribe a paid extra (`ProcedureOrder` `PENDING_PAY`, `inPackage = false`). Payment or hotel-folio confirmation then seats it (`payAndScheduleExtras`). Until that seat, the row must not occupy a cabin and must not reach nurse check-in, QR, or the resource matrix.

Nafta now wants the unpaid extra visible on the Plan tab for the doctor and reception, and on the guest print with an unpaid mark and empty time and room. The previous hide-until-pay behavior stays available.

## Decision

One org setting on `Tenant.extraProcedureRoute`:

| Value | Plan and guest print | Cabin, nurse, QR, matrix |
|---|---|---|
| `SHOW_ON_PLAN` (default) | Unpaid extra is listed. Print mark, empty time and room. The placeholder `scheduledAt` is not shown. | Closed until pay or folio |
| `HOLD_UNTIL_PAY` | Hidden, as before | Closed until pay or folio |

Package lines and `XFER-` leftovers are not this setting. Money routing is unchanged: in-house with a reservation posts to the hotel folio; walk-in stays `PENDING_PAY` until the hotel accepts payment. A rejected charge does not seat the batch. Delete before pay is still `PENDING_PAY` only. Episode close still purges `PENDING_PAY`.

The print-language dialog uses three radio chips (Azerbaijani, Russian, English). The selected language still opens the print URL with `lang` and `autoprint=1`.

## Consequences

Admin → Settings saves the route. `SHOW_ON_PLAN` is the default for existing tenants after the migration. HOT-06 and CLI-57 stay at their current coverage (not SHIPPED / SCREEN). Nurse and planner queries do not gain `PENDING_PAY`.
