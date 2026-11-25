# ADR — Pension, PSA, and multi-entity catalog depth (P2-9)

**Status:** Accepted  
**Date:** 2026-11-25  
**Related:** [bank-multi-entity-holding.md](./bank-multi-entity-holding.md) · Inventory `CAP-PEN`, `CAP-PSA`, `CAP-CORE-MENT`

## Context

Roadmap wave XO-5/XO-6 added lab modules (`banking_pension`, `banking_psa`, `multi-entity`) with thin services (≈1–3 KB). Capability Inventory historically marked them **IN**, which overstates sellable depth.

## Decision

1. **Keep modules in the catalog** as **SCAFFOLD** — do not remove Prisma models or API routes in this wave.
2. **Do not sell or demo** pension agency, public-sector TSA (PSA), or multi-entity holding as production capabilities until each has UAT-SMOKE depth, tests, and applicable YC-E / regulatory evidence.
3. **Owner option:** modules may be **dropped from commercial SKUs** later without deleting code; any drop requires Inventory OUT/DECLARED update + edition yaml change in the same PR.

## Consequences

- Product Readiness rollup for specialized lines stays below core CASA/lending until depth lands.
- Pension / PSA / multi-entity remain engineering scaffolds; honest status in [Bank-Capability-Inventory.md](../../acceptance/Bank-Capability-Inventory.md).