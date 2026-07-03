# Integration audit CI

Living static audits for MDM identity, reference-data boundaries, and data-model integration compliance.

## Commands

```bash
# Human-readable report (all audits)
npm run audit:integration

# CI gate — baseline-aware (empty baseline = strict)
npm run audit:integration:ci

# Fail on any issue (post W1–W4)
npm run audit:integration:strict

# Refresh AUTO sections in living docs
npm run audit:integration:refresh-docs
```

Individual scripts (also invoked by the runner):

```bash
node scripts/audit-data-model-integration.mjs [--json]
node scripts/audit-mdm-identity.mjs [--json]
node scripts/audit-reference-data.mjs [--json]
node scripts/run-integration-audits.mjs --only data-model,reference
node scripts/refresh-integration-audit-docs.mjs [--write]
```

## CI wiring

| Workflow | Step | Mode |
|----------|------|------|
| `.github/workflows/ci.yml` → `packages` | `run-integration-audits.mjs --strict` | Required on every PR |
| `.github/workflows/nightly-smoke.yml` | `--strict` | Nightly regression |

## Baseline policy

File: [`scripts/audit-baselines/integration-audit.baseline.json`](../scripts/audit-baselines/integration-audit.baseline.json)

| Mode | Behaviour |
|------|-----------|
| `--ci` | Fail on issues **not** in baseline; warn when baselined issue is fixed |
| `--strict` | Fail on any issue |
| `--update-baseline` | Rewrite baseline from current scan (maintainer PR only) |

**Matching key:** `{code}:{app}` or `{code}:{file}` for route-level rules.

After W1–W4 completion the baseline is **empty** and CI uses `--strict`.

## Issue codes

| Code | Domain | Meaning |
|------|--------|---------|
| `PII_DUPLICATE` | MDM | Plaintext FIN/passport + `globalPersonId` on same Prisma model |
| `GUEST_IDENTITY_COLUMNS` | MDM | Hotel `Guest` still has dropped identity columns |
| `MDM_LOOKUP_ONLY` | MDM | App uses lookup without link/resolve |
| `MDM_LOOKUP_ONLY_ROUTE` | MDM | POST/PATCH route lookup-only |
| `DATA_HUB_DIRECT` | REFERENCE | Industry app references hub URL or `/registry/v1` |
| `DATA_HUB_MIXED` | REFERENCE | Hub direct + Finance catalog handoff in same app |
| `FINANCE_CATALOG_HANDOFF` | REFERENCE | Industry calls Finance API for FX/VÖEN/calendar |
| `PLATFORM_CATALOG_REQUIRED` | REFERENCE | Legacy paths without platform-catalog delegation |
| `WORKFORCE_DUAL_PATH` | WORKFORCE | Clinic legacy hire path (`local_master`/`finance_hr` or practitioner POST create) |
| `WORKFORCE_V3_PUBLISHER` | WORKFORCE | Finance `employees.service` still emits `STAFF_PROVISIONED` |
| `WORKFORCE_PII_LEAK` | MDM | CP WorkforceEmployment/Absence has plaintext PII columns |
| `FINANCE_EMPLOYEE_ID_MISSING` | WORKFORCE | Clinic Practitioner missing `financeEmployeeId` |

## PR checklist

- [ ] `npm run audit:integration:strict` green
- [ ] If fixing a baselined issue → shrink baseline in the same PR
- [ ] New integration pattern → ADR + no new audit issues
- [ ] Schema/boundary change → update living docs (`refresh-integration-audit-docs.mjs --write`)

## Wave burn-down (completed)

| Wave | Baseline removed | Strict check |
|------|------------------|--------------|
| W1 | `PII_DUPLICATE` clinic | Clinic identity columns dropped |
| W2 | `DATA_HUB_*` industry | Platform catalog gateway |
| W3 | `WORKFORCE_DUAL_PATH` | v3 CP-only hire; clinic POST practitioners 403 |
| W4 | `PII_DUPLICATE` / `GUEST_IDENTITY_COLUMNS` hotel | Guest identity DROP |
| **v3** | `WORKFORCE_V3_PUBLISHER`, legacy hire strings | Plan E clean cutover |

**W5 exit:** empty baseline + `--strict` green on `dev`.

## R1 periodic re-audit

Full layer pass (L4–L6 manual + UAT) — see [audit-snapshots/r1-delta-2026-06-16.md](./audit-snapshots/r1-delta-2026-06-16.md).

```bash
node scripts/audit-layer-coverage.mjs [--app era-clinic] [--json]
```
