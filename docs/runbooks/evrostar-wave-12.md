# Evrostar Wave 12 — Employee phone cabinet

**ADR:** [cp-workforce-floor-attendance.md](../adr/cp-workforce-floor-attendance.md) decisions 5, 6, 9  
**Capability:** `CP-WF-SELF-01` (**API**, not SHIPPED)

## Goal

Signed-in employment cabinet at `/workspace/me`: own leave requests, announcements with read receipts, and a posted payslip read. No payments, no other people’s cards, no HR sidebar for `WORKFORCE_SELF`.

## Auth

- Permission `api:workforce.self` + `screen:workspace.me`.
- Bound via `WorkforceEmployment.platformUserId`.
- HR enables with `POST …/employments/:id/enable-cabinet` (`loginEmail` required when creating the user). Creates org role `WORKFORCE_SELF` (not OWNER / HR_MANAGER). Satellite PIN `0000` is not the orch password.
- Two VÖEN → multiple employments for one user; cabinet switches org.

## Requests

| Kind | Behavior |
|------|----------|
| Full-day | Existing `WorkforceAbsence` created `SUBMITTED`; HR approves as today |
| Hourly | `WorkforceHourlyLeaveRequest`; approve writes `hourlyLeaveMinutes` (+ `hourlyLeavePaid`) on **DRAFT** cell only. Paid and unpaid cannot share one day. Attendance rebuild keeps those minutes |
| Late note | Journal `NOTE` on own today’s `IN` punch; does not change `occurredAt` |
| Advance | `WorkforceAdvanceRequest`; approve writes `ADVANCE` on an existing DRAFT slip (net reduced) or `PayrollAdvanceHold`. The next draft consumes this month and earlier holds that still fit in `net`. A hold that would make `net` negative stays queued. Never POSTED / cash |

HR queue: `/workspace/workforce/requests`. Floor board shows `PENDING_REQUEST`.

## Payslip

Internal Finance `GET /internal/v1/workforce/payroll/payslip` — status `POSTED` only, no `internalRate`. Hidden when `hr_full` off or month not posted.

## Evidence

Jest: `workforce-self.wave12.spec.ts`, Finance paid-hourly UNPAID_TIME case. COVERAGE Status=API until UAT-SMOKE.
