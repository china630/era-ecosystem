# ADR: Episode procedure assign (package balance menu + paid extras)

**Status:** Accepted — implementing **SCREEN** (CLI-57). Not SHIPPED / not Pilot-ready.

**Date:** 2026-09-04

**Coverage:** CLI-57 — extends CLI-31 / CLI-51 / CLI-52 / CLI-55 / CLI-56 · extras path amends HOT-06 Issue-ticket order · nurse gate CLI-26

Related: [clinic-doctor-confirmed-fifo-planning.md](./clinic-doctor-confirmed-fifo-planning.md) · [nafta-program-quota-knots.md](./nafta-program-quota-knots.md) · [clinic-episode-as-clinical-course.md](./clinic-episode-as-clinical-course.md) · [clinic-episode-care-team.md](./clinic-episode-care-team.md) · [clinic-procedure-day-ops.md](./clinic-procedure-day-ops.md) · [clinic-cashier-ops.md](./clinic-cashier-ops.md) · [hotel-elektraweb-reverse-folio-post.md](./hotel-elektraweb-reverse-folio-post.md) · [sanatorium-vnext.md](./sanatorium-vnext.md)

---

## Context

Sanatorium treatment card (`Müalicə kartı` / episode card) today shows:

1. Compact **procedure quota** bars (`quotaUsed` / `quotaTotal` from `ProgramProcedureBalance`).
2. A flat **proposed plan** list: package instantiate → `buildProposedPlan` expands (nearly) all quota into `PROPOSED` rows → doctor checkboxes → `POST /api/procedures/confirm` → FIFO placement.

That UX forces a long scroll of same-named sessions (e.g. many ozone rows), conflates “remaining entitlement” with “already in circulation,” and treats paid extras with an Issue-ticket-first path that is easy to desync from guest consent and folio truth.

Product intent (Nafta ops, 2026-09-04):

- Doctors assign from a **package balance menu**, not from a pre-expanded PROPOSED sheet.
- **One Save** on the planning modal commits draft → planner; Cancel discards draft.
- **Additional (paid) procedures** are prescribed on the card but enter the schedule only after reception/hotel payment + ticket.
- Stay length and procedure burn stay roughly **1 code / category / day** so early checkout and quota recalc stay coherent.

Intake diagnostics / labs (`+ Lab`, ECG/USG intake, etc.) are **out of scope** for this ADR’s assign UI (separate card blocks).

---

## Decision

### D1 — Home surface: Müalicə kartı

Assignment and schedule live on the **episode treatment card** (opened from `/sanatorium`), not a separate screen.

| Zone | Role |
|------|------|
| Program line | `programCode`, remaining stay days |
| Quota summary | Existing progress bars — **read-only** compact view of package balance |
| Assign blocks | Two headings with `+`: **Procedures in package** · **Additional procedures** |
| Schedule | Stacked **cards** (one under another): date/time, name, status — not a second proposed checkbox list |

`+` opens the planning modal for that block. Card gates from CLI-55 / CLI-56 remain in force (care team, anamnesis, complaints where already required).

### D2 — Package planning modal (master–detail, one commit)

Single modal; **no nested second modal**.

```
┌──────────────────────────────────────────────────────────────┐
│  Procedures in package                         [Save] [Cancel]│
├────────────────────┬─────────────────────────────────────────┤
│ Left — menu        │ Right — assigned (committed + draft)    │
│ name · remaining R │ active: name · qty · delete / edit qty  │
│ from T · [+]       │ consumed: name · qty · grey locked      │
│                    │                                         │
│                    │  [optional form overlay on the right]   │
└────────────────────┴─────────────────────────────────────────┘
```

1. **Left:** package lines from `ProgramProcedureBalance` (and template names): procedure name, remaining count, `+`. Not an expanded session list.
2. **Right:** one card per SKU + quota + lock (not per assign batch). Title is `Name ×qty (draft)`; physio params each on their own line. **COMPLETED** (consumed) rows are **grey, locked**, qty = consumed; no delete; quota does not return. Card actions are compact icons (+ / − / replace / delete).
3. **`+` or edit:** form **overlays the right column** (drawer/panel inside the same modal) — type-gated physio fields, sites, note, **quantity**. [Done] on the form only updates **draft** on the right.
4. **Save (modal):** single commit — create/adjust orders, run placement, refresh balances and card schedule. **Cancel:** discard draft; DB unchanged.
5. **Reopen:** right side shows last committed state. Doctor may increase qty on an active right row, or use **All** (fill remaining for that line / selection), then Save → planner **incrementally** places only the delta (does not move fixed history).

