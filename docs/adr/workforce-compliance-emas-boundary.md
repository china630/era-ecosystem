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

Extension status: **STUB** until RPA UAT on live `emas.sosial.gov.az`; CP absence workflow: **SHIPPED** (Plan A).

## Evrostar wave 7 (2026-09-17)

Field path for Evrostar = **file + extension prefill**, not B2B S2S:

| Piece | Behavior |
|-------|----------|
| Org `settings.hr.emasMode` | `OFF` \| `SELECTIVE` \| `FULL` — per legal entity (two VÖEN = two settings) |
| Queue | `EmasContractEvent` **`PENDING_MANUAL`** on hire/terminate when mode allows — **no HTTP** |
| HR UI | `/hr/emas-queue` — prefill JSON, mark `SUBMITTED_MANUAL`, CSV, per-employment order deep-link; org settings `emasMode` |
| Extension | VOEN match (block if ERP taxId missing); contract `salaryGrossAzn` only; never `internalRate`; never auto-İmzala; shared `EMAS_FIELD_MAPPING_VERSION`; DOM miss → error |
| CP hire mirror | Sets `emasEligible` from MDM FIN (SELECTIVE-safe); FULL may return `emasFinWarning` |
| S2S | Still unconfigured → **503** until `EMAS_SUBMIT_URL` + DOST RIM contract (separate ADR) |

UAT-SMOKE: [era-finance-core/doc/UAT-SMOKE.md](../../era-finance-core/doc/UAT-SMOKE.md) § FIN-EMAS-01.  
Runbook: [evrostar-wave-7.md](../runbooks/evrostar-wave-7.md). Capability `FIN-EMAS-01` = **STUB** until live portal UAT — do not claim SHIPPED / `ga`.
