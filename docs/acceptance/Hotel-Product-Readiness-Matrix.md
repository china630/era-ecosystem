# Hotel — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?».  
**Not the same as** [`Hotel-Implementation-Matrix.md`](./Hotel-Implementation-Matrix.md) (= Scaffold BE / AC only).  
**Not** [`READINESS_MATRIX.md`](../READINESS_MATRIX.md) (engineering API/DELIVERY %).

**Sources:** Sprint-Index · Implementation-Matrix · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/hotel.yaml`](../editions/hotel.yaml)

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.

**Closeout (2026-11-11 guest app cycles 2–3):** AC-HOT-GUEST-APP 🟡 out of BE rollup. HOT-GUEST-APP-01/02 API/SCREEN. Gate ✅ / BE 🟡 / UI 🟡 / Demo ❌ / Pilot [ ] / Edition `mvp` / Sell unchanged. `hotel.yaml` untouched. `READINESS_MATRIX` N/A. Line rollup stays the existing worst layer.

**Closeout (2026-11-11 guest app cycles 4–10 + second-pass):** AC-HOT-GUEST-APP-REQ 🟡 out of BE rollup. HOT-GUEST-APP-03…08 API/SCREEN (Guests Ops stay-orders/family; phone family link; `KIND_DISABLED`). Gate ✅ / BE 🟡 / UI 🟡 / Demo ❌ / Pilot [ ] / Edition `mvp` / Sell unchanged. `hotel.yaml` untouched. `era-readiness-matrix` N/A.

**Closeout (2026-11-11 guest app harden):** AC-HOT-GUEST-APP-HARDEN 🟡 out of BE rollup. HOT-GUEST-APP-01…10 API/SCREEN (Ops send-to-phone; Care/offline/alarm/bell/folio/board/notify/MRZ/EAS). Gate ✅ / BE 🟡 / UI 🟡 / Demo ❌ / Pilot [ ] / Edition `mvp` / Sell unchanged. `hotel.yaml` untouched. UAT template open — no SHOW/SHIPPED.

**Closeout (2026-11-11 guest app product polish):** `apps/guest-app` screen split + trip-phase Today + auth block + Care/Trip/Bell/Hotel lists + az/ru/en product copy. HOT-GUEST-APP-01…10 stay API/SCREEN (deepen only). Gate ✅ / BE 🟡 / UI 🟡 / Demo ❌ / Pilot [ ] / Edition `mvp` / Sell unchanged. `hotel.yaml` untouched. UAT unsigned — no SHOW/SHIPPED.

**Closeout (2026-11-10 access denied):** A missing screen grant opens `/access-denied`. HOT-RBAC-01 stays API / SCREEN. AC-HOT-RBAC stays 🟡. Gate / BE / UI / Demo / Pilot / Sell unchanged.

**Closeout (2026-11-10 hotel catalog v8):** booking room-type and contract lists, folio charge codes, and lookups on guest, banquet, and concierge screens have their own read keys. HOT-RBAC-01 stays API / SCREEN. AC-HOT-RBAC stays 🟡. Gate / BE / UI / Demo / Pilot / Sell unchanged.

**Closeout (2026-11-10 hotel catalog v7):** stored `admin:master_data` is removed and the row is hidden. Rate and lookup lists on a booking have their own read keys. Catalog GET no longer accepts reservation or folio read. HOT-RBAC-01 stays API / SCREEN. AC-HOT-RBAC stays 🟡. Gate / BE / UI / Demo / Pilot / Sell unchanged.

**Closeout (2026-11-10 settings screen pairing):** any catalog admin key opens `screen:settings`, not only `admin:master_data`. HOT-RBAC-01 stays API / SCREEN. AC-HOT-RBAC stays 🟡. Gate / BE / UI / Demo / Pilot / Sell unchanged.

**Closeout (2026-11-10 hotel catalog v6):** HOT-RBAC-01 stays API / SCREEN (not SHOW). Rates, seasons, yield, and the other settings catalogs are their own keys. Meal plans, booking sources, and the rack room list no longer use reservation read. `admin:master_data` is not checked. AC-HOT-RBAC stays 🟡. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-10 hotel catalog v5):** HOT-RBAC-01 stays API / SCREEN (not SHOW). Dispatch, migration registrations, room catalog, stock, hotel profile, and agency/company cards have their own keys. Passport scan is `api:guests.mrz`. Rates and yield stay on `admin:master_data`. AC-HOT-RBAC stays 🟡. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-10 hotel entity grants):** HOT-RBAC-01 stays API / SCREEN (not SHOW). `/settings/access` is an entity grid. Guest, banquet, concierge, tours, transfers, fleet, POS, and spa-place read no longer share `reservations.*`. Catalog v4 expands old grants once. AC-HOT-RBAC stays 🟡. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-09 sanatorium admit before check-in):** Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Same reservation card. The admit item shows on the arrival day only; a guest missing the check-in identity fields is refused with that field list under a sanatorium-admit title and is not checked into the hotel. HOT-FO-07 stays API, not a Demo or Pilot lift. `hotel.yaml` untouched. Needs migration `20261109160000_clinic_admitted_at`.

**Closeout (2026-08-04 UI deepen):** UI ✅ · Demo / TE ✅ (`reports/hotel-demo-te-signoff.md`). Scaffold BE remains ✅. Pilot lab/field open — do **not** claim GA; edition stays `mvp`.

**Closeout (2026-11-11 transfer+tour stay lifecycle + second-pass):** HOT-XFER-01 / HOT-TOUR-01 stay SHIPPED **SCREEN** (out of SHOW). Stay cancel auto; date ASK; early-out OUT only when early; RESERVED tour drop; card chips; stay-open readable with `reservations.read`. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index S-28 [x]; `hotel.yaml` untouched. `era-readiness-matrix` N/A.

**Closeout (2026-11-11 reservation list icons):** HOT-UI-01 stays SHIPPED. Car and laundry icons on `/fo/reservations`. No new Scaffold ✅. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-02 lifecycle outbox):** HOT-PKG-04 stays API. AC-HOT-PKG-PAX stays 🟡. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. `docs/editions/hotel.yaml` unchanged.

**Closeout (2026-11-05 compliment / house use):** Room and package nights post 0. Compliment credits posted lodging; house use credits the open folio. Early checkout does not reverse those credits. HOT-NA-01 and HOT-CO-04 stay SHIPPED. HOT-PKG-03 stays API. AC-HOT-PKG-COMPOSE and AC-HOT-CO-EARLY stay 🟡. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-10 in-house room swap):** HOT-FO-04 stays API. AC-HOT-AMEND stays 🟡. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-05 cross-class door):** HOT-FO-04 stays API. AC-HOT-AMEND stays 🟡. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-05 from-date plan CTA):** HOT-FO-04 stays API (label + layout only). AC-HOT-AMEND stays 🟡. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-05 checkout tables):** Category columns are a table; stay balance sits under the blocks. Sanatorium procedure chips are tables (open paid, and every procedure on the fact chip). Duplicate payment allocation is skipped. HOT-CO-01 stays SHIPPED. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-05 org payment methods):** Hotel desks consume orch Sync catalog (HOT-CASH-01 deepen). Catalog SoR is Platform CP-PAY-METHODS-01 API. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-05 department schedules):** HOT-DUTY-01 SCREEN/API (not SHOW). AC-HOT-DUTY 🟡 out of BE rollup. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index S-29 [~]; `hotel.yaml` untouched. Second-pass: `screen:schedules` page map + settingsAccess i18n + binding `orgUnitOptions` — no Gate/Demo/Pilot/Sell flip.

**Closeout (2026-11-07 guest phone polish):** HOT-GST-01 stays API. Guest card + contacts polish phone via kit `normalizePersonPhone` (toast needs_region/conflict/invalid; international never rewritten). AC-HOT-GST-PHONE 🟡. SCREEN deepen only — not SHOW. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-06 passport MRZ):** HOT-MRZ-01 is API. The scanner is a modal on the guest card and the stay guest row, platform super-admin only. AC-HOT-MRZ stays 🟡 (parser negative in `__tests__/mrz-parse.spec.ts`; UAT-SMOKE §2 3a open). Shared passport with a different name attaches that card and does not overwrite names. `GuestDocument.mrzNameField` stores the raw ICAO name; match order is raw MRZ → passport → exact name → translit/typo/metaphone (confirm-only). Catalog `hotel_passport_scan` is 19 AZN and is not entitled. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched. HOT-GST-01 stays API (dedup name fold + similar-name / metaphone groups stay confirm-only).

**Closeout (2026-11-09 MRZ crop fix):** HOT-MRZ-01 stays API / SCREEN (not SHOW). Crop selection no longer collapses to a point (pointer window listeners for mouse+touch; img not draggable; Read requires ≥8px + image load; file replace/close revokes blob; `mrz-crop-rect` suite). AC-HOT-MRZ stays 🟡 (UAT-SMOKE §2 3a still open). Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-10 MRZ PDF + skew):** HOT-MRZ-01 stays API / SCREEN (not SHOW). Scanner accepts photo or PDF (first page via pdfjs); crop has skew angle −45…+45 and samples a rotated region before OCR. Second-pass: Docker builder/dev copy `pdf.worker.min.mjs` (deps `--ignore-scripts`); unsupported file types and image decode errors toast and clear. AC-HOT-MRZ stays 🟡 (UAT-SMOKE §2 3a still open). Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index and `hotel.yaml` untouched.

**Closeout (2026-11-06 duty UX deepen):** HOT-DUTY-01 stays SCREEN/API (chip assign, week chrome, copy week, axes settings) — **not SHOW**. AC-HOT-DUTY 🟡. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. `hotel.yaml` untouched. Second-pass: copy replace guard + skip retired axes on copy + ops subtitles — no Gate/Demo/Pilot/Sell flip.

**Closeout (2026-11-10 schedules IA):** Schedules section moved last before Settings; HK roster only there; P2002-safe binding/axes/week seed; board settings collapsed; sidebar best-href for `/hk/roster`. HOT-DUTY-01 stays SCREEN/API — **not SHOW**. AC-HOT-DUTY 🟡. Gate ✅ / BE ✅ / UI ✅ / Demo ✅ / Pilot [ ] / Edition `mvp` / Sell unchanged. `hotel.yaml` untouched. Second-pass: kit `sectionOwnsBestHref` + week create race — no Gate/Demo/Pilot/Sell flip.

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
| Guest tours (HOT-TOUR-01) | `/tours` (grid+roster/edit modals), `/fleet`, `/settings/policies#tours`, bare print; card tour chip | SCREEN — boarding-first; RESERVED drop on early-out/cancel; room live. Out of SHOW. Stay-lifecycle 2026-11-11: Gate/UI/Demo/Pilot/Edition unchanged |
| Transfers (HOT-XFER-01) | `/transfers` + card chips; stay-preview/apply | SCREEN — stay cancel auto; date ASK; early-out OUT C; Airport = `?hasFlight=1`. Out of SHOW; Gate/Pilot/edition unchanged |
| B2B / MICE | `/distribution/contracts`, allotment, `/banquets*` | ✅ — icon actions; explicit party type; Cancel/Expire; terminal allotments read-only; gross/net + i18n; card room payer; FO sellable uses contract allotment when a quota row exists, else hotel inventory (`NO_ALLOTMENT_BAR`) with contract still tagged. Open debts SC-REST/DEP/REL — not claimed. Gate/Pilot/edition unchanged |
| Agency portal (extranet) | `/agency/*` + FO `/fo/agency-inbox` | SCREEN / 🟡 (HOT-AGP API; not SHOW — no Demo-TE) |
| HK / admin | HK MVP Dirty/Clean/Inspected, `/admin/*` | ✅ |
| Nafta HK deepen | `/hk` `/hk/rooms` `/hk/mobile` `/hk/roster` `/hk/rotation` `/hk/laundry` `/hk/forecast` `/hk/discrepancy` (+ closed-rooms, maids, minibar, consumption, `/fo/laundry`, `/settings/laundry-catalog`, policies#hk, policies#laundry) | SCREEN / 🟡 (not SHOW — UAT §34 open). Soft sort + room#; void IN_PLANT; laundry catalog + nullable prices + intake/due policy; FO amount; stay linen edit-only; maids edit/unlink; discrepancy create modal; playbook one-PRIMARY + filter bars; kit table/card shell (`rounded-2xl`). Closeout 2026-11-09 (settings menu only): Gate/UI/Demo/Pilot/Edition unchanged (rollup = Pilot open → mvp, not GA) |
| Passport MRZ (HOT-MRZ-01) | guest card scanner + stay guest row | SCREEN — super-admin only; PDF + skew angle 2026-11-10; not SHOW; UAT open. Does not move Gate, Demo, Pilot, or Sell |
| Guest phone app (HOT-GUEST-APP-01…10) | Guests tab link/orders/family/send-to-phone + `/fo/guest-requests` + `apps/guest-app` (screens/chrome/theme product shell) | SCREEN / 🟡 — field guest; UAT unsigned; not SHOW / not SHIPPED. Does not move Gate, Demo, Pilot, or Sell |
| Guest phone polish (HOT-GST-01) | guest card Identity draft + contact modal + save | SCREEN deepen — toast-only; not SHOW / not SHIPPED. Does not move Gate, Demo, Pilot, or Sell |
| Department schedules (HOT-DUTY-01) | Schedules (last before Settings): `/schedules` + `/hk/roster` + reception/security/engineering | SCREEN / 🟡 — WEEK_POST/WEEK_CREW; chip assign + week chrome + copy; settings collapsed; not SHOW; UAT §34b open. Does not move Gate, Demo, Pilot, or Sell |
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
