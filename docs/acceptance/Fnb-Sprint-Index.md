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
| S-BUFFET | Buffet Planner module (`fnb_buffet_planner`) | [~] | FNB-BUFFET-01 API/SCREEN; WP0–WP8 + second-pass + tail (modal kind, Spawn-free); staging NAFTANI rename; UAT FB-5 unsigned; `mvp` |
| S-BUFFET-COST | Buffet cost attribution (HYBRID / residual) + staff overlap + management covers | [ ] | Waves 1–6 + Phase A–D + chef-ready + WP0–WP8 + second-pass + tail API/SCREEN; punchlist open/unsigned; C3 won't-do; C8 = future RBAC; not sellable |
| S-OUTLET | Multi-outlet create + caps + Elektra gate | [~] | FNB-09 / FB-OUTLET-01; staging RESTAURANT→NAFTANI (rename, data kept); kill-script rename path; UAT open — not SHIPPED |
| S-AUD | Mutation audit Layer A belt (ecosystem standard) | [~] | FNB-AUD-01 / AC-FNB-AUD 🟡; Wave B PAY/DISCOUNT/ROOM_CHARGE/DEFER_HUB + PosShift; Wave E compound `(organizationId, createdAt)` 2026-10-29; hash-chain deferred; UAT open — not SHIPPED; out of BE/SHOW rollup; Gate/Pilot/edition unchanged |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`

**2026-10-29:** Buffet UI playbook pass — NavItemGroup sentence-case + collapse; PageHeader.actions; filter gutters; template composition modal; norms hideLabel; Maya KPI always; Settings integration URLs (Finance/Hotel/Orch). Status unchanged API/SCREEN; `S-BUFFET` [~] / `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp`; **no** Demo ✅ / SHOW / SHIPPED. `era-readiness-matrix` skipped.
**2026-10-29:** WP0–WP8 tail closeout — Spawn-free AZ/RU; template modal kind; select-outlet Nöqtə; kill rename-if-no-NAFTANI; staging RESTAURANT→NAFTANI. COVERAGE/IM/PRM status unchanged API/SCREEN; `S-BUFFET`/`S-OUTLET` [~] / `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp` untouched; **no** Demo ✅ / SHOW / SHIPPED / Scaffold ✅. Droplet UI still needs image deploy. `era-readiness-matrix` skipped.
**2026-10-29:** WP0–WP8 second-pass closeout — locale sync toasts (not EN API body); section PageHeader; AZ/RU chef leftovers; Maya blocked honesty. COVERAGE/IM/PRM status unchanged API/SCREEN (UI 🟡 SCREEN); `S-BUFFET` [~] / `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp` untouched; **no** Demo ✅ / SHOW / SHIPPED / Scaffold ✅. `era-readiness-matrix` skipped.
**2026-10-29:** WP0–WP8 chef product closeout — BuffetPageChrome/CTAs, AZ chef i18n, templates list+modal, week-primary, accordion+hide till, sync honesty, ADR/UAT honesty. COVERAGE/IM/PRM status unchanged API/SCREEN (UI 🟡 SCREEN); `S-BUFFET` [~] / `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp` untouched; **no** Demo ✅ / SHOW / SHIPPED / Scaffold ✅. `era-readiness-matrix` skipped (no consumer API level / M16 flip).
**2026-10-29:** FNB-09 second-pass closeout — till API/UI guards + UAT FB-OUTLET-01 expanded; COVERAGE/IM/PRM status unchanged API/SCREEN; `S-OUTLET` [~]; `fnb.yaml` `mvp` untouched; **no** Demo ✅ / SHOW / SHIPPED. `era-readiness-matrix` skipped.
**2026-10-29:** Outlet capabilities + Elektra gate closeout (FNB-09) — COVERAGE actors Ops/SatAdmin SCREEN; IM no Scaffold ✅ (out of BE rollup); PRM UI 🟡 SCREEN / Gate·BE·Demo·Pilot·Edition·Sell unchanged; `S-OUTLET` [~]; `fnb.yaml` `mvp` untouched; UI board FNB-09 SCREEN. **no** Demo ✅ / SHOW / SHIPPED. `era-readiness-matrix` skipped (no consumer API level / M16 flip).
**2026-10-29:** C3 won't-do (Finance twin settings) — removed from backlog open list → § D non-goals; not a product gap.
**2026-10-29:** Buffet chef UX wave — submenu routes, template `kind`+spawn factor, hotel pax sync, management grid/eaters, Proqnoz/Normalar/Cost-run split. COVERAGE/IM/PRM SCREEN honesty; `S-BUFFET` [~] / `S-BUFFET-COST` `[ ]`; `fnb.yaml` untouched; **no** Demo ✅ / SHOW / SHIPPED. `era-readiness-matrix` skipped.
**2026-10-29:** Chef-ready polish closeout (B3/B5/B6 + C1/C2/C7/C9–C12) — COVERAGE/IM/PRM SCREEN honesty; backlog A/B mostly `[x]`; C8 = future RBAC; A9 punchlist blocked; `S-BUFFET-COST` `[ ]`; `fnb.yaml` untouched; **no** Demo ✅ / SHOW / SHIPPED. `era-readiness-matrix` skipped.
**2026-10-29:** Chef-ready WO1–10 implementation closeout — COVERAGE/IM/PRM SCREEN honesty; backlog A1–A8/B1/B2/B4/C4–C6 `[x]`; A9 punchlist blocked; `S-BUFFET-COST` `[ ]`; `fnb.yaml` untouched; **no** Demo ✅ / SHOW / SHIPPED. `era-readiness-matrix` skipped (catalog reuse ≠ M16).
**2026-10-29:** Chef-ready backlog ADR closeout (docs only) — COVERAGE changelog + IM proof link; status unchanged API/SCREEN; PRM/Sprint/`fnb.yaml` untouched; `era-readiness-matrix` skipped. Gaps open in [fnb-buffet-chef-ready-backlog.md](../adr/fnb-buffet-chef-ready-backlog.md) — not Demo ✅ / SHOW.
**2026-10-29:** Phase D second-pass closeout — status unchanged: COVERAGE API/SCREEN; IM no Scaffold ✅; PRM UI 🟡 SCREEN / Demo unsigned lab-only; Gate/BE/Pilot/Edition/Sell unchanged; `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp`. `era-readiness-matrix` skipped (M16 `[ ]`).
**2026-10-29:** Phase D lab demo seed closeout — COVERAGE API/SCREEN (+ lab seed note); IM no Scaffold ✅; PRM UI 🟡 SCREEN / Demo stays unsigned lab-only; Gate/BE/Pilot/Edition/Sell unchanged; `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp` untouched. `era-readiness-matrix` skipped (seed/docs only; M16 `[ ]`).
**2026-10-28:** Phase C second-pass closeout — status unchanged: COVERAGE API/SCREEN; IM no Scaffold ✅; PRM UI 🟡 SCREEN / sell unchanged; Finance PRM cross-product Phase C note; `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp`. `era-readiness-matrix` skipped (M16 `[ ]`).
**2026-10-28:** Phase C Finance polish closeout — COVERAGE API/SCREEN; IM no Scaffold ✅; PRM Gate/BE/Demo/Pilot/Edition/Sell unchanged (UI 🟡 SCREEN, not SHOW); `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp` untouched. UAT Phase C open. `era-readiness-matrix` skipped (UI-only; M16 `[ ]`).
**2026-10-28:** Phase B second-pass closeout — status unchanged: COVERAGE API/SCREEN; IM no Scaffold ✅; PRM UI 🟡 SCREEN / sell unchanged; `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp`. `era-readiness-matrix` skipped (M16 `[ ]`).
**2026-10-28:** Phase B chef UX closeout — COVERAGE API/SCREEN; IM no Scaffold ✅; PRM Gate/BE/Demo/Pilot/Edition/Sell unchanged (UI 🟡 SCREEN, not SHOW); `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp` untouched. UAT Phase B open. `era-readiness-matrix` skipped (UI-only; M16 `[ ]`).
**2026-10-28:** Phase A second-pass closeout — status unchanged: COVERAGE API/SCREEN; IM no Scaffold ✅; PRM UI 🟡 SCREEN / sell unchanged; `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp`. `era-readiness-matrix` skipped (M16 `[ ]`).
**2026-10-28:** Phase A hybrid-handoff closeout — COVERAGE API/SCREEN; IM no Scaffold ✅; PRM Gate/BE/Demo/Pilot/Edition/Sell unchanged (UI 🟡 SCREEN, not SHOW); `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp` untouched. UAT chef path open. `era-readiness-matrix` skipped (M16 stays `[ ]`, no consumer API level flip).
**2026-10-28:** Closeout Wave 6 (+ second-pass: budget Run without wiping plan; covers-rollup hotel nights UI; forecast Refresh-only override) — COVERAGE API/SCREEN; IM no Scaffold ✅; PRM Gate/BE/Demo/Pilot/Edition/Sell unchanged (UI 🟡 SCREEN, not SHOW); `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp` untouched. UAT Wave 6 open. `era-readiness-matrix` skipped (M16 stays `[ ]`, no consumer API level flip).
**2026-10-28:** Wave 6 forecast pack + non-FOOD budget — COVERAGE API/SCREEN; `S-BUFFET-COST` `[ ]`; UAT Wave 6 open; `fnb.yaml` `mvp` untouched. Not SHIPPED/sellable.
**2026-10-28:** Wave 5 Finance HYBRID FOOD cost run + warehouse costClass/outlet scope + F&B deep-link — COVERAGE API/SCREEN; `S-BUFFET-COST` `[ ]`; Wave 6 open; `fnb.yaml` `mvp` untouched. UAT Wave 5 open.
**2026-10-28:** Closeout after Wave 4 second-pass (cost-run date order / lt-end bounds, Refresh-only AZN drafts, omit blank default COGS, OFF model hint) — status unchanged: COVERAGE API/SCREEN; IM no Scaffold ✅; PRM UI 🟡 SCREEN / sell unchanged; `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp`. `era-readiness-matrix` skipped (M16 `[ ]`).
**2026-10-28:** Closeout Wave 4 COMP/zero-price cost-run — COVERAGE API/SatAdmin SCREEN; IM no Scaffold ✅; PRM Gate/BE/Demo/Pilot/Edition/Sell unchanged (UI 🟡 SCREEN, not SHOW); `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp` untouched. UAT Wave 4 open. `era-readiness-matrix` skipped (M16 stays `[ ]`, no consumer API level flip).
**2026-10-28:** Wave 4 COMP/zero-price cost-run export + Cost run tab — COVERAGE API/SatAdmin SCREEN; `S-BUFFET-COST` `[ ]`; Finance HYBRID report still open; `fnb.yaml` `mvp` untouched. UAT Wave 4 open.
**2026-10-28:** Closeout Wave 3 staff meals + overlap — COVERAGE API/SatAdmin SCREEN; IM no Scaffold ✅; PRM Gate/BE/Demo/Pilot/Edition/Sell unchanged (UI 🟡 SCREEN, not SHOW); `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp` untouched. UAT Wave 3 open. `era-readiness-matrix` skipped (M16 stays `[ ]`, no consumer API level flip).
**2026-10-28:** Closeout after Wave 2 second-pass (outlet template sticky fix, slot delete/query, covers-rollup refresh) — status unchanged: COVERAGE API/SCREEN; IM no Scaffold ✅; PRM UI 🟡 SCREEN / sell unchanged; `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp`. `era-readiness-matrix` skipped (M16 `[ ]`).
**2026-10-28:** Closeout Wave 2 buffet template + management meals — COVERAGE API/SatAdmin SCREEN; IM no Scaffold ✅; PRM Gate/BE/Demo/Pilot/Edition/Sell unchanged (UI 🟡 SCREEN, not SHOW); `S-BUFFET-COST` `[ ]`; `fnb.yaml` `mvp` untouched. UAT Wave 2 open. `era-readiness-matrix` skipped (M16 stays `[ ]`, no consumer API level flip).
**2026-10-28:** Closeout Wave 1 buffet cost settings — COVERAGE API/SatAdmin SCREEN; IM no Scaffold ✅; PRM UI 🟡 SCREEN (settings); Sprint `S-BUFFET-COST` `[ ]`; editions `fnb.yaml` untouched (`mvp`, no sell). UAT `FNB-BUFFET-COST-01` draft open. `era-readiness-matrix` skipped (no consumer API level / DELIVERY % flip — M16 stays `[ ]`).
**2026-10-28:** Buffet cost Wave 1 settings (`S-BUFFET-COST` still `[ ]` until cost run UAT; `FNB-BUFFET-COST-01` API/SCREEN). Not sellable. Edition unchanged.
**2026-10-28:** Buffet cost attribution ADR + in-repo wave plan (`S-BUFFET-COST` `[ ]`, `FNB-BUFFET-COST-01` Doc). Not sellable. Edition unchanged.  
**2026-10-27:** Buffet Planner landed as module (not gate flip). Sell claim and `docs/editions/fnb.yaml` stay `mvp` / `pilot_ready: false`.
