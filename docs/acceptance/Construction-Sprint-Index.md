# Construction — Sprint / Wave Index

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness:** [`Construction-Product-Readiness-Matrix.md`](./Construction-Product-Readiness-Matrix.md)  
**AC Matrix:** [`Construction-Implementation-Matrix.md`](./Construction-Implementation-Matrix.md)

Header honesty = **Product Readiness** rollup (not «all ✅»).  
Current rollup: Gate ✅ (scaffold only) · BE ✅ · UI 🟡 · Pilot lab [~] · Sell: do not claim GA — field/`ga` closed

---

## Wave board

| Wave | Gate | AC rollup (from Matrix) | Pilot-ready | Notes / log |
|------|------|-------------------------|-------------|-------------|
| W0 baseline | gate[x] | ✅ | [ ] | `reports/construction-stage-W0-signoff.md` scaffold-gate-pass; Green-BE negative specs |
| W1 honesty | gate[ ] | ✅ | [ ] | UAT lab signoff; close P0 residuals |

## Backlog

| ID | Item | Status | Proof |
|----|------|--------|-------|
| S-1 | Stage-gate script green + signoff | [x] | `scripts/run-construction-stage-gate.mjs` |
| S-2 | Pilot lab UAT-SMOKE signed | [~] | Wave-1 + Pilot W2–W4 sections; signoff MD templates — human sign open |
| S-3 | Field / customer sign-off | [ ] | — |
| S-RBAC | Construction RBAC Variant A + custom roles | [~] | AC-CON-RBAC 🟡; `/admin/access` clone + assign; system seed; UAT open — not Pilot |
| S-BOUND | Plane boundaries ADR (Finance / CP / CRM) | [x] | `docs/adr/construction-domain-boundaries.md` |
| S-ACT-LINES | Progress act ops SOV lines (M13) | [~] | CN-ACT-LINES-01 API+SCREEN; **2026-11-23** sum/Finance/lock + second-pass 409 i18n; AC-CON-ACT-LINES 🟡; UAT-SMOKE Wave-1 — not Pilot |
| S-W1-SCAFFOLD | Wave 1 full satellite skeleton | [x] | CN-W1-SCAFFOLD-01 STUB; AC-CON-W1-SCAFFOLD 🟡 out of BE rollup |
| S-W2-MVP | Wave 2 MVP vertical slice (BOQ→act lines→approve→Finance) | [x] | SCREEN UI; Finance journal idempotent; second-pass draft/amount/requisition; not SHIPPED / Pilot / ga |
| S-W3-DEPTH | Wave 3 depth (parties/CDE/field/RFI/submittal/change) | [x] | CN-W3-DEPTH-01 API+SCREEN; second-pass field-ops/pin/crew; AC-CON-W3-DEPTH 🟡; not SHIPPED / Pilot / ga |
| S-W4-PRODUCT | Wave 4 product hub (usable SCREEN, no UAT) | [x] | CN-W4-PRODUCT-01 API+SCREEN; second-pass FORBIDDEN/submittal Reject/claim amount; AC-CON-W4-PRODUCT 🟡; residual UAT/Pilot backlog; not SHIPPED / Pilot / ga |
| S-PRODUCT-UI-BRIDGES | Product UI BIM polish + Orch staff fan-out | [x] | CN-BIM SKU/URL + field-ops sibling; CN-STAFF-01 API (`CONSTRUCTION_API_URL`); UI stays SCREEN; not SHIPPED / Pilot / ga |
| S-PILOT-INTAKE | Pilot AZ intake questionnaire (Word+MD) | [x] | `docs/products/ERA-Construction-Pilot-Anket-AZ.*`; **2026-11-23** gray hints + spelling; process artifact — no sell/Pilot flip |
| S-ESTIMATE-HIER | Five-level estimate pack (lokal→obyekt→toplu) + Forma-2/3 bridges | [~] | ADR + schema + API + hub Estimate SCREEN + event `lines[]`; Finance SOV seed; **2026-11-23** banners + Nest HTTP `sovSeedEligible`; AC-CON-EST 🟡; UAT-SMOKE Wave-1 — not SHIPPED / Pilot / ga |
| S-SMETA-RATE | Smeta rate-engine MVP (Construction SKU `construction_smeta_rate_engine`) | [~] | Schema/API/UI SCREEN + seed SKU; **2026-11-23** amount>0 + ops nav Rate bases + skuOff; AC-CON-SMETA-RATE 🟡; UAT-SMOKE Wave-1 — [construction-smeta-rate-engine.md](../adr/construction-smeta-rate-engine.md); not DESN; not SHIPPED / Pilot / ga |
| S-NEST-EDGE | Nest native Controllers cutover (drop generate-nest; Next-free Nest edge) | [x] | ADR construction-nest-native-controllers; Controllers over `@/lib`; cookie TTL ms; no sell/Pilot/`ga` flip |
| S-PILOT-W2-BRIDGE | Pilot W2 Finance SOV + journal proof + lab signoff | [~] | UAT Finance bridge + `reports/construction-pilot-w2-lab-signoff.md`; AC yellow; not SHOW/ga |
| S-PILOT-W3-COMM | Pilot W3 PayApp/KS soft ref + hub materialCode | [~] | `financePayAppId` + materials SEARCHABLE/fallback; act contract stamp; AC yellow; not SHOW/ga |
| S-PILOT-W4-LAB | Pilot W4 tenancy/RBAC/Demo TE honesty | [~] | DEMO-TE doc + `reports/construction-pilot-w4-lab-signoff.md`; `pilot_ready` false |
| S-UAT | UAT-SMOKE signoff → Pilot track | [~] | Advanced by Pilot W2–W4 templates; field open |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