### D3 — Quantity and field semantics

- Quantity **≠** one schedule card: `qty = N` means **N sessions**, planner spreads them (see D5).
- Right column shows **aggregates** (`Ozone ×7`); schedule zone on the card shows **per-slot cards**.
- Qty edits (+/−) and leftover drafts merge onto the same SKU card. Distinct physio params still appear as stacked lines on that card rather than splitting cards.
- Placement times are **automatic** (FIFO / incremental engine). Saxla seats **new** modal lines in add order (first row first); already `SCHEDULED` rows stay. A new in-package SKU past **that block's** daily distinct cap is `day_full`, not `no_staff`. Paid extras skip that cap. No slot picker in the doctor form in this slice.

### D4 — Lazy assign replaces package pre-expand (amends CLI-31 UX)

For **in-package** treatment lines:

1. Instantiating a `ProgramInstance` still creates **balances** (`ProgramProcedureBalance`) from knots/nights (CLI-51).
2. System **does not** require expanding the full remaining quota into `PROPOSED` rows for the doctor to work (`buildProposedPlan` as the primary doctor UX is deprecated for this card).
3. Modal Save (package) creates the delta of orders and places them onto resources (same placement engine as today’s confirm path: incremental context, rotation, gaps).
4. Remaining on the left:  
   `R = quotaTotal − consumed − in_circulation`  
   where **consumed** ≈ COMPLETED (and any status product treats as burned), **in_circulation** ≈ committed non-completed scheduled/checked-in (and draft reserved only inside an open modal session). Exact status→bucket mapping is an implementation detail; product rule is: left never double-sells the same unit.

**Day-1 auto is removed (2026-10-19).** The package opens after the therapist stage. There is no separate “fill today” button.

**Daily cap lives on the package block (2026-10-19), not on Tenant:**

- `ProgramTemplateProcedure.dailyDistinctCap` (1–12) on every block kind. Empty means **1**. The screen no longer hides the cell for massage or other kinds, and the code no longer substitutes physio 3 / bath 1 / paraffin 1.
- SatAdmin sets it on `/admin/program-templates`. The entitlement snapshot stores the same field for the open stay.
- Guest balance on a new course and on recalc (one course, all open courses, and a stay-date change) caps a per-night block at non-Sunday stay nights × that daily number, and never above the package knot. Per-stay blocks (labs, exams) keep the knot.
- When the stay days are full, Save asks whether leftover cabin rows go on checkout morning until 12:00. Open attendance is not moved onto a cabin for that question.
- A massage procedure (a type that has an active masseur skill) shows one masseur field on that line. Empty means any free skilled person. A surname keeps the pool to that person and the planner keeps searching later hours. Package sessions and paid sessions of the same procedure share the surname. Changing or clearing it reseats cabin rows in PROPOSED, SCHEDULED, and PENDING_PAY, including rows reception already moved. Open attendance keeps its day and only stores the name. A day where that masseur is absent is skipped. COMPLETED, CHECKED_IN, NO_SHOW, and CANCELLED stay.
- A paid extra does not spend the block's daily cap. The same procedure code still cannot be seated twice on one Baku day.
- A bath or paraffin **Əvəz et** writes `XFER-{predecessor}--{sku}` and spends the **predecessor** block's daily cap.

### D5 — Stay ↔ burn sync (max one per category per day)

Planner constraint for package (and default for extras unless overridden later):

- **At most one session per procedure code (category) per calendar day** (Asia/Baku) for the episode.
- **Daily in-package cap:** distinct in-package SKUs **of that block** on a Baku day (`dailyDistinctCap`; empty = 1). Paid extras (`inPackage: false`) do **not** count and may still land today. When the stay days are full, Save asks whether the leftover package rows go on checkout morning until 12:00. Same-code collision jumps the **whole next work day**, not +5 minutes.

