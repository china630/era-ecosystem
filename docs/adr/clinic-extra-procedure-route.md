# Clinic — extra procedure route

## Status

Accepted, 2026-10-22. Amended 2026-10-25: plan-before-pay seats a real cabin.

## Context

A doctor can prescribe a paid extra (`ProcedureOrder` `PENDING_PAY`, `inPackage = false`). The default route seats it immediately and keeps it unpaid. Payment or hotel-folio confirmation opens nurse check-in on that same cabin (`payAndScheduleExtras`). Check-in and QR stay closed until the ticket.

Nafta wants each paid extra planned on its own day and cabin before payment. Doctor and reception see the payment mark. The nurse sees the row with a red unpaid block and cannot check in. Hide-until-pay stays available.

## Decision

One org setting on `Tenant.extraProcedureRoute`:

| Value | Plan and guest print | Cabin | Nurse |
|---|---|---|---|
| `PLAN_BEFORE_PAY` (default) | Real date, time, and room, unpaid mark first. `SHOW_ON_PLAN` is this value under the old name. | Held until pay, cancel, day end, or checkout | Visible. Check-in and QR stay closed. Red block **Ödəniş edilməyib** |
| `HOLD_UNTIL_PAY` | Hidden | Not held. Planner runs after pay or folio | Hidden until the ticket |

Payment of a seated row does not search for a new slot. A batch pays the ticked rows; the cheque list is ordered by time so the nearest rows are first. Cancelling one unpaid row cancels that procedure only. Cancelling one line of a printed multi-line cheque reverses only that amount and prints a three-copy storno. The other lines stay paid.

At clinic day end (`POST /api/cron/procedure-no-show-sweep`, after the no-show pass), today's seated unpaid rows become `UNPAID_MISSED`: off the cheque list, cabin freed, no folio charge, no bonus, no package quota. Future days stay. Checkout closes every remaining unpaid extra the same way. This is not `NO_SHOW`.

Package lines and `XFER-` leftovers are not this setting. A paid extra that belongs to a package block shares that block's daily cap and does not burn quota. Money routing is unchanged: in-house with a reservation posts to the hotel folio; walk-in stays `PENDING_PAY` until the hotel accepts payment. A rejected charge does not seat an unseated row.

The print-language dialog uses three radio chips (Azerbaijani, Russian, English). The selected language still opens the print URL with `lang` and `autoprint=1`.

## Consequences

Admin → Settings saves the route. Existing `SHOW_ON_PLAN` rows read as plan-before-pay. HOT-06 and CLI-57 stay SCREEN, not SHIPPED. The nurse board lists a seated `PENDING_PAY` row and does not check it in.
