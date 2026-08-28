# HOT-06 lab signoff (SaaS Wave 6)

**Scope:** Elektraweb dual-run lab — Super-Admin per-org policy, clinic Issue-ticket, hotel outbox org stamp / write gate  
**Does not claim:** HOT-06 **SHIPPED**, edition `ga`, field SPA Insert production cert

## Lab checklist (CI)

| Step | Result | Notes |
|------|--------|-------|
| Hotel `__tests__/saas-wave6-hot06-lab.spec.ts` | pass | HOTELID/org isolation, writeEnabled + kill switch, ALS stamp |
| Clinic `__tests__/saas-wave6-hot06-lab.spec.ts` | pass | dual-run policy row, hotelOrganizationId required |
| Wave 1 bridge schema (`saas-wave1-tenant-bridge`) | pass | outbox body org required |

### Lab UI paths (manual — documented)

| Surface | Path | Lab check |
|---------|------|-----------|
| Super-Admin EW / cutover policy | orch `/super-admin/orgs/{id}` hub | save policy → Sync upserts hotel/clinic rows |
| Clinic Issue ticket | `/reception/extra-tickets` | Issue → print; outbox body carries hotel `organizationId` |
| Hotel outbox / health | bridge health + drain | writeEnabled off → no drain; kill switch off → refuse |

### Lab signoff

- Runner: CI / Wave 6 agent
- Date: 2026-08-28
- Verdict: **lab passed** (CI suites). Super-Admin policy + clinic Issue-ticket → **SHOW** on UI board. Extension SPA Insert remains **HEADLESS** / field-open. **Not SHIPPED**.

## Field

Step-by-step desk runbook: [`reports/hot06-field-runbook.md`](./hot06-field-runbook.md). Do **not** mark HOT-06 SHIPPED until that field checklist is filled pass.
