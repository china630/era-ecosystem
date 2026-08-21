# Platform — Sprint / Wave Index

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness:** [`Platform-Product-Readiness-Matrix.md`](./Platform-Product-Readiness-Matrix.md)  
**AC Matrix:** [`Platform-Implementation-Matrix.md`](./Platform-Implementation-Matrix.md)

Header honesty = **Product Readiness** rollup (not «all ✅»).  
Current rollup: Gate ✅ (scaffold only) · BE 🟡 (TOPO **in** rollup — PlacementJob API ≠ live hop) · UI 🟡 · Sell: do not claim GA or SHARED pool  
**BE honesty:** Wave 7 greened AUTH/BILL/MDM/WF/SA/INT/BIND/CFG. TOPO stays in rollup 🟡. Playbook: [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md).

---

## Wave board

| Wave | Gate | AC rollup (from Matrix) | Pilot-ready | Notes / log |
|------|------|-------------------------|-------------|-------------|
| W0 baseline | gate[x] | 🟡 | [ ] | reports/platform-stage-W0-signoff.md scaffold-gate-pass |
| W1 honesty | gate[ ] | ❌ | [ ] | Close P0 residuals; UAT lab signoff; topology placement still open |
| W7 Green BE | gate[x] | 🟡 | [ ] | Eight AC Scaffold ✅ + negatives; TOPO in rollup → edition BE 🟡 |
| W8 Green BE | gate[x] | 🟡 | [ ] | TOPO excl. reverted; TOPO in rollup; pool/migrate not sellable |

## Backlog

| ID | Item | Status | Proof |
|----|------|--------|-------|
| S-1 | Stage-gate script green + signoff | [~] | `scripts/run-platform-stage-gate.mjs` |
| S-2 | Pilot lab UAT-SMOKE signed | [ ] | `era-orchestrator/doc/UAT-SMOKE-PLATFORM.md`, `UAT-SMOKE-RBAC.md` |
| S-3 | Field / customer sign-off | [ ] | — |
| S-4 | Deployment topology program | [~] | Waves 0–18: bind + runtime-config + PlacementJob API scaffold + host agent stub + SHARED-ready schema/filter + two-org UAT outline. **Open:** live SHARED pool ops / field isolation signoff / automated migrate product — not sellable as SaaS pool |
| S-5 | BE deepen → Scaffold ✅ (excl. TOPO) | [x] | IM + `apps/api/src/**/cp-*-negative.spec.ts` (Wave 7) |
| S-6 | TOPO in BE rollup + return playbook | [x] | [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md); TOPO 🟡 paints BE |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
