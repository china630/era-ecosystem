# ADR: Workforce packages (Essential / Professional / Premium)

**Status:** Accepted  
**Date:** 2026-10-05  
**Product:** Orchestrator control plane

## Context

`platform_workforce` opened every workforce screen. `platform_workforce_base` and `platform_workforce_pro` were price labels with the same feature set. Sales need a ladder: each step adds capabilities, one price per person.

## Decision

Three mutually exclusive package slugs. Any of them keeps the hub alias `platform_workforce`. Monthly price of the slug stays 0. The invoice line is headcount × package rate.

| Slug | Storefront | AZN / person | Opens |
|------|------------|--------------|--------|
| `platform_workforce_base` | Essential | 2 | Directory, org structure, positions, hire, security, import/export, satellite login |
| `platform_workforce_pro` | Professional | 4 | Essential + absences, vacation plans, shifts/roster, timesheet, plan/fact, employee cabinet |
| `platform_workforce_premium` | Premium | 6 | Professional + live floor, personnel orders, staff schedule, fitness files, group HR |

`hr_full` (Finance payroll) stays outside these packages.

A new toggle of `platform_workforce` alone is rewritten to Essential. A stored hub slug with no package also reads as Essential (new trials include `platform_workforce_base`). Organizations that already had the hub before this catalog are migrated to Premium so existing screens stay open. That migration has to land with this code: until it runs, those orgs see Essential.

API routes above Essential return `403 WORKFORCE_PACKAGE_REQUIRED`. The sidebar link for a locked screen points at `/pricing#<slug>`.

Punch ingest (`POST …/attendance/punches`) stays on the hub check. The floor screen is Premium.

## Consequences

- Canon: `pricing-catalog-canon.ts` (`WORKFORCE_XOR`, `workforceFeatureAllowed`, `workforceHeadcountRateAzn`).
- Referral commissions are unrelated; they sum every subscription invoice line for the referred organization.
