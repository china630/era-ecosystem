# Clinic — extra procedure route

## Status

Accepted, 2026-10-22. Amended 2026-10-25: plan-before-pay seats a real cabin. Amended 2026-10-27: day-end also closes overdue and unseated-before-today unpaid extras; extra-tickets show full `DD.MM.YYYY HH:mm`. Amended 2026-10-30: OPEN (`schedulingMode`) under `PLAN_BEFORE_PAY` pins day-buckets across the stay (no cabin); Pay keeps those pins — see [clinic-open-attendance.md](./clinic-open-attendance.md). Amended 2026-10-30: `/reception/extra-tickets` asks for a room or a name and does not cut the clinic to the earliest 200; a procedure dated before today (Asia/Baku) stays off that screen.

## Context

A doctor can prescribe a paid extra (`ProcedureOrder` `PENDING_PAY`, `inPackage = false`). The default route seats it immediately and keeps it unpaid. Payment or hotel-folio confirmation opens nurse check-in on that same cabin (`payAndScheduleExtras`). Check-in and QR stay closed until the ticket.

Nafta wants each paid extra planned on its own day and cabin before payment. Doctor and reception see the payment mark. The nurse sees the row with a red unpaid block and cannot check in. Hide-until-pay stays available.

## Decision

One org setting on `Tenant.extraProcedureRoute`:

| Value | Plan and guest print | Cabin | Nurse |
|---|---|---|---|
| `PLAN_BEFORE_PAY` (default) | Real date, time, and room, unpaid mark first. OPEN types: day pin only (no cabin) until nurse seat. `SHOW_ON_PLAN` is this value under the old name. | FIXED: cabin held until pay/cancel/day end/checkout. OPEN: day-bucket held (no cabin) until pay then nurse seat | Visible when seated (FIXED) or day-pinned OPEN after pay. Check-in and QR stay closed while `PENDING_PAY`. Red block **Ödəniş edilməyib** when a cabin is held |
| `HOLD_UNTIL_PAY` | Hidden | Not held. Planner runs after pay or folio | Hidden until the ticket |

Payment of a seated row does not search for a new slot. A batch pays the ticked rows. The cheque screen loads only after a room or a name, includes every matching unpaid extra from today forward, and does not show a procedure whose time is already before today. Cancelling one unpaid row cancels that procedure only. Cancelling one line of a printed multi-line cheque reverses only that amount and prints a three-copy storno. The other lines stay paid.

At clinic day end (`POST /api/cron/procedure-no-show-sweep`, after the no-show pass and only after tenant `dayEndHour` on the Baku calendar day), unpaid extras become `UNPAID_MISSED` in three passes (cabin freed when held; no folio charge, no bonus, no package quota):

1. **Today seated** — `resourceId` set and `scheduledAt` on today (`cancelReason` `unpaid_missed`).
2. **Overdue** — any `PENDING_PAY` with `scheduledAt` before today, seated or not (`unpaid_missed_overdue`).
3. **Unseated before today** — `resourceId` null and `createdAt` before today (`unpaid_missed_unseated`). `scheduledAt` is required on `ProcedureOrder`; the cheque list shows `—` when there is no cabin. Same-day unseated rows wait until the next evening or checkout.

Future-dated seated rows stay. Checkout / guest departed / walk-in episode close still closes **every** remaining unpaid extra on that episode (`unpaid_checkout`), including unseated — no `resourceId` filter. This is not `NO_SHOW`. Ops one-shot: `era-clinic/scripts/ops/purge-stale-pending-extras.mjs` (dry-run default; `--apply`).

Package lines and `XFER-` leftovers are not this setting. A paid extra that belongs to a package block shares that block's daily cap and does not burn quota. Money routing is unchanged: in-house with a reservation posts to the hotel folio; walk-in stays `PENDING_PAY` until the hotel accepts payment (`SettlementPendingCharge` with `revenueCode` from `revenueCodeForServiceLine`). A rejected charge does not seat an unseated row.

The print-language dialog uses three radio chips (Azerbaijani, Russian, English). The selected language still opens the print URL with `lang` and `autoprint=1`.

## Consequences

Admin → Settings saves the route. Existing `SHOW_ON_PLAN` rows read as plan-before-pay. HOT-06 and CLI-57 stay SCREEN, not SHIPPED. The nurse board lists a seated `PENDING_PAY` row and does not check it in.
