# Bank — Sprint / Wave Index

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness:** [`Bank-Product-Readiness-Matrix.md`](./Bank-Product-Readiness-Matrix.md)  
**AC Matrix:** [`Bank-Implementation-Matrix.md`](./Bank-Implementation-Matrix.md)

Header honesty = **Product Readiness** rollup (not «all ✅»).  
Current **line** rollup: Gate ✅ · BE ✅ · UI ✅ · Demo ✅ · Pilot lab [x] · Pilot field [ ] · edition `mvp` · Sell: Full commercial CBS (FC/XO lab done; YC-E adapters; field ⏸) · ≠ ga / ≠ pilot_ready  
**MFI meeting date (2026-11-26):** `/mfi` default is `todayBakuYmd`. SCREEN, not SHOW. AC-BNK-OPS stays Scaffold ✅. Gate / Pilot field / Sell / `bank.yaml` unchanged.  
**Posting lock (2026-11-26):** `FOR UPDATE` filters `organization_id`. AC-BNK-CORE stays Scaffold ✅. Gate / Pilot field / Sell / `bank.yaml` unchanged.  
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
| CBS-gap 2026-11 | gate[x] | 🟡 | [ ] | ADR pack + Inventory honesty; audit diamond + second-pass + **audit-v2 remediations** (concurrency test org lookup, ümidsiz WO, sanctions LAB label, CAP-DBO-OB→PARTIAL). SCREEN leasing/MFI/prudential — not SHOW. Sell unchanged (`mvp`, not ga / not `pilot_ready`). Rails/cards partner BLOCKED. See `BANK-AUDIT-2026-11-25-v2.md`. |
| Wave 1 P0+P1-7/9/P2-6 | gate[x] | ✅ | [ ] | Code depth only (P2002, institution packs, CBAR loans/portfolio UI, working-day dues, reg/BOKT templates UI, AML T+3 DataHub, WHT registry, collateral stale/`/risk/collateral-items`, DBO schedule + leasing honesty). **No new Scaffold ✅ / no Pilot / sell uplift.** Edition `mvp`, `pilot_ready: false`. Partner rails/cards/XSD BLOCKED. |
| Waves 2–4 lab | gate[x] | ✅ | [ ] | P1-1…P1-6 + P1-8 honesty + P2-2…P2-5 lab deepen (lease IFRS16, MFI sheets, ECL/CKR/OB SCA, webhook outbox, MIS/YAML/ADIF). **Audit-v3 remediations:** collectSheet atomic; lease day-guard; `mulRateRound`; ümidsiz human SoD; Nest DBO leasing BFF. **No new Scaffold ✅ / no Pilot / sell uplift.** Edition `mvp`, `pilot_ready: false`. Partner rails/cards/ASAN complete/XSD BLOCKED. See `BANK-AUDIT-2026-11-25-v3.md` §7. |

## Backlog

| ID | Item | Status | Proof |
|----|------|--------|-------|
| S-1 | Stage-gate script green + signoff | [x] | A0 + W0 signoffs |
| S-2 | Pilot lab UAT-SMOKE signed | [x] | bank + dbo pilot-lab signoffs (lab kit) |
| S-3 | Field / customer sign-off | [ ] | YC-E7 |
| S-RBAC | Bank RBAC Variant A + custom roles | [~] | AC-BNK-RBAC 🟡; `/admin/access` clone; system seed; UAT open — not Pilot |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