Consequences:

- Lengthening stay → `recalcProgramQuotas` raises `quotaTotal` → left remaining grows → doctor All / qty↑ → Save places forward days only.
- Shortening stay → drop **future non-consumed** scheduled slots past the new end; return unused quota to the left. Do **not** silently delete COMPLETED. If consumed already exceeds new `quotaTotal`, surface **over-quota / pay** (rare if 1/day held).
- Package code change mid-stay: new left menu; prior assignments remain on the right (including grey consumed); orphan future lines handled per recalc rules (CLI-51 amended by explicit cancel of out-of-window SCHEDULED when stay shortens — see Consequences).

### D6 — Delete (package modal)

After Save has committed:

- Delete on an **active** right row (or qty decrease) removes corresponding **not-yet-consumed** plan slots immediately and returns quota to the left.
- **COMPLETED** never returns quota; stays grey locked.
- **CHECKED_IN:** product default for v1 — **lock** like consumed-in-progress (no silent delete from the modal). Force-cancel remains a separate ops path if already supported elsewhere.
- Manual **Replace** (contraindication / swap code): UI Replace control — cancel SCHEDULED of from-code → if to-code in package, re-assign; else `PENDING_PAY` extras (FO manager). Auto `ProcedureSubstitutionRule` in the engine may remain.

### D7 — Who may assign

- Package and additional **`+` / modal Save:** any role with `api:procedures.confirm` (defaults: **DOCTOR**, **RECEPTION**, **CLINIC_ADMIN**). Care-team / anamnesis gates still apply on the episode.
- Reception is **not** the clinical author of choice, but Nafta desk ops require reception assign access (manual same-day paid, package assist). Primary clinical author remains doctor on care team.
- Reception owns **payment / ticket / decline** for extras (D8), stay/folio ops, and **4th same-day paid** confirm.
- Out-of-package **Replace** requires `api:procedures.fo_manager` (CLINIC_ADMIN by default; grant FO managers via `/admin/access` — not seeded as a separate role).

### D8 — Additional (paid) procedures — prescribe ≠ schedule

Doctor/reception uses a parallel modal (**same chrome:** searchable list + **physio form overlay** + modal Save/Cancel). Prices are **mandatory** on every pending line (unit + muted total).

#### Lifecycle

```text
Doctor Save (extras modal)
  → PENDING_PAY on the episode card (dedicated “Additional” block)
  → Plan tab and guest print follow Tenant.extraProcedureRoute
    (default PLAN_BEFORE_PAY: seated on its own day and cabin, unpaid mark)
  → NOT in the resource schedule, NOT nurse-check-in-able until pay or folio

Guest declines explicitly
  → delete pending

Guest silent until episode end / hotel check-out
  → auto-purge unpaid pending

In-house guest agrees at clinic reception
  → select one or more pending → [Pay]
  → (1) post hotel guest folio
  → (2) place into schedule
  → (3) print extra ticket ×3
  → nurse may check in only with ticket/payment gate

Walk-in (no room reservation)
  → same intent, different channel: pay at **hotel cashier**
    (e.g. Tibbi Ambulator / house folio path)
  → only after paid → schedule + ticket ×3
```

#### Cancel after payment (not COMPLETED)

- **Primary ops:** clinic reception removes not-COMPLETED extra → clinic posts **folio reversal (−charge)** to hotel / bridge.
- **Hotel-initiated void:** hotel is money SoT; clinic must accept an inbound signal/block and remove schedule + invalidate ticket so folio and plan do not diverge.
- COMPLETED extras are not undone by clinic delete; refund policy stays hotel-side.

#### Same pipeline candidates

- True **à la carte** extras (extras modal → `PENDING_PAY` → Pay).
- **Paid extra** (no remaining package quota): reception or the extras modal posts `inPackage: false`. It does not use the block daily cap and does not burn package quota. Completing a seated in-package line does not flip it to paid because the day already holds other package SKUs.

#### Nurse gate

