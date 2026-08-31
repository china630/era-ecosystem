# ADR: Control-plane workforce PII tiers (T1–T4)

**Status:** Accepted (ERA v3 Plan D)  
**Date:** 2026-06-16  
**Related:** [era-mdm-natural-person-identity.md](./era-mdm-natural-person-identity.md), [workforce-identity-and-hr-provisioning.md](./workforce-identity-and-hr-provisioning.md), [hotel-guest-pii-ops-cache.md](./hotel-guest-pii-ops-cache.md), [mdm-phase2-person-access-consent.md](./mdm-phase2-person-access-consent.md)

## Context

Workforce hire/list UX (Plans A–C) needs person display without duplicating FIN/name across CP, Finance, and satellites. Finance `Employee` historically stored plaintext `firstName`, `lastName`, and `finCode` alongside `globalPersonId` — a **PII_DUPLICATE** risk.

## Decision

Four tiers for workforce identity:

| Tier | Name | Store | Master for |
|------|------|-------|------------|
| **T1** | MDM vault | `era_mdm` — cipher identifiers, name cipher | Person identity |
| **T2** | CP employment | orchestrator CP DB — `globalPersonId` only + org/position refs | Hire, absence, role bindings |
| **T3** | Ops cache | satellite DB — `fullName`, login, optional phone | Reception/POS screen speed |
| **T4** | Payroll extension | finance DB — salary, tax, `cpEmploymentId`; **no plaintext FIN/name** | Payroll / GL / ƏMAS calc |

### Rules

1. Identifier values (FIN, passport) — **only MDM**; never on CP `WorkforceEmployment` / `WorkforceAbsence`; never plaintext on Finance `Employee`.
2. CP workforce UI lists use `POST /internal/v1/mdm/persons/ops-profile/batch` (**HTTP max 100 ids**, one `WORKFORCE_OPS_PROFILE_BATCH` access log per call). Server-side list/export (`batchGetPersonOpsProfile`) **chunks by 100** so a roster larger than 100 still gets display names — do not show `globalPersonId` prefixes in pickers.
3. Hire intake uses `POST /internal/v1/mdm/persons/workforce-resolve` → `globalPersonId` before CP employment persist.
4. `STAFF_PROVISIONED.payload.fullName` is a **T3 display stamp only** (from MDM at provision time); not authoritative.
5. Finance Employee create/update rejects body fields `finCode`, `firstName`, `lastName`, `passportNumber`; list/get enrich via MDM batch on the server.
6. `PersonAccessGrant` workforce stub created on hire (`WORKFORCE_EMPLOYMENT` relationship).
7. **HR extended profile (Aktiv list):** blood group, statistical categories, addresses, marital status, education, specialty, photo — live in MDM `PersonHrProfile` / `PersonAddress` only; Finance `GET /hr/reports/active-list` is **read-through** via `batchHrProfiles` / ops-profile — never persisted on `Employee`.

## Consequences

- Finance person card is read-only MDM read-through; payroll modals show MDM banner.
- Audit script flags `WORKFORCE_PII_LEAK` on CP workforce models and `PII_DUPLICATE` on Finance Employee plaintext columns.
- Satellite staff models must not add `finCode` / `passportNumber` columns (T3 ops cache only).
- Related: [cp-personnel-orders.md](./cp-personnel-orders.md) (orders/ştat in CP, not Finance).

## API surface

| Endpoint | Purpose |
|----------|---------|
| `POST /internal/v1/mdm/persons/ops-profile/batch` | Workforce table display |
| `POST /internal/v1/mdm/persons/workforce-resolve` | Hire FIN/passport intake |
| `POST /api/platform/mdm/workforce/*` (orch web BFF) | Browser-safe proxy (JWT + service token; `organizationId` query) |
| `GET /v1/admin/mdm/persons` | Super-admin paginated directory (decrypt for operators) |
| `POST /api/hr/employees/resolve-person` (finance) | Payroll hire MDM lookup |

## Compliance export

Full FIN for ƏMAS / bank export uses existing `compliance-identity` at export time with grant — not stored on Finance Employee.
