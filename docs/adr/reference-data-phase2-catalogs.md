# ADR: Reference data Phase 2 catalogs (backlog)

## Status

Proposed — backlog only; **no SHIPPED tags** until API exists.

## Scope (from era-data-hub shelf)

| № | Catalog | Priority | Blocker |
|---|---------|----------|---------|
| 4–5 | GNS activity / tax service codes | P2 | ingest spec |
| 13 | Refinancing rate | P2 | CBAR feed |
| 14 | VAT payer registry | P2 | shelf C / legal |
| 15 | Min wage / subsistence | P2 | HR finance link |
| 18–20 | UN/LOCODE, customs posts, INCOTERMS | P3 | logistics enrichment |
| 24 | Sanctions OFAC/EU/UN | P3 | bank AML + legal sign-off |

## Unblock checklist (sanctions live ingest)

| Step | Owner | Done when |
|------|-------|-----------|
| Legal sign-off for OFAC/EU/UN list use | Compliance | ADR approved |
| data-hub shelf C `/registry/v1/sanctions/*` | Platform | API + ingest job |
| Bank cert track production gate | Bank | CERTIFICATION-TRACK §Sanctions |
| COVERAGE `BANK-SANC-LIVE` | Platform | Promote from BLOCKED |

**Current:** `era-bank-core` uses embedded `sanctions-seed.json` — COVERAGE `BANK-SANC-01` **STUB `[s]`** with ops UI `/aml/screen`.

## Rule

Phase 2 items are documented here only. COVERAGE_MATRIX rows appear when hub exposes `/registry/v1` routes and finance/bank consumers exist.
