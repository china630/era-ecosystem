---
name: era-readiness-matrix
description: Refresh ERA readiness matrix from DELIVERY checkboxes and code-level API levels. Use when the user asks to update READINESS_MATRIX, refresh readiness, or after a platform/satellite delivery wave.
---

# ERA readiness matrix refresh

> **Disclaimer:** This skill updates **engineering** [`docs/READINESS_MATRIX.md`](docs/READINESS_MATRIX.md) (API levels, DELIVERY %, consumer hooks).  
> For **sell / show / pilot / Product Readiness** use skill `acceptance-closeout` and `docs/acceptance/*-Product-Readiness-Matrix.md` — not this skill.

## Triggers

- «обнови матрицу готовности API» / «обнови READINESS_MATRIX» / consumer hooks
- `READINESS_MATRIX.md`
- `refresh readiness matrix` (engineering)
- After completing a DELIVERY wave (platform CP-B*, satellite hooks)

**Not for:** «можно продавать?» / Product Readiness / edition `ga` → `acceptance-closeout`.

## Steps

1. Run aggregate DELIVERY counts:
   ```bash
   node scripts/delivery-readiness.mjs
   node scripts/readiness-strict-delivery.mjs
   ```
2. Update [docs/COVERAGE_MATRIX.md](docs/COVERAGE_MATRIX.md) actor rows for touched capabilities (CLI-*, HOT-*, etc.).
3. Run cross-app coverage (§4.1 / §4.2 source):
   ```bash
   node scripts/readiness-coverage.mjs
   node scripts/readiness-coverage.mjs --consumer-only
   ```
   Paste or reconcile generated tables into [docs/READINESS_MATRIX.md](docs/READINESS_MATRIX.md) §4 (consumer % + all-apps %; legend ✓ / H / N/A).
3. Open [docs/READINESS_MATRIX.md](docs/READINESS_MATRIX.md) and update:
   - **§1** table rows and aggregate line from step 1
   - **§2.2** billing (host vs consumer, three sub-tables)
   - **§2.3** platform add-on levels (Impl / Live / MVP / Stub) per app column
   - **§3** satellite integration row if hooks changed
   - **§4** from step 2 (split loyalty / domains / delivery rows)
   - **§7** link to COVERAGE_MATRIX; strict DELIVERY % from step 1
   - `Last updated` to today (YYYY-MM-DD)
4. If umbrella docs drifted, sync [PLATFORM_ADDONS.md](docs/PLATFORM_ADDONS.md), [MODULES_CATALOG.md](docs/MODULES_CATALOG.md), [NAFTA_DOC_API_UI_AUDIT.md](docs/NAFTA_DOC_API_UI_AUDIT.md) when Nafta stack touched.
5. Report delta: DELIVERY aggregate %, **strict SHIPPED %**, COVERAGE_MATRIX changes, open items (CP2, SP5).
6. Integration audits (W5):
   ```bash
   npm run audit:integration:strict
   node scripts/refresh-integration-audit-docs.mjs --write
   ```
   See [INTEGRATION_AUDIT_CI.md](docs/INTEGRATION_AUDIT_CI.md).

## Rules

- DELIVERY % ≠ production readiness; **strict %** excludes `[~]`/`[s]`/`[h]` tags.
- SHIPPED requires COVERAGE_MATRIX actor UI columns — see [era-coverage-definition.mdc](../../rules/era-coverage-definition.mdc).
- §4 consumer hooks: grep must find **calling** `create*` (not re-export only). Fin is N/A for booking/portal/loyalty/domains/delivery. Hotel↔FB bridge = **2/2 roles**, not 2/11 apps.
- Do not edit `.cursor/plans/*` unless asked.
- 13 ingress event types: `@era/contracts` → Finance `SatelliteEventDispatchService`.