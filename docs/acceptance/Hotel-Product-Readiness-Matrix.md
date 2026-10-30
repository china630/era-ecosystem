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
| FO / front desk | chessboard, card, `/availability`, `/reports/reservations`. Avl follows the assigned door; an unassigned stay still holds the sold type. Card save clamps the room-plan bar to the header checkout | ✅ |
| Shared twin (HOT-FO-03) | card Assignment + `/fo/room-plan` + rack badge. In-house suggestions use today through checkout | SCREEN (out of FO SHOW rollup until UAT-SMOKE §30). Does not move Gate, UI ✅, Demo ✅, Pilot, or edition |
| Stay amendment (HOT-FO-04) | pricing tab + product-from-date wizard + room history. In-house move uses today through checkout. Saving a tariff, an Elektra upsert, and an OTA modify move the slice plan from the first open night. The charged type stays | SCREEN (out of FO SHOW until UAT-SMOKE §35). Does not move Gate, UI ✅, Demo ✅, Pilot, or edition |
| Depart guest (HOT-FO-05) | Guests ⋮ DepartGuestModal. Opening the stay does not recreate a closed folio for a departed guest. Saving the stay keeps the departure | SCREEN (out of FO SHOW until UAT-SMOKE §43). Does not move Gate, UI ✅, Demo ✅, Pilot, or edition |
| Move guest (HOT-FO-06) | MoveGuestModal | SCREEN (out of FO SHOW until UAT-SMOKE §44). Dialog copy az/ru/en. Does not move Gate, UI ✅, Demo ✅, Pilot, or edition |
| Cash / CL | `/folio/[id]`, `/front-cash/pending`, `/front-cash/agency-ledger`, `/front-cash/company-ledger`, `/operations` | ✅ signed demo. Folio Debit\|Credit ledger + row «Bu sətri ödə» (GUEST only) + stay-wide lodging Accept payment + open-debt gate; short Otaq/Tibbi paket labels + PKG Təsvir i18n; guest/company/agency debt labels; room payer + MOVE_PAYER_CL. A guest folio with no guest folds onto the primary guest folio on list, checkout, and night-audit due-out. Agency/company CL statements = party **folios** only. CL banner links to commission payable. Gate/UI/Demo/Pilot/Edition unchanged (UAT §27 1c re-sign + §29 1a still open) |
| Agency commission (HOT-AG-COMM) | `/distribution/agency-commission` (+ Finance CP card / purchase pay batch id) | SCREEN — accrual/statement/forecast/hold-release + Finance submit/pay sibling; out of Cash/CL SHOW rollup until Demo/TE. Gate/Pilot/edition unchanged (`mvp`, `pilot_ready: false`) |
| Night audit (HOT-NA-01/02) | `/night-audit` | ✅ SHIPPED. 2026-10-28: stop-step reservation refs + Open card (folio/price/due/arrival); PAID pending without `revenueCode` fails with source refs (no `UNKNOWN`). Does not move Gate, UI ✅, Demo ✅, Pilot, or edition |
| Unsettled CL (HOT-CO-05) | `/front-cash/unsettled-departures` | SCREEN — out of Cash/CL SHOW rollup until Demo/TE; does not move Gate, Pilot, or edition |
| Finance→Hotel CL pay (HOT-CL-07) | no new hotel screen (Finance allocate / bank match → `payment-applied`) | NONE / API — HEADLESS handoff; unsettled clears when SETTLED. Does not move Gate, UI ✅, Demo ✅, Pilot, or edition |
| Early unused-nights refund (HOT-CO-04) | checkout confirm (folio + chessboard) | ✅ SHIPPED |
| Guest tours (HOT-TOUR-01) | `/tours` (grid+roster/edit modals), `/fleet`, `/settings/policies#tours`, bare `/tours/[id]/print` | SCREEN — boarding-first `TOUR`; icon toolbar; print shell-less + letterhead. Out of SHOW until Demo/TE. UX closeout 2026-10-27: Gate/UI/Demo/Pilot/Edition unchanged |
| Transfers (HOT-XFER-01) | `/transfers` | SCREEN — stay autocomplete; `TRANSFER` on complete; Airport = `?hasFlight=1`. Out of SHOW; does not move Gate/Pilot/edition |
| B2B / MICE | `/distribution/contracts`, allotment, `/banquets*` | ✅ — icon actions; explicit party type; Cancel/Expire; terminal allotments read-only; gross/net + i18n; card room payer; FO sellable uses contract allotment when `salesContractId` set. Open debts SC-REST/DEP/REL — not claimed. Gate/Pilot/edition unchanged |
| Agency portal (extranet) | `/agency/*` + FO `/fo/agency-inbox` | SCREEN / 🟡 (HOT-AGP API; not SHOW — no Demo-TE) |
| HK / admin | HK MVP Dirty/Clean/Inspected, `/admin/*` | ✅ |
| Nafta HK deepen | `/hk` `/hk/rooms` `/hk/mobile` `/hk/roster` `/hk/rotation` `/hk/laundry` `/hk/forecast` `/hk/discrepancy` (+ closed-rooms, maids, minibar, consumption, `/fo/laundry`) | SCREEN / 🟡 (not SHOW — UAT §34 open). Soft sort + room#; void IN_PLANT; FO amount+express; stay linen edit-only; maids edit/unlink; discrepancy create modal; playbook one-PRIMARY + filter bars; kit table/card shell (`rounded-2xl`). Closeout 2026-10-28 (shell tokens): Gate/UI/Demo/Pilot/Edition unchanged (rollup = Pilot open → mvp, not GA) |
| Management reports catalog / nightly ZIP | `/reports` workspace (Start/End + radios) + nightly pack + cubes (HOT-RPT W1–W3); one layout for screen/PDF/Excel with hotel letterhead (`/settings/policies#letterhead`; address/phone/email/website/logo lock when Sync orgProfile present — CP-ORG-PROFILE-01) | SCREEN / 🟡 (not SHOW — no UAT / Demo-TE) |
| Revenue codes + day document (HOT-REV-01) | `/settings/master-data` (manual charge/pay flags) + `/settings/integration?view=gl`; F&B `/admin/settings` warehouse | SCREEN / 🟡 (out of Hotel SHOW rollup — Nafta v2 remap + SatAdmin flags; apply + night audit not run; not SHIPPED; hub refuses blank pending `revenueCode`) |
| e-qaimə day close (FIN-EQAIME-DAY-01) | `/night-audit` gap list and check-day stop when the finance checkbox is on | SCREEN / 🟡 — API, not SHOW. Rule off by default. Does not move Hotel Gate, UI ✅, Demo ✅, or Sell |
| Mutation audit (HOT-AUD-01) | `/admin/audit` + `GET /api/admin/audit` (CatalogField incl. CashShift/BusinessDay; reports grant) + reservation stay journal | SCREEN / 🟡 — Layer A + Wave B CashShift/DAY_CLOSE + Wave E compound index (2026-10-29); UAT open — not SHOW / not SHIPPED; hash-chain deferred. Does not move Gate, UI ✅, Demo ✅, Pilot, or Sell |

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
- Allowed show language: «FO + City Ledger MVP showable — guest→payer MOVE_PAYER_CL + unsettled departures ops (UI/Demo green; pilot open)» — not certified / not GA. Unsettled screen is SCREEN until Demo/TE refresh.
- Forbidden: «SHARED hotel SaaS pool» / «automated on-prem migrate» — not this edition ([deployment-topology.md](../adr/deployment-topology.md)). Nafta already runs SHARED; AC-HOT-TENANT stays 🟡 out of BE rollup until field two-org UAT.
