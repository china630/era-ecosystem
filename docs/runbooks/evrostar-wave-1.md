# Evrostar Wave 1 — timesheet + official payroll (day-1 money)

**Pilot:** Evrostar / Evrostar Group (two VÖEN).  
**Depends on:** [evrostar-wave-0.md](./evrostar-wave-0.md) (Employee mirror + `financeEmployeeId` write-back).  
**Canon:** [evrostar-workforce-pilot.md](../adr/evrostar-workforce-pilot.md) §6 wave 1.  
**Out of scope:** shift roster, FaceID, MGMT/internal rate, order templates, ƏMAS.

---

## Preconditions (each org)

| Piece | Requirement |
|-------|-------------|
| Wave 0 | Two STANDALONE + Holding; both scopes bootstrapped; `hr_full` + `platform_workforce(_pro)` + `nas` |
| Contract salary | ACTIVE Finance Employees have salary &gt; 0 (`POST /hr/employees/bulk-contract-salary` or employee card) |
| IBAN / bank | Employee bank details + org settlement account in Finance |
| Period | NAS month **open** until mark-paid (closed period → HTTP 423 on journals) |

---

## Per-org UAT script (run twice — A then B)

1. **Salaries:** bulk-set contract salary for ACTIVE staff (hire-mirror leaves `salary: 0`) via Finance **Employees → Import salaries (CSV)** (`employeeId,salary`) or `POST /hr/employees/bulk-contract-salary`. **P2:** UI reports `skipped` lines (`bad_uuid` / `salary_not_positive` / `too_few_columns`) — do not treat silent skip as success.
2. **CP timesheet** `/workspace/workforce/timesheets`:
   - Autofill (chunked; pagination ~40 rows) → edits → Sync absences → **Approve month**.
   - Expect: CP read-only; Finance timesheet header **APPROVED**; cells mirrored (WORK/VACATION/OFF/…).
3. **Payroll draft** with `timesheetId` (not blind full pay):
   - VACATION/OFF reduce base via `summarizeForPayroll`.
   - Without salary → `400 CONTRACT_SALARY_REQUIRED`.
4. **POSTED** → create salary registry → send → **mark-paid**.
5. Expect NAS journals **721 / 533 / 521** on default ops book.
6. Download **ABB XML** (if bank name contains `abb`) or **UNIVERSAL_XLSX**.
7. Repeat for org B same YYYY-MM — employees and runs must not mix.

### Negatives

| Case | Expected |
|------|----------|
| Approve empty CP month | 400 |
| Payroll draft with salary 0 | 400 `CONTRACT_SALARY_REQUIRED` |
| Re-approve CP month | 409 |
| Finance UI timesheet edit with `platform_workforce` | 409 `TIMESHEET_MASTER_IS_CP` |
| Mark-paid after NAS period close | 400/423 |
| Holding single payroll | Forbidden — one run per `organizationId` |

---

## Bank credentials risk (out of wave 1)

`ABB_USERNAME` / `ABB_PASSWORD` are **process env**, not per-VÖEN.  
If Evrostar and Evrostar Group need distinct ABB corporate logins, that is a later platform change. For UAT: use **UNIVERSAL_XLSX** always, or one shared ABB login for both orgs.

---

## Coverage honesty

`CP-WF-TS-01` / payroll UI stay **not SHIPPED** without Lab RT. Do not set edition `ga`.

---

## Related

- Integration: [INTEGRATION_SSO_EVENTS.md](../INTEGRATION_SSO_EVENTS.md) — `WORKFORCE_TIMESHEET_APPROVED` → Finance APPROVED header
- Wave 0 runbook: [evrostar-wave-0.md](./evrostar-wave-0.md)
