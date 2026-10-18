# ADR: clinic bath week rhythm

## Status

Accepted (2026-10-17).

## Context

Nafta wants five naftalan sessions in a Monday–Saturday week, rest no later than after three working baths, and iodine-bromine / hydromassage only on a day without naftalan. The package modal mini-calendar required a manual mode and blocked Saxla.

## Decision

- Naftalan bath, application, and 4-chamber stay one day-series family.
- Iodine and hydromassage stay in the same package block (`SVC-VANNA`) and use `fillsRestDays`.
- Saxla plans all series together. Missing `dayBlock` uses tenant `defaultBathMode` (default `3`).
- A closed clinic day (`working: false`, including Sunday or a swapped weekend) spends an owed rest when `closedDaySpendsOwedRest` is on, otherwise resets an unfinished streak when `closedDayResetsOpenStreak` is on.
- `weeklyNaftalanCap` (default 5) limits the naftalan family per Baku Monday–Sunday week. 0 turns the cap off.
- The package-assign mini calendar is removed. Point edits stay on the course schedule.
- Cabin search must not pick a time without the guest's other orders. Bath days stay a policy; the slot is the same door as other procedures.
- Closed weekdays and clinic-day overrides come from `listClinicDays`. Physio and baths both refuse a `working: false` day. The resource matrix does not invent its own week.
- One rule kernel (`evaluateCandidateSlot`): auto search (`scanProcedureSlots`) finds the next legal minute; a manual PATCH accepts **that** minute or returns 409. No `nextWorkSlot` snap to Monday 09:00. Cross-day manual moves are refused.
- Bath rest days live on `physioFields.restYmds` of live series orders. `CANCELLED` / `bath_rest` stubs are not created.

## Consequences

- New Saxla runs use the new rest rule. Already seated courses are not rewritten until recalc.
- Contraindication naftalan → other physio is still out of scope.
- Reception drag / card time edit share the same refuse reasons as Saxla (cap, staff, closed day, guest gap).
