# ADR: clinic day-series week rhythm

## Status

Accepted (2026-10-17). Amended 2026-11-18 — joint Saxla plan, fact-based replan, series-owned policy, universal day-series admin. Amended 2026-11-20 — rhythm beats qty / stay-end packing (any mode N+R). Amended 2026-11-23 — continue: foreign cabin-day breaks hard-series streak.

## Context

Nafta wants five hard-series sessions in a Monday–Saturday week, rest no later than after three working baths, and iodine-bromine / hydromassage only on a day without naftalan. The package modal mini-calendar required a manual mode and blocked Saxla. A production miss (Galina): pin shift ignored rest/weekly cap after `same_day` with hydromassage. Day-series membership looked generic in admin while Saxla still chunked per SKU and Settings held “bath-only” rhythm UI.

## Decision

- **SoR for rhythm policy:** `ProcedureDaySeries` (`modeCode`, `weeklyCap` per series, `afternoonPinRetry`, `fillsRestDays`, members). Tenant `bathDayModesJson` / `defaultBathMode` / `weeklyNaftalanCap` remain **fallback defaults** and mode-template catalog in DB — not a separate Settings “Baths” chip (UI moved to Procedure rules → Day series).
- Mode precedence on an order: existing `physioFields.dayBlock` → series `modeCode` → tenant default.
- Saxla **plans all day-series SKUs of the save in one joint** `planBathSeries` pass (hard series first, then `fillsRestDays`), then seats cabins with a shared `CabinScanBag`. Non-series FIXED keep `orderScarceSeriesFirst`. OPEN unchanged.
- **Hard-series qty + kept (2026-11-19):** same-SKU live rows are locked kept and count in `qty` (`saxlaSameSkuKept`); layout `continue` so +1 does **not** hole-fill a gap between seated baths (Irina-class). `illegalHardSeriesBathYmds` / streak guard drops mode-illegal new pins on Saxla, `saveBathCalendar`, and pin replan. Repair: `era-clinic/scripts/repair-hard-series-rhythm.ts` (droplet applied; PROPOSED need Saxla reseat; past locked streaks stay).
- **Rhythm beats qty / stay end (2026-11-20):** hard-series packing never skips owed rest to squeeze more sessions into a short stay. Leftover qty stays unplaced (PROPOSED / miss). Mode is any N+R from the series catalog (`resolveBathBlock`) — not a bath-only special case. The same illegal filter applies on schedule recalc (`layout: continue`) and manual move (`slot-decision` streak gate). Unit matrix: short stay × excess qty must match the legal fit pack (not denser).
- **Continue + foreign cabin-day (2026-11-23):** a working day occupied by another bath SKU (hydromassage, iodine-bromine, other series) — or a gap between own hard-series baths — **breaks** the hard-series streak. It does **not** count as a virtual bath day of this series and does **not** earn the next calendar rest from a phantom N+R projection. Rest / illegal checks for fact and continue use `bathSeriesRestYmds({ countYmds })` over **own** bath YMDs only. Eldəniz-class: two own baths + hydro day → next own bath is legal (no double penalty). `fillsRestDays` series only **skip** an occupied day — they do not reset their own cadence when hard-series already holds the day. Fresh “every working day is a bath slot” projection (no `countYmds`) remains for legacy packing fixtures.
- Pin miss: morning → optional afternoon → **fact-based replan** of the unplaced tail from the first successfully seated day of that code (recomputed rest via mode+anchor + own `countYmds`; `nextLegalSeriesDay`; never land on rest / over weekly cap). Stay end (`scheduleBefore` / `endsOn`) caps search — not `last+21`.
- Manual move (`slot-decision`) uses the same rest recomputation, streak illegal gate, and **per-series** weekly cap.
- Iodine / hydromassage: seed series with `fillsRestDays: true`; orgs that deleted those series must recreate them in Day series admin for fills-rest behaviour. Otherwise they seat as FIXED and only package `same_day` applies.
- One rule kernel (`evaluateCandidateSlot`) for minutes. Closed clinic days from `listClinicDays`. Rest lives on `physioFields.restYmds` of live series orders (no `bath_rest` stubs).

## Consequences

- New Saxla runs use joint plan + fact-replan. Already seated courses are not rewritten until a new Saxla/reseat.
- Day series admin is the universal constructor (any procedure type, multi-select + chips).
- Full Nest HTTP codegen retirement remains P0 platform debt; this wave updates generated Zod/handlers as needed.
