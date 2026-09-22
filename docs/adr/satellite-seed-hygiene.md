# ADR: Satellite seed hygiene

**Status:** Accepted — 2026-09-22  
**Apps:** all industry satellites + bank CBS (`era-hotel-pms`, `era-fnb-pos`, `era-bank-core`, `era-bank`, `era-bank-dbo`, thin satellites)  
**Related:** [clinic-catalog-template-overlay.md](./clinic-catalog-template-overlay.md) · [satellite-organization-bind.md](./satellite-organization-bind.md) · [deployment-topology.md](./deployment-topology.md)

## Context

Satellite `npm run db:seed` was overloaded: hotel wiped ops tables then loaded Nafta demo; F&B created waiter/outlet; bank/core/dbo defaulted `RUN_SEED=true` and fell back to `demo-org` / `demo-bank-org-001`; DBO rotated a demo Open API key on every recreate. That fights org bind / Connect and invents ghost tenants on droplet.

Clinic already split satellite templates vs org overlay ([clinic-catalog-template-overlay.md](./clinic-catalog-template-overlay.md)). This ADR extends the **same data law** to other satellites without hotel/fnb catalog template schema.

## Decision

1. **`db:seed`** = satellite / reference / role templates only — idempotent, insert-if-missing where org-stamped, never wipe. No `demo-org`, `demo-clinic-org`, or `demo-bank-org-001` fallback. Missing bind → exit 1 (or empty no-op when the schema has no unscoped catalog, e.g. F&B).

2. **`db:seed:demo`** = wipe and/or lab users/outlets/demo API keys. Manual only. Never compose entrypoint.

3. **Compose `RUN_SEED`** defaults **false** for clinic, hotel (standalone), bank-core, bank, bank-dbo. First empty lab: set `*_RUN_SEED=true` **once** after a real org UUID is bound, or run `db:seed:demo` on the host.

4. **Org identity** comes from orch bind / `ERA_SATELLITE_ORGANIZATION_ID` / `ERA_BANK_ORGANIZATION_ID` — never invent from compose defaults.

5. **PSA scripts** (`upsert-ecosystem-demo-user.ts`) — exit 1 without a real org; not entrypoint.

6. **Lint** — `npm run lint:satellite-seed-org` bans forbidden demo org string fallbacks in seed scripts (quality gates).

## Droplet

Before recreating bank-core / bank / bank-dbo after this image wave, set GitHub `ENV_FILE` (or droplet `.env`):

```bash
BANK_CORE_RUN_SEED=false
BANK_RUN_SEED=false
BANK_DBO_RUN_SEED=false
```

Then recreate those three services (not postgres). Smoke: DBO login with existing keys; no new `dbo-demo-api-key` rotation.

## Consequences

- Empty lab needs explicit `:demo` or one-shot `RUN_SEED=true` after bind.  
- Hotel `db:seed` = reference insert-if-missing; wipe is `db:seed:demo`.  
- Bank-core GL/product factory seed still needs a real `ERA_BANK_ORGANIZATION_ID`; demo customers/treasury need `--demo`.  
- Acceptance: no SHIPPED/ga change from this hygiene alone.
