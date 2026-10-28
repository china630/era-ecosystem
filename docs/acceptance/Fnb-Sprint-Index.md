# F&B — Sprint / Wave Index

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness:** [`Fnb-Product-Readiness-Matrix.md`](./Fnb-Product-Readiness-Matrix.md)  
**AC Matrix:** [`Fnb-Implementation-Matrix.md`](./Fnb-Implementation-Matrix.md)

Header honesty = **Product Readiness** rollup (not «all ✅»).  
Current rollup: Gate ✅ (scaffold only) · BE ✅ · UI 🟡 · Sell: do not claim GA — pilot open

---

## Wave board

| Wave | Gate | AC rollup (from Matrix) | Pilot-ready | Notes / log |
|------|------|-------------------------|-------------|-------------|
| W0 baseline | gate[x] | ✅ | [ ] | reports/fnb-stage-W0-signoff.md scaffold-gate-pass; Green-BE negative specs |
| W1 honesty | gate[ ] | ✅ | [ ] | Close P0 residuals; UAT lab signoff |

## Backlog

| ID | Item | Status | Proof |
|----|------|--------|-------|
| S-1 | Stage-gate script green + signoff | [~] | `scripts/run-fnb-stage-gate.mjs` |
| S-2 | Pilot lab UAT-SMOKE signed | [ ] | `era-fnb-pos/doc/UAT-SMOKE.md` |
| S-3 | Field / customer sign-off | [ ] | — |
| S-RBAC | F&B RBAC Variant A + custom roles | [~] | AC-FNB-RBAC 🟡; `/admin/access` clone; system seed; UAT open — not Pilot |
| S-BUFFET | Buffet Planner module (`fnb_buffet_planner`) | [~] | FNB-BUFFET-01 API/SCREEN; master table + copy/composition modals; UAT FB-5 open; Gate/Pilot/edition unchanged (`mvp`) |
| S-OUTLET | Multi-outlet create in Settings | [~] | FNB-09 / FB-OUTLET-01; `POST /api/outlets` UI (+ optional menu/halls/tables copy); UAT open — not SHIPPED |
| S-AUD | Mutation audit Layer A belt (ecosystem standard) | [~] | FNB-AUD-01 / AC-FNB-AUD 🟡; `jsonOk` + `/admin/audit` + `GET /api/admin/audit` SCREEN + canonical filters; UAT open — not SHIPPED; out of BE/SHOW rollup; Gate/Pilot/edition unchanged |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`

**2026-10-27:** Buffet Planner landed as module (not gate flip). Sell claim and `docs/editions/fnb.yaml` stay `mvp` / `pilot_ready: false`.
