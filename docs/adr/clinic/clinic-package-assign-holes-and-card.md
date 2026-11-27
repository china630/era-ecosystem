# ADR: Package assign card layout, package-first extras, bath holes ask

## Status

Accepted — 2026-11-24 (amended 2026-11-25: `MODAL_FULL_FILL` visual size; unpaid trash; unified stepper; four stay marks; locale-only params; dirty honesty; amended 2026-11-27: gray = seated total, blue Paketdən = package fact, no preserveGoals after Saxla)

## Decisions

### Card chrome

Each procedure card keeps a **gray seated** circle on top (package fact + unpaid + paid already on the plan). Below:

1. **One** stepper (− N +) for the lane (working total before the next Saxla; after Saxla clears to seated — no `preserveGoals`).
2. While package remaining for that SKU/pool > 0, +/− adjusts **package** qty (burns package quota).
3. When package rem = 0, the **same** stepper adjusts **paid extras**.
4. **Paketdən** — package **fact** only (blue circle / number, no ±; not draft goal).
5. **Əlavə** — unit and sum on **one** line + unpaid red circle (no ±).
6. **Trash** — unlocked package **or** unpaid extras (draft/pending). Clears unpaid for the lane (Saxla removals) and/or package `pendingCancel`. Hidden only when unpaid qty = 0 and package is locked/absent (locked + unpaid still trashes unpaid). Stepper − remains for qty peel.

Lane order is stable (first stay-plan mark day, then name). Do not hide a wiped card when kept/past sessions remain.

Catalog accordions below are only for adding a SKU that is not yet a card (with physio). They do not replace the card stepper for qty.

### Package-first paid extras

Paid extras only when **no** remaining package quota for that SKU/pool. `prescribeExtras` throws `QUOTA_REMAINING` whenever `remainingPackageQuotaCode` is non-null. The unified stepper must not create extras while rem > 0.

### Bath holes (continue vs fresh)

Before Saxla, if a day-series line is being increased and the stay has empty working days **before** the last seated package bath of that code, ask once:

- **Add at the end** → `bathLayout: continue` (default)
- **Replan unfinished** → `bathLayout: fresh` (unseat future movable same-SKU day-series, replan with `layout: "fresh"`)

Dialog order: start-course → holes ask → Saxla → checkout-morning ask. Never merge holes with checkout.

### Replace / transfer

`Əvəz et` must collect **target SKU physio/sites** (same gates as a normal assign). Transfer remainder keys (`XFER-…`) are **burnPoolCode / quota keys only**, never `procedureCode`. Clicking a transfer remainder opens the real SKU form with `burnPoolCode` set. Backend rejects or normalizes a bare `XFER-*` procedureCode (not `UNKNOWN_TYPE`).

### Modal chrome

Package assign uses **`MODAL_FULL_FILL_CLASS`** (`!min-h` + ~92vh) with `overlayPaddingClass="p-2"` for visual near-fullscreen fill (not hotel `MODAL_FULL` classname alone), and `lg:grid-cols-[2fr_3fr]` (~40/60). Stay-day grid and procedure-load heat share **`stayWindowDays`** (check-in−1 … checkout+1), the same column-width formula, in-table month names (Noyabr/Dekabr), and **one** horizontal scroll parent: heat is flush under stay (no border/title gap; load omits a second day header). Heat low→high and stay mark legends sit **below** that block.

Stay marks are four tones: package / unpaid extra / paid extra (`paidAt`) / done — unpaid extras must not share the package colour. When package and extra share a day/regime cell, show the strongest tone (done > paid > unpaid > package). Heat does **not** tint stay-cell backgrounds (keeps mark colours readable).

Card param lines are **UI-locale only** (no `az (en)` echo) for this modal. Discard/Saxla dirty state is draft/cut/masseur only — open form or replace panel alone does not ask to save.
