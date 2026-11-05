# Hotel — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?».  
**Not the same as** [`Hotel-Implementation-Matrix.md`](./Hotel-Implementation-Matrix.md) (= Scaffold BE / AC only).  
**Not** [`READINESS_MATRIX.md`](../READINESS_MATRIX.md) (engineering API/DELIVERY %).

**Sources:** Sprint-Index · Implementation-Matrix · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/hotel.yaml`](../editions/hotel.yaml)

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.

**Closeout (2026-08-04 UI deepen):** UI ✅ · Demo / TE ✅ (`reports/hotel-demo-te-signoff.md`). Scaffold BE remains ✅. Pilot lab/field open — do **not** claim GA; edition stays `mvp`.

**Closeout (2026-11-02 lifecycle outbox):** HOT-PKG-04 stays API. AC-HOT-PKG-PAX stays 🟡. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. `docs/editions/hotel.yaml` unchanged.

**Closeout (2026-11-05 compliment / house use):** Room and package nights post 0. Compliment credits posted lodging; house use credits the open folio. Early checkout does not reverse those credits. HOT-NA-01 and HOT-CO-04 stay SHIPPED. HOT-PKG-03 stays API. AC-HOT-PKG-COMPOSE and AC-HOT-CO-EARLY stay 🟡. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-05 cross-class door):** HOT-FO-04 stays API. AC-HOT-AMEND stays 🟡. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-05 from-date plan CTA):** HOT-FO-04 stays API (label + layout only). AC-HOT-AMEND stays 🟡. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-05 checkout tables):** Category columns are a table; stay balance sits under the blocks. Sanatorium procedure chips are tables (open paid, and every procedure on the fact chip). Duplicate payment allocation is skipped. HOT-CO-01 stays SHIPPED. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-05 org payment methods):** Hotel desks consume orch Sync catalog (HOT-CASH-01 deepen). Catalog SoR is Platform CP-PAY-METHODS-01 API. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-05 department schedules):** HOT-DUTY-01 SCREEN/API (not SHOW). AC-HOT-DUTY 🟡 out of BE rollup. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index S-29 [~]; `hotel.yaml` untouched. Second-pass: `screen:schedules` page map + settingsAccess i18n + binding `orgUnitOptions` — no Gate/Demo/Pilot/Sell flip.

**Closeout (2026-11-06 passport MRZ):** HOT-MRZ-01 is API. The scanner is a modal on the guest card and the stay guest row, platform super-admin only. AC-HOT-MRZ stays 🟡 (parser negative in `__tests__/mrz-parse.spec.ts`; UAT-SMOKE §2 3a open). Shared passport with a different name attaches that card and does not overwrite names. `GuestDocument.mrzNameField` stores the raw ICAO name; match order is raw MRZ → passport → exact name → translit/typo/metaphone (confirm-only). Catalog `hotel_passport_scan` is 19 AZN and is not entitled. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched. HOT-GST-01 stays API (dedup name fold + similar-name / metaphone groups stay confirm-only).

**Closeout (2026-11-06 duty UX deepen):** HOT-DUTY-01 stays SCREEN/API (chip assign, week chrome, copy week, axes settings) — **not SHOW**. AC-HOT-DUTY 🟡. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. `hotel.yaml` untouched. Second-pass: copy replace guard + skip retired axes on copy + ops subtitles — no Gate/Demo/Pilot/Sell flip.

**Closeout (2026-11-04 deposit / surplus / party money):** Folio tab takes a deposit for one guest. Checkout surplus is return change or carry to another stay. Party save refuses a guest who still has a payment or a HELD deposit; transfer of that money is on the same folio form. Planned paid procedures are on the folio tab. HOT-CASH-03 stays API. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-04 folio chrome):** The reservation folio tab no longer shows the ERA Finance boundary banner. Deep links stay on invoice report, agency ledger, company ledger, unsettled departures, and stock. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-04 City Ledger night handoff):** Checkout leaves company/agency debt `PENDING_AR`. Night audit transfers only when Finance already has the VÖEN card; otherwise it queues a card request. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

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
| FO / front desk | chessboard, card, `/availability`, `/fo/reservations`, `/fo/in-house`. Avl follows the assigned door; an unassigned stay still holds the sold type. Sell cap is the type quota plus its overbook, inside the house cap (both default 0). Create, group save, and the chessboard toast type cap, house cap, stop-sell, and room conflict. Card save clamps the room-plan bar to the header checkout. Civil dates on lists and the card render `дд.мм.гггг`; the executive date control is `DatePicker`; the forecast axis is `дд.мм`. Pickers stay `YYYY-MM-DD`. Reservations list: children column, departed names muted+strike, Res.ID copy, party channel shows agency/walk-in **and** company when both set, click=select / dblclick=card. In-house list: live party rows incl. children + Res.ID copy. Card left column uses group-boxes; Travel agent / Company strip; payer and Gross/Net on one row (contract locks the basis); NET discounts the room charge and the package night that replaces it (contract percent, else agency percent; no percent leaves the tariff); Müqavilə only when payer is agency/company (hint + B2B link, no FO create). Company/contract attach keeps an already chosen FO medical package (does not force Infotur; GroupBooking same); medical room types ignore meal stamp so OTAXHP stays listed; package switch drops an off-grid charged type; medical FO package beside corp skips the rate≠contract toast; sellable without a contract allotment row uses hotel inventory (`NO_ALLOTMENT_BAR`). Guests tab: attach/create guest keeps the clicked row (no wipe on guest-card save; party PATCH; hydrate syncs age counters; persist-fail toast). `CatalogField` SEARCHABLE dismisses on outside click / Escape / clear. Does not move Gate, UI ✅, Demo ✅, Pilot, or edition. Mixed medical packages: save, night audit, and the open card use one compose; a duplicate group code toasts `GROUP_CODE_TAKEN` | ✅ |
| Shared twin (HOT-FO-03) | card Assignment + `/fo/room-plan` + rack badge. In-house suggestions use today through checkout | SCREEN (out of FO SHOW rollup until UAT-SMOKE §30). Does not move Gate, UI ✅, Demo ✅, Pilot, or edition |
| Stay amendment (HOT-FO-04) | pricing tab + product-from-date wizard + room history. In-house move uses today through checkout. Before check-in the room changes immediately when the dates are free; no move plan. An in-house move still waits on a dirty or occupied door; that PENDING plan is listed on the card. The room list and restore-stay list include other classes (type code on the label); Save and a rack/plan drop ask who pays when the door class differs from the tariff. Saving a tariff, an Elektra upsert, and an OTA modify move the slice plan from the first open night. The charged type stays unless the guest pays the new class | SCREEN (out of FO SHOW until UAT-SMOKE §35). Does not move Gate, UI ✅, Demo ✅, Pilot, or edition |
| Depart guest (HOT-FO-05) | Guests ⋮ DepartGuestModal. Opening the stay does not recreate a closed folio for a departed guest. Saving the stay keeps the departure | SCREEN (out of FO SHOW until UAT-SMOKE §43). Does not move Gate, UI ✅, Demo ✅, Pilot, or edition |
| Move guest (HOT-FO-06) | MoveGuestModal | SCREEN (out of FO SHOW until UAT-SMOKE §44). Dialog copy az/ru/en. Does not move Gate, UI ✅, Demo ✅, Pilot, or edition |
| Cash / CL | `/folio/[id]`, `/front-cash/pending`, `/front-cash/agency-ledger`, `/front-cash/company-ledger`, `/operations` | ✅ signed demo. Accept payment by cashier category (Yaşayış/Klinika/F&B/Digər) + pocket; amount may exceed that category's open debt (surplus is credit for later nights of the same category); empty method until chosen; mid-stay **Return category credit** (FIFO inside category) on folio cash bar + FO header; header category spends + one stay net; folio Kateqoriya column; one open pocket per guest. Checkout nets categories per pocket. Each non-zero folio is its own checkout block (services and payments by category). Credit on any open folio is returned in that block. Open and executed procedures are chips in the same dialog. Folio tab takes a deposit. Deposit transfer is on the same folio form (other open stays of this guest). Gate/UI/Demo/Pilot/Edition unchanged (UAT §27 1c re-sign + §29 1a still open; HOT-CASH-03 stays API) |
| Agency commission (HOT-AG-COMM) | `/distribution/agency-commission` (+ Finance CP card / purchase pay batch id) | SCREEN — accrual/statement/forecast/hold-release + Finance submit/pay sibling; out of Cash/CL SHOW rollup until Demo/TE. Gate/Pilot/edition unchanged (`mvp`, `pilot_ready: false`) |
| Night audit (HOT-NA-01/02) | `/night-audit` | ✅ SHIPPED. 2026-10-28: stop-step reservation refs + Open card (folio/price/due/arrival); PAID pending without `revenueCode` fails with source refs (no `UNKNOWN`). Banner and year-end dates render `дд.мм.гггг`. 2026-11-04: Step 3b hands PENDING_AR to Finance when the VÖEN card exists; a missing card is an exception line and the folio stays. 2026-11-05: compliment and house use post a zero night (room or package) and do not stop the audit. Does not move Gate, UI ✅, Demo ✅, Pilot, or edition |
| Unsettled CL (HOT-CO-05) | `/front-cash/unsettled-departures` | SCREEN — out of Cash/CL SHOW rollup until Demo/TE; does not move Gate, Pilot, or edition |
| Finance→Hotel CL pay (HOT-CL-07) | no new hotel screen (Finance allocate / bank match → `payment-applied`) | NONE / API — HEADLESS handoff; unsettled clears when SETTLED. Does not move Gate, UI ✅, Demo ✅, Pilot, or edition |
| Early unused-nights refund (HOT-CO-04) | checkout confirm (folio + chessboard) | ✅ SHIPPED |
| Guest tours (HOT-TOUR-01) | `/tours` (grid+roster/edit modals), `/fleet`, `/settings/policies#tours`, bare `/tours/[id]/print` | SCREEN — boarding-first `TOUR`; icon toolbar; print shell-less + letterhead. Out of SHOW until Demo/TE. UX closeout 2026-10-27: Gate/UI/Demo/Pilot/Edition unchanged |
| Transfers (HOT-XFER-01) | `/transfers` | SCREEN — stay autocomplete; `TRANSFER` on complete; Airport = `?hasFlight=1`. Out of SHOW; does not move Gate/Pilot/edition |
| B2B / MICE | `/distribution/contracts`, allotment, `/banquets*` | ✅ — icon actions; explicit party type; Cancel/Expire; terminal allotments read-only; gross/net + i18n; card room payer; FO sellable uses contract allotment when a quota row exists, else hotel inventory (`NO_ALLOTMENT_BAR`) with contract still tagged. Open debts SC-REST/DEP/REL — not claimed. Gate/Pilot/edition unchanged |
| Agency portal (extranet) | `/agency/*` + FO `/fo/agency-inbox` | SCREEN / 🟡 (HOT-AGP API; not SHOW — no Demo-TE) |
| HK / admin | HK MVP Dirty/Clean/Inspected, `/admin/*` | ✅ |
| Nafta HK deepen | `/hk` `/hk/rooms` `/hk/mobile` `/hk/roster` `/hk/rotation` `/hk/laundry` `/hk/forecast` `/hk/discrepancy` (+ closed-rooms, maids, minibar, consumption, `/fo/laundry`) | SCREEN / 🟡 (not SHOW — UAT §34 open). Soft sort + room#; void IN_PLANT; FO amount+express; stay linen edit-only; maids edit/unlink; discrepancy create modal; playbook one-PRIMARY + filter bars; kit table/card shell (`rounded-2xl`). Closeout 2026-10-28 (shell tokens): Gate/UI/Demo/Pilot/Edition unchanged (rollup = Pilot open → mvp, not GA) |
| Passport MRZ (HOT-MRZ-01) | guest card scanner + stay guest row | SCREEN — super-admin only; not SHOW; UAT open. Does not move Gate, Demo, Pilot, or Sell |
| Department schedules (HOT-DUTY-01) | `/schedules` + `/schedules/reception` `/security` `/engineering` (+ HK link `/hk/roster`) | SCREEN / 🟡 — WEEK_POST/WEEK_CREW; chip assign + week chrome + copy; Workforce picker; not SHOW; UAT §34b open. Does not move Gate, Demo, Pilot, or Sell |
| Management reports catalog / nightly ZIP | `/reports` workspace (Start/End + radios) + nightly pack + cubes (HOT-RPT W1–W3); one layout for screen/PDF/Excel with hotel letterhead (`/settings/policies#letterhead`; address/phone/email/website/logo lock when Sync orgProfile present — CP-ORG-PROFILE-01). VAT reports print Total amount, Net amount, VAT amount. Trial balance: bold department totals, revenue codes underneath with the report-language name | SCREEN / 🟡 (not SHOW — no UAT / Demo-TE) |
| Revenue codes + day document (HOT-REV-01) | `/settings/master-data` (manual charge/pay flags) + `/settings/integration?view=gl`; F&B `/admin/settings` warehouse | SCREEN / 🟡 (out of Hotel SHOW rollup — SatAdmin flags; one-shot remap scripts removed; not SHIPPED; hub refuses blank pending `revenueCode`) |
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
