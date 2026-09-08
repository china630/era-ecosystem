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
2. **Right:** aggregations by assign batch / code — name, quantity, delete (when allowed). **COMPLETED** (consumed) rows are **grey, locked**, qty = consumed; no delete; quota does not return.
3. **`+` or edit:** form **overlays the right column** (drawer/panel inside the same modal) — type-gated physio fields, sites, note, **quantity**. [Done] on the form only updates **draft** on the right.
4. **Save (modal):** single commit — create/adjust orders, run placement, refresh balances and card schedule. **Cancel:** discard draft; DB unchanged.
5. **Reopen:** right side shows last committed state. Doctor may increase qty on an active right row, or use **All** (fill remaining for that line / selection), then Save → planner **incrementally** places only the delta (does not move fixed history).

### D3 — Quantity and field semantics

- Quantity **≠** one schedule card: `qty = N` means **N sessions**, planner spreads them (see D5).
- Right column shows **aggregates** (`Ozone ×7`); schedule zone on the card shows **per-slot cards**.
- One assign batch shares one field template (sites / physioFields / note). Same settings → edit qty on the right. Different clinical settings → new `+` from the left (second batch).
- Placement times are **automatic** (FIFO / incremental engine). No slot picker in the doctor form in this slice.

### D4 — Lazy assign replaces package pre-expand (amends CLI-31 UX)

For **in-package** treatment lines:

1. Instantiating a `ProgramInstance` still creates **balances** (`ProgramProcedureBalance`) from knots/nights (CLI-51).
2. System **does not** require expanding the full remaining quota into `PROPOSED` rows for the doctor to work (`buildProposedPlan` as the primary doctor UX is deprecated for this card).
3. Modal Save (package) creates the delta of orders and places them onto resources (same placement engine as today’s confirm path: incremental context, rotation, gaps).
4. Remaining on the left:  
   `R = quotaTotal − consumed − in_circulation`  
   where **consumed** ≈ COMPLETED (and any status product treats as burned), **in_circulation** ≈ committed non-completed scheduled/checked-in (and draft reserved only inside an open modal session). Exact status→bucket mapping is an implementation detail; product rule is: left never double-sells the same unit.

**Day-1 auto (replaces “confirm 2–3 from a long PROPOSED list” as the happy path):**

- A dedicated control (button/trigger), not silent on every open: schedule up to **3 distinct procedure codes** from the package in **standard** field defaults, then place.
- Soft-warn spirit of CLI-52 remains; do not hard-block larger manual batches without product revisit.
- Exam/intake sorting rules stay relevant only where intake still produces proposed/scheduled clinical exams — not mixed into this package menu (out of scope).

### D5 — Stay ↔ burn sync (max one per category per day)

Planner constraint for package (and default for extras unless overridden later):

- **At most one session per procedure code (category) per calendar day** for the episode.

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
  → PENDING_PAY on episode card only (dedicated “Additional” block)
  → NOT in resource schedule, NOT nurse-check-in-able

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
- **Over-quota / 4th same-day** (any package code count ≥3 that day): reception **Procedures → Add paid (same-day)** → `409 SAME_DAY_FOURTH_PAID` → confirm → folio post, `inPackage: false` (does **not** burn package quota). Do not treat as free in-quota.

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

### D10 — Non-goals (this ADR)

- Redesign of intake diagnostic / lab ordering UX.
- Final extras catalog control (category tree vs flat searchable) — searchable is v1.
- Changing knot math itself (CLI-51 `quotaFor`) except stay-shorten cancel of future slots and lazy-assign UX.
- Claiming SHIPPED / Pilot / edition `ga` — delivery wave + UAT required.

---

## Status model (informative)

Exact enum names are implementation choice; semantics required:

| Semantic | Package | Extra |
|----------|---------|-------|
| Draft in open modal | local only | local only |
| Prescribed, awaiting money | — | `PENDING_PAY` (card only) |
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
| Pay | All-or-nothing selected extras; `paymentReceiptRef` required |
| Walk-in | Hide package assign block; extras only |
| Replace | Autocomplete from/to; out-of-package → `PENDING_PAY`; FO manager (`api:procedures.fo_manager`) |
| Physio | Form overlay (package **and** extras) with sites/fields/**laterality**; params under names in modal + print |
| Qty | Right column `+1` (draft) and `−1` / delete → `adjust` `targetActiveQty` / `cancelAllActive` |
| CHECKED_IN | Locked in snapshot + API (`CHECKED_IN_LOCKED`); grey like COMPLETED for modal delete/qty↓ |
| Nurse | `mine=1` shows in-package or ticketed only; check-in `TICKET_REQUIRED` when `inPackage=false` |
| 4th same-day | Reception UI confirm → paid folio, `inPackage: false`, no package quota burn |
| Print extras | Field noise: **3× `window.open`** per procedure (`sheets=1&copy=1..3`); single open without `sheets=1` still prints 3 page-breaks |
| Legacy | `buildProposedPlan` no-op; hidden proposed checkbox UI removed |
| RBAC D7 | Reception may assign (`api:procedures.confirm`); FO manager permission for Replace out-of-package |

Not SHIPPED — UAT open (`era-clinic/doc/UAT-SMOKE.md` § CLI-57).
