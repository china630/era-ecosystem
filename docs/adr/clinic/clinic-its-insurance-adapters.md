# Clinic ITS / DMS insurance adapters (MED-P1-03)

## Status

Accepted — scaffold 2026-11-25 (manual gateway default; API mode reserved).

## Context

Azerbaijan public insurance (ITS / e-Tabib) and commercial DMS require referral validation before visit billing routes to insurer receivables instead of patient cashier.

## Decision

- Persist `PatientInsurancePolicy`, `InsuranceReferral`, and optional `Visit.payerKind` + `Visit.referralId` in `era-clinic` with org-scoped Prisma.
- Integrate via `src/integration/its/manual-gateway.ts` with `CLINIC_ITS_GATEWAY=disabled|manual|api` (default `manual`).
- Staff registers referral codes; expiry defaults to +10 Baku calendar days from issue when not supplied.
- Finance eligibility (`POST /api/insurance/check`) remains; policies/referrals are clinic-native CRUD.
- Reimbursement register: `GET /api/reports/insurance` + `/reports/insurance` (SCREEN).

## Consequences

- No live e-Tabib API until credentials and ADR addendum ship.
- `REFERRAL_EXPIRED` / `ITS_DISABLED` return 409 from referral POST.
- Sell boundary still `clinic_insurance` module gate on policy/referral/report routes.

## Related

- [02-remediation-backlog.md](./02-remediation-backlog.md) MED-P1-03
- Capability rows `CLI-INS-ITS-01` in `docs/COVERAGE_MATRIX.md`