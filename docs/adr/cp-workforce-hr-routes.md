# ADR: Workforce HR routes, cadre, and calendar norms

**Status:** Accepted  
**Date:** 2026-10-13  
**Related:** [cp-workforce-pii-tiers.md](./cp-workforce-pii-tiers.md), [cp-workforce-absence-split.md](./cp-workforce-absence-split.md), [asia-baku-clock.md](./asia-baku-clock.md)

## Context

Nafta HR asked for surname-first names and a full FIN on the employee list, identity-document fields, a contract end date, clearer leave and advance approval, and a timesheet that shows the production calendar and an hour norm. Ştat cədvəli and the timesheet month filter already exist and are not rebuilt here.

Approval must not be stored as a person's surname. Weekly hour numbers are an organization setting. The production calendar is data-hub `CalendarDay`, not MDM.

## Decision

1. **List display.** The employment list formats the name as surname, given name, patronymic. MDM keeps given name, patronymic, surname. “oğlu” / “qızı” stay inside the patronymic. The list returns the full FIN and writes one `WORKFORCE_HR_FIN_LIST` access log per batch. Default CSV export still has no FIN. Other screens keep the masked identifier.

2. **Documents.** ID card and passport (series, number, issuer, issued date, expiry, passport issuing country) live in MDM `PersonIdentityDocument`, ciphered. They are not columns on `WorkforceEmployment`. An empty save deletes that kind.

3. **Cadre.** `contractEndDate` null means open-ended. `workRegime` is `FIVE_DAY`, `SIX_DAY`, `MEDICAL`, or `CUSTOM`.

4. **Hour norm.** `WorkforceOrgSettings` stores weekly hours per regime. Empty means the timesheet shows fact hours and does not invent a norm. When hours are set, the month norm is working days for that regime times (weekly hours / days per week). Five-day, medical, and custom use five days; six-day counts Saturday unless the calendar says holiday, mourning, or transferred rest. Day types come from data-hub `CatalogGatewayService.getCalendarDaysRange("AZ", …)`. Saturday and Sunday are only the fallback when the hub has no row.

5. **Routes.** Per request kind (`FULL_DAY`, `HOURLY`, `ADVANCE`, `VACATION`), steps are `REQUESTER_MANAGER` (walk up when the requester is the unit manager or the unit has no manager), `ORG_UNIT_HEAD`, or `POSITION_IN_UNIT`. No configured route keeps the previous behavior: any user with the existing permission may approve. A configured step with nobody to assign returns `APPROVAL_STEP_UNASSIGNED`. The wrong person gets `APPROVAL_STEP_FORBIDDEN`. Reject with a reason returns the request to the requester. History stays in `WorkforceApprovalDecision`.

6. **Advances.** Percent of salary, max amount, max open advances, and an HR-proxy flag are org settings with empty defaults (empty = no limit, proxy off). A percent cap uses the Finance employment mirror salary. If the percent is set and salary is unknown, the API throws `ADVANCE_SALARY_UNKNOWN`.

7. **After approval.** An approved absence is not overwritten. Correction creates a new `SUBMITTED` row (`correctionOfId`). When that row is finally approved, the original becomes `SUPERSEDED`. Cancel is a separate action with a reason and unlocks the timesheet. A vacation plan cannot have a second row for the same unit and year, so correction snapshots the lines and returns the plan to `DRAFT`. Cancel sets `CANCELLED`.

## Addendum (2026-10-14)

1. **Card and Excel.** The employment card shows contract gross and the last posted payslip net, both read from Finance when the card opens. Gross is `Employee.salary` (tariff plus supplement). Net is the latest posted payslip, walking back at most six Baku months; it stays empty until a payslip is posted. Neither number is stored on `WorkforceEmployment`. The one-way Excel (`GET …/export/cadre`) has SAA, birth date, FIN, ID series and number, position, department, hire date, contract end, gross, and net. Each file writes `WORKFORCE_HR_FIN_LIST` and `WORKFORCE_HR_ID_EXPORT`. CSV roster export is unchanged and still has no FIN.

2. **Vacation readout.** The absence screen shows the work year that contains the start date, computed from `hireDate`. Remaining days are `vacationDaysBalance` from the Finance mirror. Control plane does not keep a second balance. Approved vacation still reaches Finance by the existing event.

3. **Routes.** A position has a leadership flag. Each step has an audience `ALWAYS`, `LEADERSHIP`, or `ORDINARY` (existing steps stay `ALWAYS`) and, for advances, `canExceedAdvanceCap`. Steps that do not match the requester's position are skipped. An amount above the percent cap is accepted only when an applicable step has that flag; otherwise the API returns `ADVANCE_PERCENT_LIMIT`. The absolute amount cap and the open-count cap stay hard. Submit sources are three settings: employee self (default on), unit manager (default off, `POST …/requests/on-behalf`), and HR proxy (unchanged). The advance pay day is an org setting. If that calendar day is non-working, `plannedPayDate` moves to the previous working day (data-hub, Saturday/Sunday only as fallback). Finance still pays; the control plane only stores the planned date. Each request shows the subject, who entered it (`submittedByUserId`, resolved to an employment name or “HR”), and the decision history.

4. **Hours and tariff.** A position stores `tariffAzn`, `defaultWorkRegime`, and `weeklyHours`, including vacant slots. Those fields are copied into `StaffScheduleRevision.snapshotJson`. An employment `workRegime` is set only when it differs from the position. Resolution is employment regime, else position regime. Weekly hours are the position hours, else the org hours for that regime. If the regime is unresolved, the hour norm stays null. The timesheet row shows fact, norm, and the difference. Under the day letter, a short shift code is shown only when the existing roster plan resolves a shift for that person and day.

## Consequences

- Coverage `CP-WF-HR-01` is API until a UI UAT-SMOKE pass. Ştat and the month filter are unchanged.
- Nafta opening numbers are not loaded in this wave. The cadre Excel is one-way.
- Calendar-day count is the number shown on absences. Working-day leave math is a later choice.