Reaffirm CLI-26 / HOT-06: check-in of a paid extra **without** issued ticket / cleared payment → **blocked** (`TICKET_REQUIRED` or successor). Unpaid pending never appears as a ready nurse slot.

#### UAT / HOT-06 order change

Prior lab path (Issue ticket first, charge timing loose) is **amended** for this product canon to:

**Pay (folio or hotel cashier) → schedule → print ×3.**

Issue-ticket UI may remain the reception surface, but the button semantics become **Pay / Confirm & print**, not ticket-before-money.

### D9 — Card schedule zone

Below assign/summary:

- Only **in-plan** procedures (package placed + extras after pay).
- Presentation: **cards stacked vertically** (datetime, title, status, optional access code / resource).
- Pending extras stay in the Additional assign block, not in this schedule list.

### D10 — Package pool codes (`PHYSIO_POOL` / `PARAFFIN_POOL`)

Nafta PDF lines **Fizioprosedurlar*** / **Parafin*** map to entitlement buckets (`*_POOL`), not `ProcedureType` rows.

| Rule | Detail |
|------|--------|
| Never assign pool as SKU | `ProcedureOrder.procedureCode` is always a real catalog code |
| Burn column | `ProcedureOrder.packageQuotaCode` = pool code (or same as `procedureCode` for dedicated lines) |
| Modal `+` / All on pool | **Visible with SKU picker** — FO picks a real ProcedureType; Save burns pool via `packageQuotaCode` / `burnPoolCode`. |
| `PARAFFIN_POOL` eligibility | Types whose code/name match `/parafin|paraffin/i` |
| `PHYSIO_POOL` eligibility | Active treatment types (`needsSite` or physio-ish `SVC-*`), excluding paraffin and excluding codes that already have their own non-pool balance line (Naftalan, ECG, labs stay on dedicated quotas) |
| Day-1 auto | Skips pool + quota-alias rows that need a SKU picker |
| Reject codes | `POOL_NOT_ASSIGNABLE`, `POOL_SKU_NOT_ELIGIBLE`, `ALIAS_SKU_REQUIRED`, `ALIAS_SKU_NOT_ELIGIBLE` |
| Assign menu scope | Treatment lines: pools (`PHYSIO_POOL` / `PARAFFIN_POOL`), `NAFTALAN_BATH` alias, `WO-TR-*` / `SVC-*`. Intake labs/exams filtered out. |
| `NAFTALAN_BATH` resolve | Prefer `SVC-NAFTALAN-VANNASI-KISI/QADIN` by patient sex; **fallback** `WO-TR-72` / `WO-TR-68` when SVC seed missing. Sex `UNKNOWN`/empty + both genders → modal SKU picker (do not auto-pick). |

Named package lines (e.g. Naftalan) do **not** burn `PHYSIO_POOL` — they keep separate `ProgramProcedureBalance` rows.

### D11 — Non-goals (this ADR)

- Redesign of intake diagnostic / lab ordering UX.
- Final extras catalog control (category tree vs flat searchable) — searchable is v1.
- Changing knot math itself (CLI-51 `quotaFor`) except stay-shorten cancel of future slots and lazy-assign UX.
- Merging Naftalan (or other dedicated lines) into `PHYSIO_POOL`.
- Claiming SHIPPED / Pilot / edition `ga` — delivery wave + UAT required.

---

## Status model (informative)

Exact enum names are implementation choice; semantics required:

| Semantic | Package | Extra |
|----------|---------|-------|
| Draft in open modal | local only | local only |
| Prescribed, awaiting money | — | `PENDING_PAY` (card; plan and guest print when `extraProcedureRoute` is `PLAN_BEFORE_PAY`) |
| On resources | `SCHEDULED` (+ later CHECKED_IN) | same, only after pay |
| Done | `COMPLETED` (grey in modal) | same |
| Removed before consume | cancelled; quota back | pending delete or paid reverse |

---

## Consequences

### Product / UX

- Müalicə kartı becomes the SoT surface for **entitlement summary + assign + schedule cards**.
- Doctor cognitive load shifts from “confirm a wall of PROPOSED” to “pick from remaining + Save”.
- Reception owns guest consent and money for extras; doctor owns clinical prescribe.

