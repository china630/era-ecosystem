# Hotel — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?».  
**Not the same as** [`Hotel-Implementation-Matrix.md`](./Hotel-Implementation-Matrix.md) (= Scaffold BE / AC only).  
**Not** [`READINESS_MATRIX.md`](../READINESS_MATRIX.md) (engineering API/DELIVERY %).

**Sources:** Sprint-Index · Implementation-Matrix · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/hotel.yaml`](../editions/hotel.yaml)

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.

**Closeout (2026-08-04 UI deepen):** UI ✅ · Demo / TE ✅ (`reports/hotel-demo-te-signoff.md`). Scaffold BE remains ✅. Pilot lab/field open — do **not** claim GA; edition stays `mvp`.

---

## Line summary (SSOT readiness)

| Edition | Gate | Scaffold BE | UI | Demo / TE | Pilot lab | Pilot field | Edition | Sell / show |
|---------|------|-------------|----|-----------|-----------|-------------|---------|-------------|
| **Hotel** | ✅ | ✅ | ✅ | ✅ | [ ] | [ ] | `mvp` | mvp showable — do not claim GA; Pilot open; KKM STUB |

---

## UI (short)

**UI class rollup:** SHOW — HOT-06 Elektraweb bridge is **HEADLESS** (extension) — [UI-COVERAGE-BOARD.md](./UI-COVERAGE-BOARD.md). This table is sell/show; «is there a screen?» lives on the board.

| Surface | Path | Level |
|---------|------|-------|
| FO / front desk | chessboard, card, `/availability`, `/reports/reservations` | ✅ |
| Shared twin (HOT-FO-03) | card Assignment + `/fo/room-plan` + rack badge | SCREEN (out of FO SHOW rollup until UAT-SMOKE §30) |
| Cash / CL | `/folio/[id]`, `/front-cash/pending`, `/reports/agency-ledger`, `/operations` | ✅ |
| Early unused-nights refund (HOT-CO-04) | checkout confirm (folio + chessboard) | ✅ SHIPPED |
| B2B / MICE | `/admin/contracts`, allotment, `/banquets*` | ✅ |
| Agency portal (extranet) | `/agency/*` + FO `/fo/agency-inbox` | SCREEN / 🟡 (HOT-AGP API; not SHOW — no Demo-TE) |
| HK / admin | HK flows, `/admin/*` | ✅ |
| Management reports catalog / nightly ZIP | `/reports/*` hubs + nightly pack + cubes (HOT-RPT W1–W3) | SCREEN / 🟡 (not SHOW — no UAT / Demo-TE) |

Demo/TE ✅ via `reports/hotel-demo-te-signoff.md` (live walkthrough). Pilot lab still requires UAT-SMOKE §27 artifact.  
HOT-CO-04 unused-nights refund is **SHIPPED** (OpsUI) — out of Hotel SHOW rollup only if Demo-TE not refreshed; does not claim GA.


---

## Pilot / field

| Item | Status | Evidence |
|------|--------|----------|
| Lab RT (UAT-SMOKE) | [ ] | `era-hotel-pms/doc/UAT-SMOKE.md` (§27 P5 + FO chain) |
| Field checklist | [ ] | — |
| Partner / customer sign-off | [ ] | — |

---

## Sell / show rules

- Edition column copies `docs/editions/hotel.yaml`.
- Sell text must not contradict the worst layer above (Pilot lab/field still open → not GA).
- Forbidden: «ready» / «GA» while Pilot field open.
- Allowed show language: «FO + City Ledger MVP showable (UI/Demo green; pilot open)» — not certified / not GA.
- Forbidden: «SHARED hotel SaaS pool» / «automated on-prem migrate» — not this edition ([deployment-topology.md](../adr/deployment-topology.md)). Schema+filter 🟡 ≠ live pool (AC-HOT-TENANT stays out of BE rollup).
