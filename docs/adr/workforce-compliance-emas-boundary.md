# ADR: Workforce compliance — ƏMAS / e-qaimé boundary

**Status:** Accepted (Plan F)  
**Date:** 2026-06-16

## Context

CP owns absence **workflow**; Finance owns payroll **calculation** and browser extension RPA for ƏMAS / e-qaimé.

## Decision

| Step | System |
|------|--------|
| Submit / approve absence | **CP** → `WORKFORCE_ABSENCE_APPROVED` |
| Payroll mirror + pay calc | **Finance** (`hr_full`) |
| Submit to ƏMAS portal | **Finance extension** (RPA) — reads mirror + `getEmasPrefill` |
| e-qaimé VAT invoice | **Finance extension** — separate flow |

**CP never** implements ƏMAS DOM RPA.

## Prefill (Plan F)

`GET /hr/employees/emas-prefill?cpEmploymentId=` — resolves Finance Employee mirror, includes latest synced absence window from CP mirror (`cpAbsenceId`).

Extension status: **STUB** until RPA UAT; CP absence workflow: **SHIPPED** (Plan A).