### Engineering

- New/adjusted APIs: package assign commit (delta qty + fields → place); extras prescribe (`PENDING_PAY`); reception Pay (folio/cashier channel → place → ticket print); stay-shorten cancel future slots; episode-close purge unpaid extras; folio reverse on clinic cancel; inbound hotel void hook.
- Deprecate primary reliance on full `buildProposedPlan` for package doctor UX; keep placement engine (`placeConfirmedProcedures` or successor) and FIFO/rotation rules.
- Amend [clinic-doctor-confirmed-fifo-planning.md](./clinic-doctor-confirmed-fifo-planning.md): PROPOSED pre-expand is no longer the package happy path; day-1 auto button + lazy assign replace checkbox confirm-all-prefix UX.
- Amend extras UAT vs HOT-06 Issue-ticket-first ordering.
- RBAC: `api:procedures.confirm` for assign Save (doctor + reception defaults); `api:procedures.fo_manager` for out-of-package Replace; reception Pay/decline; nurse ticket gate.
- i18n az/ru/en for new strings; module-map routes when APIs land.
- Acceptance: new CLI-57 row + Implementation / Product-Readiness updates when SCREEN; COVERAGE actor columns; UAT-SMOKE UI paths for package Save, day-1 auto, extras Pay→print, nurse block, checkout purge.

### Risks

- Draft vs committed confusion if Save/Cancel not obvious — mitigate with disabled background card edits while modal open.
- Folio/bridge failure mid-Pay — transactional order: no schedule/print without successful charge enqueue/ack policy (document dual-run failure UX).
- 1/day rule vs existing rotation/substitution — planner must compose rules without double-booking same code same day.

---

## Implementation waves (suggested)

| Wave | Scope |
|------|--------|
| W1 | Card chrome: two assign blocks + keep quota bars; schedule as stacked cards; hide/retire proposed checkbox list for package |
| W2 | Package modal (D2–D6) + Save commit + day-1 auto + stay-shorten future cancel |
| W3 | Extras prescribe + PENDING_PAY + prices; reception Pay→folio→place→print×3; walk-in cashier channel; nurse gate; checkout purge |
| W4 | Folio reverse + hotel void inbound; Replace stub; over-quota into same Pay pipeline; UAT + acceptance closeout |

---

## Alternatives considered

1. **Keep full PROPOSED expand + confirm prefix** — rejected for package UX (scroll tax); engine may still use intermediate statuses internally.
2. **Per-row Save immediately SCHEDULED** — rejected; Cancel must nullify an editing session.
3. **Nested modal for procedure template** — rejected in favor of right-column overlay inside one modal.
4. **Ticket before payment** — rejected; money/consent first, then capacity and print.

---

## Amendment 2026-09-04 — hardening (SCREEN)

