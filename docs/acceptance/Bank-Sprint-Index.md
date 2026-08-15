# Bank — Sprint / Wave Index

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness:** [`Bank-Product-Readiness-Matrix.md`](./Bank-Product-Readiness-Matrix.md)  
**AC Matrix:** [`Bank-Implementation-Matrix.md`](./Bank-Implementation-Matrix.md)

Header honesty = **Product Readiness** rollup (not «all ✅»).  
Current **line** rollup: Gate ✅ · BE ✅ · UI ✅ · Demo ✅ · Pilot lab [x] · Pilot field [ ] · edition `mvp` · Sell: Full commercial CBS (FC/XO lab done; YC-E adapters; field ⏸) · ≠ ga / ≠ pilot_ready  
**Module layers SSOT:** [`Bank-Product-Readiness-Matrix.md`](./Bank-Product-Readiness-Matrix.md) § Modules × layers.  
**Scope boundary:** [`Bank-Capability-Inventory.md`](./Bank-Capability-Inventory.md)

---

## Wave board

| Wave | Gate | AC rollup (from Matrix) | Pilot-ready | Notes / log |
|------|------|-------------------------|-------------|-------------|
| W0 baseline | gate[x] | ✅ | [ ] | `reports/bank-stage-W0-signoff.md` scaffold-gate-pass |
| YC-A0 honesty sync | gate[x] | ✅ | [ ] | `reports/bank-stage-A0-signoff.md` |
| YC-A1 kernel security | gate[x] | ✅ | [ ] | HMAC + EOD 423; AC-BNK-CORE ✅ |
| YC-A2 pay SoD UI | gate[x] | ✅ | [ ] | AC-BNK-PAY-APPR ✅ |
| YC-A3 dep/loan + pricing UI | gate[x] | ✅ | [ ] | AC-BNK-PAY ✅ (stub rails) |
| YC-A4 product factory | gate[x] | ✅ | [ ] | AC-BNK-PROD ✅ |
| YC-A5 risk lab | gate[x] | ✅ | [ ] | AC-BNK-RISK ✅ lab-only |
| YC-B1 ops modals | gate[x] | ✅ | [ ] | AC-BNK-OPS ✅ |
| YC-B2 risk capital + EOD | gate[x] | ✅ | [ ] | `/risk/capital` + EOD steps |
| YC-B3 DBO UI | gate[x] | ✅ | [ ] | ASAN stub badge + negatives |
| YC-C1 Bank TE | gate[x] | ✅ | [ ] | `reports/bank-te-demo-signoff.md` |
| YC-C2 DBO TE | gate[x] | ✅ | [ ] | `reports/bank-dbo-te-demo-signoff.md` |
| YC-D1 Pilot lab Bank | gate[x] | ✅ | [x] lab | `reports/bank-pilot-lab-signoff.md` |
| YC-D2 Pilot lab DBO | gate[x] | ✅ | [x] lab | `reports/bank-dbo-pilot-lab-signoff.md` |
| YC-F1–F4 hygiene | gate[x] | ✅ | [ ] | COVERAGE / MODULES / orch seed / i18n |
| YC-E1–E7 cert | gate[ ] | ✅ | [ ] | ⏸ until sandbox creds — CERTIFICATION-TRACK |
| UI-1…5 ops+DBO | gate[x] | ✅ | [x] lab | Cash/fees/SO; loans-deep/collections; trade; islamic/wealth/AML/3DS; TE+UAT line flip |

## Backlog

| ID | Item | Status | Proof |
|----|------|--------|-------|
| S-1 | Stage-gate script green + signoff | [x] | A0 + W0 signoffs |
| S-2 | Pilot lab UAT-SMOKE signed | [x] | bank + dbo pilot-lab signoffs (lab kit) |
| S-3 | Field / customer sign-off | [ ] | YC-E7 |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
