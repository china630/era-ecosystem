# Platform — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?».  
**Not the same as** [`Platform-Implementation-Matrix.md`](./Platform-Implementation-Matrix.md) (= Scaffold BE / AC only).  
**Not** [`READINESS_MATRIX.md`](../READINESS_MATRIX.md) (engineering API/DELIVERY %).

**Sources:** Sprint-Index · Implementation-Matrix · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/platform.yaml`](../editions/platform.yaml)

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.

---

## Line summary (SSOT readiness)

| Edition | Gate | Scaffold BE | UI | Demo / TE | Pilot lab | Pilot field | Edition | Sell / show |
|---------|------|-------------|----|-----------|-----------|-------------|---------|-------------|
| **Platform** | ✅ | 🟡 | 🟡 | 🟡 | [ ] | [ ] | `mvp` | do not claim GA or SaaS pool — TOPO in BE rollup (PlacementJob API ≠ live hop); migrate not sellable |

**Closeout (2026-08-18):** eight AC Scaffold ✅ with negatives; **AC-CP-TOPO in BE rollup** → Scaffold BE **🟡**. Return checklist: [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md). Topology honesty: SHARED pool **Not built**; edition `mvp` / `pilot_ready: false`.

---

## UI (short)

**UI class rollup:** SCREEN — placement hop UI landed — [UI-COVERAGE-BOARD.md](./UI-COVERAGE-BOARD.md). This table is sell/show; «is there a screen?» lives on the board.

| Surface | Path | Level |
|---------|------|-------|
| Workspace / org hub | `/workspace, /organizations` | 🟡 |
| Workforce | `/workspace/workforce/*` | 🟡 — hire/import xlsx landed (optional seat); not sell-ready |
| Super-admin | `/super-admin/*` | 🟡 |
| Placement hop / freeze | `/super-admin/orgs/[orgId]/placement` | 🟡 SCREEN — lab create/advance; AC-CP-TOPO still 🟡 ([return playbook](./BE-OPEN-AND-TOPO-RETURN.md)) |

Routes added 2026-08-17 (still 🟡 / not sell-ready): org catalog, referrals, landing, owner invoices/orders, workforce vacation/orders/ştat/timesheets.

**Having routes ≠ UI ready for sell.** Demo/TE stays 🟡 until live sign-off.

---

## Pilot / field

| Item | Status | Evidence |
|------|--------|----------|
| Lab RT (UAT-SMOKE) | [ ] | `era-orchestrator/doc/UAT-SMOKE-PLATFORM.md`, `UAT-SMOKE-RBAC.md` |
| Field checklist | [ ] | — |
| Partner / customer sign-off | [ ] | — |

---

## Topology / tenancy (honesty)

| Claim | Reality |
|-------|---------|
| SHARED SaaS pool (many orgs, one clinic/hotel DB) | **Not built** (schema-ready + kit filter + two-org UAT outline; pool ops open) — Nafta = DEDICATED/ONPREM; AC-CP-TOPO 🟡 **in BE rollup** (not Scaffold ✅); still not sellable |
| Automated SHARED ⇄ DEDICATED ⇄ ONPREM | **API scaffold only** — PlacementJob state machine + host agent poll + SHARED↔ONPREM reject; **not sellable** live migrate |
| Org UUID bind from Super-admin | **API** (CP-BIND-01 / AC-CP-BIND ✅ Scaffold BE) — Sync + kit boot; deny bad token 401; not Pilot / not sell |
| Desired-state runtime config (SSO / PSA / event) | **API** (CP-CFG-01 / AC-CP-CFG ✅ Scaffold BE) via Sync → industry + Finance Nest; deny missing Bearer / short SSO; not Pilot |
| Additive `organizationId` on satellite tenant rows | **API** (CP-TENANT-01) — clinic/hotel/fnb/retail roots + kit filter; UAT outline in clinic UAT-SMOKE (pending field); not a live SHARED pool |
| Mix hotel DEDICATED + clinic SHARED | Allowed **sales shape** after endpoints+events; not Nafta default; not demoable as one DB |
| Source license SKU | Commercial offer, not a topology — not in edition yaml yet |
| License term by topology | **API + SuperAdmin UI** (CP-LIC-01) — SHARED=system trial; DEDICATED/ONPREM=no trial + perpetual until admin sets a date. Not a SHARED pool. ONPREM remote term only while cloud CP is reachable |

Canon: [`docs/adr/deployment-topology.md`](../adr/deployment-topology.md).

## Sell / show rules

- Edition column copies `docs/editions/platform.yaml`.
- Sell text must not contradict the worst layer above.
- Forbidden: «ready» / «GA» while Pilot field open or Demo ❌.
- Forbidden: «SaaS multi-tenant» / «one-click on-prem migrate» while AC-CP-TOPO is not Scaffold ✅ / Pilot-ready. Later TOPO ✅ still does **not** sell the pool without a separate sell claim.
- Forbidden: treating CP-BIND/CFG/TENANT/PLACE API as Pilot-ready SHARED pool.
