# ADR: e-taxes live VÖEN — unblock checklist

## Status

Accepted — **BLOCKED** for production SHIPPED until external prerequisites met.

## Current state

- **DH-006** company registry: `era-data-hub` → Finance `voen-preview` handoff → industry `VoenLookupField` BFF.
- **Live e-taxes** HTTP (`TaxpayerIntegrationService`) exists in Finance but is **not** production-certified.

## Unblock checklist

| Step | Owner | Done when |
|------|-------|-----------|
| DVX / e-taxes API agreement or documented public endpoint ToS | Legal + Finance | Contract on file |
| Rate limits + circuit breaker (`ETAXES_LIVE_ENABLED`) | Finance API | Env + runbook |
| Prod credentials / IP allowlist | Ops | Secrets in vault |
| UAT with real VÖEN (non-prod) | QA | UAT-SMOKE §e-taxes live (manual) |
| COVERAGE `FC-DH-006-ETAXES` | Platform | Promote from BLOCKED only after above |

## Fallback chain (always)

1. `era-data-hub` `/companies/:voen`
2. Finance local `GlobalCompanyDirectory`
3. e-taxes live (when enabled)
4. Manual entry (degraded mode — audit log)

## References

- [reference-data-ecosystem.md](./reference-data-ecosystem.md)
- [REFERENCE_DATA_CONSUMER_AUDIT.md](../REFERENCE_DATA_CONSUMER_AUDIT.md)
