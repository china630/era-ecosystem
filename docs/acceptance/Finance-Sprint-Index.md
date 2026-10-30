# Finance — Sprint / Wave Index

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness:** [`Finance-Product-Readiness-Matrix.md`](./Finance-Product-Readiness-Matrix.md)  
**AC Matrix:** [`Finance-Implementation-Matrix.md`](./Finance-Implementation-Matrix.md)

Header honesty = **Product Readiness** rollup (not «all ✅»).  
Current rollup: Gate ✅ · BE ✅ · UI 🟡 · Demo ❌ · Sell: do not claim GA — many FIN-* API-only

---

## Wave board

| Wave | Gate | AC rollup (from Matrix) | Pilot-ready | Notes / log |
|------|------|-------------------------|-------------|-------------|
| W0 baseline | gate[x] | ✅ | [ ] | `reports/finance-stage-W0-signoff.md` scaffold-gate-pass |
| W6 Green BE | gate[x] | ✅ | [ ] | `reports/finance-be-negative-signoff.md` + `fin-*-negative.spec.ts` |
| W1 honesty | gate[ ] | ✅ | [ ] | Close UI/Demo residuals; UAT lab signoff |

## Backlog

| ID | Item | Status | Proof |
|----|------|--------|-------|
| S-1 | Stage-gate script green + signoff | [~] | `scripts/run-finance-stage-gate.mjs` |
| S-2 | Pilot lab UAT-SMOKE signed | [ ] | `era-finance-core/doc/UAT-SMOKE.md`; payroll depth UAT pending |
| S-3 | Field / customer sign-off | [ ] | — |
| S-4 | Green Scaffold BE Wave 6 negatives | [x] | `reports/finance-be-negative-signoff.md` |
| S-5 | Manual adjusting journal (əl ilə tənzimləmə) | [x] | ADR + `/accounting/adjustments`; negatives in `fin-gl-negative.spec.ts`; lab RT still S-2 |
| S-6 | Adjustments wave 2 (invoice credit, FA donation, basis link) | [x] | `credit-adjustment`, `DONATION`, `basisFixedAssetId`; UAT-SMOKE § wave 2 |
| S-7 | Invoice extra fields W1 | [~] | ADR Accepted; `/settings/extra-fields`; JSONB on Invoice; FIN-EXT-01 API |
| S-8 | Invoice saved views W2 | [~] | ADR W2; `/sales/invoices` class A + `saved-list-views`; FIN-VIEW-01 API |
| S-9 | Commercial invoice print W3 | [~] | ADR W3; print-snapshot + `/print/invoice/:id` + placeholders catalog; FIN-PRINT-01 API |
| S-10 | Finance Wave 5 CP grant doors | [~] | ADR finance-domain-permissions; FIN-RBAC-01 SCREEN; AC-FIN-RBAC 🟡 out of BE rollup; UAT-SMOKE § FIN-RBAC-01 — not SHOW |
| S-11 | Dated tax scheme + simplified-tax watcher | [~] | ADR finance-tax-scheme; FIN-TAX-SCHEME-01 API; AC-FIN-TAX-SCHEME 🟡 out of W6; guest card payment and card deposit refund with no company VÖEN are tagged; package upserts the same statutory row; not SHOW |
| S-12 | e-qaimə day-close rule | [~] | ADR finance-tax-scheme; FIN-EQAIME-DAY-01 API; AC-FIN-EQAIME-DAY 🟡 out of W6; FIN-EQAIME-01 stays STUB/API; not SHOW |
| S-13 | Fact queue on month close | [~] | ADR finance-per-book-period-close; FIN-FACT-QUEUE-01 API; AC-FIN-FACT-QUEUE 🟡 out of W6; period-lock uses the same refusal; does not extend AC-FIN-GL; not SHOW |
| S-14 | Provisional VAT and filed-period amendment | [~] | ADR finance-tax-scheme; FIN-PROVISIONAL-VAT-01 API; AC-FIN-PROVISIONAL-VAT 🟡 out of W6; whole purchase stays in expense until the document; recalc reads the scheme and the saved amount; invoice rate comes from the scheme; period-lock uses the same refusal; no cash refund; does not extend AC-FIN-TAX; not SHOW |
| S-15 | Mutation audit ecosystem align (deny-list / redaction kit + journal UI) | [~] | FIN-AUD-01 COVERAGE SHIPPED; Wave C kit-align + Wave D `/admin/audit` + OWNER `/admin/security-audit` CatalogField/EraListFilterBar/DatePicker 2026-10-29; AC-FIN-AUD 🟡 AuthZ negatives residual; Nest industry cutover is separate P0 debt; Gate/Pilot/edition unchanged |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
