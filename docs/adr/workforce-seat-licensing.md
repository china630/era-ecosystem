# ADR: Workforce seat licensing (one person, one seat)

**Status:** Accepted (Plan F)  
**Date:** 2026-06-16

## Context

Hotel per-satellite seat count double-charged when CP provisions same person to hotel + clinic.

## Decision

| Actor | Counts toward seat? |
|-------|---------------------|
| CP-provisioned ops (`cpEmploymentId`) | **1 seat per `globalPersonId`** per `WorkforceScope` |
| SSO owner (`isCrossSystem=true`) | No |
| Manual satellite user create | Secondary guard via orchestrator API |

## Canonical API

| Method | Path |
|--------|------|
| POST | `/internal/v1/licensing/seats/check` |
| GET | `/platform/v1/workforce/seats/usage` |

Limit source: Super-admin **Billing → Quotas** `maxEmployees` for the org’s `currentTier` (`SystemConfig` / `getTierQuotas`), with compiled `TARIFF_TIER_LIMITS.maxUsers` as fallback. Org `quotaOverrides.maxEmployees` (or `employees`) wins when set. Registry: `WorkforceSeatAllocation`.

Satellites call orchestrator when `cpEmploymentId` / `globalPersonId` present; local count fallback when orchestrator URL unset.

## UI

Security Admin seats widget on `/workspace/workforce/security`.
