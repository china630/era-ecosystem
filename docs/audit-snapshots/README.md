# Audit snapshots

Archived JSON and delta reports from periodic integration re-audits (R1, quarterly).

## Policy

| Artifact | When | Path pattern |
|----------|------|--------------|
| Data-model JSON | After each R1 Phase 1 | `data-model-YYYY-MM-DD.json` |
| Delta report | End of R1 pass | `r1-delta-YYYY-MM-DD.md` |
| Nafta appendix | When pilot on critical path | `r1-nafta.md` |
| Automated logs | R1 Phase 1 (gitignored) | `tmp/r1-*.log`, `tmp/r1-*.json` |

## Baseline reference

| Snapshot | Issues | Notes |
|----------|--------|-------|
| Pre-remediation (2026-06-16 v1 doc) | 8 | PII clinic/hotel, DATA_HUB_MIXED × 6 — see [r1-delta-2026-06-16.md](./r1-delta-2026-06-16.md) |
| Post W1–W5 (2026-06-16 R1) | **0** | [`data-model-2026-06-16.json`](./data-model-2026-06-16.json) |

## Commands

```bash
npm run audit:integration:strict
node scripts/audit-data-model-integration.mjs --json > docs/audit-snapshots/data-model-$(date +%Y-%m-%d).json
node scripts/refresh-integration-audit-docs.mjs --write
```

## CI

Continuous gate: [INTEGRATION_AUDIT_CI.md](../INTEGRATION_AUDIT_CI.md) — `run-integration-audits.mjs --strict` on every PR.

R1 = deep pass (L4–L6 manual + UAT + doc cross-walk); W5 = L1–L2 static automation.