| Decision | Detail |
|----------|--------|
| `inPackage` | Explicit boolean on `ProcedureOrder` (not `amountNet <= 0`) for package vs paid |
| Pay | All-or-nothing selected extras; one system receipt `yyyymmdd-xxx` per Pay click (not typed) |
| Walk-in | Hide package assign block; extras only |
| Replace | Bath leftover → in-package `XFER-*` + contraindication (`/transfer`). Seated in-package swap still `/replace`. Out-of-package seated swap → `PENDING_PAY` (FO manager) |
| Physio | Form overlay (package **and** extras) with sites/fields/**laterality**; params under names in modal + print |
| Qty | Right column `+1` (draft) and `−1` / delete → `adjust` `targetActiveQty` / `cancelAllActive` |
| CHECKED_IN | Locked in snapshot + API (`CHECKED_IN_LOCKED`); grey like COMPLETED for modal delete/qty↓ |
| Nurse | `mine=1` shows in-package or ticketed only; check-in `TICKET_REQUIRED` when `inPackage=false` |
| 4th same-day | Reception UI confirm → paid folio, `inPackage: false`, no package quota burn |
| Print extras | Field noise: **3× `window.open`** per procedure (`sheets=1&copy=1..3`); single open without `sheets=1` still prints 3 page-breaks |
| Legacy | `buildProposedPlan` no-op; hidden proposed checkbox UI removed |
| RBAC D7 | Reception may assign (`api:procedures.confirm`); FO manager permission for Replace out-of-package |

## Amendment 2026-09-07 — package pools (SCREEN)

| Decision | Detail |
|----------|--------|
| Pool codes | `PHYSIO_POOL` / `PARAFFIN_POOL` are entitlement only (D10); never `ProcedureOrder.procedureCode` |
| `packageQuotaCode` | Orders store which balance line was burned; `syncQuotaUsed` counts by this field |
| Modal | **Pool rows hidden** from left menu (named SKUs only). Legacy pool burn helpers remain server-side |
| Errors | `POOL_NOT_ASSIGNABLE`, `POOL_SKU_NOT_ELIGIBLE` |
| Day-1 | Skips `isPool` balance rows |
| Assign menu filter | Superseded 2026-10-22: snapshot membership + **Show in procedures**, not a code list |

## Amendment 2026-10-18 — bath quota transfer (SCREEN)

Unused **bath / naftalan / application** remaining (`quotaTotal − consumed − CHECKED_IN`) may move to another treatment SKU as **in-package** remaining (`ProgramProcedureBalance` `XFER-{sku}`).

- Does **not** auto-seat. Staff add from left block **Əvəz edilmiş prosedurlar** and Save as usual.
- COMPLETED / CHECKED_IN / IN_PROGRESS baths cannot be written off; only leftover + SCHEDULED/PROPOSED (cancelled when needed).
- Mandatory contraindication: `PatientContraindication` `FULL_BODY` + reason note + `createdAt`. Chief-doctor consent stays paper-only.
- Not a folio extra and not admin naftalan→iod-brom substitution.
- Route: `POST /api/sanatorium/episodes/[id]/package-assign/transfer`.
- Night package recalc must not shrink `XFER-*` lines. Paid extras refuse while `XFER-{sku}` remaining exists (`QUOTA_REMAINING`).

Not SHIPPED — UAT open (`era-clinic/doc/UAT-SMOKE.md` § CLI-57).

## Amendment 2026-10-22 — procedure list is a block checkbox (SCREEN)

The left menu and the package-tab quota bars list a balance only when that code is in the course entitlement snapshot and `showInProcedures` is true, ordered by `procedureOrder`. A transferred remainder (`XFER-`) stays under **Əvəz edilmiş prosedurlar**. A balance left behind after a block left the template does not appear.

`+` and **Hamısı** follow the block's fulfillment: `PROCEDURE_ORDER` keeps the cabin planner and the physio form; `LAB_ORDER` creates a lab order for the in-quota quantity (one open order); quantity above that quota is an unpaid procedure on the cheque list, not a second lab order, and only when the lab has a catalog price. `VISIT` creates a visit line. Save rejects a code that is not on that list (`NOT_IN_PROCEDURES`). The assign list shows a block when the current template checkbox is on.

The quota-block editor shows the name, the checkbox, and a procedure-list order. The block code stays the stored key (`BLK-…` for a new block) and is not printed. Night-matrix `sortOrder` is unchanged.

Recalc deletes a dropped balance only when `quotaUsed` is 0 and no procedure, lab, or visit line stamps that code. Used leftovers stay in the database and stay off the screen. They are also off the SKU picker: Save and replace burn a block only when that balance is on the procedure list. A leftover `*_POOL` must not become `burnPoolCode`. Migration `20261022160000_block_show_in_procedures` backfills the flags from fulfillment and strips the nine removed `*_POOL` codes from snapshots and unused balances.

## Amendment 2026-10-22 — unpaid extra route (SCREEN)

D8 “card only” is superseded for visibility. `Tenant.extraProcedureRoute` defaults to `PLAN_BEFORE_PAY`: the unpaid extra is seated, on the Plan tab and the guest sheet with its time and room, and on the nurse board as a red unpaid block. Check-in and QR stay closed until pay. `HOLD_UNTIL_PAY` hides the row until pay. See [clinic-extra-procedure-route.md](./clinic-extra-procedure-route.md). Amended 2026-10-25.
