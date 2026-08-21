# ADR: Hotel shared twin assignment (share pool on one door)

**Status:** Accepted  
**Date:** 2026-08-20  
**Updated:** 2026-08-20 (ops-closeout: gender law, N beds, break share, HK); 2026-08-20 (Elektraweb cutover Excel/bridge pairing)
**Scope:** `era-hotel-pms` — union/Nafta FO assignment, inventory, room plan

## Context

Union can fill the hotel to 100% **by doors** while ~80% of guests are **singles**. Roommate matching by **gender** is mandatory. Stay dates **overlap but need not be equal**. OTA channels (Booking, Expedia, Exely) sell a **whole unit** — they never participate in share pools.

This is **not**:

- **Party billing** on one reservation (`ReservationGuest`, `partyBillingMode` PRIMARY/EQUAL) — one card, one check-in.
- **`shareNo`** — Elektraweb display label only; not an engine field.
- **Tenancy `SHARED` topology** — schema placement, not shared room.

Today `assertRoomFree` treats any overlapping OPTION/CONFIRMED/IN_HOUSE on `roomId` as exclusive conflict. `getAvailability` counts every Reservation as one door against `baseQuota`, which breaks union singles in twin inventory.

## Decision

Keep [hotel-booking-hierarchy.md](./hotel-booking-hierarchy.md):

```
Block → Booking (ReservationGroup) → RoomStay (Reservation, one person/voucher)
  → Assignment (roomId + share pool + shareBedIndex)
```

### Share is a door mode

- Opens when FO assigns the **first** share-eligible single to a door (explicit checkbox; default on for agency/union singles with M/F gender only).
- Pool gender = first guest gender; locked until the pool ends.
- Survives `n/maxBed` (waiting for roommate or after first checkout).
- Clears when the **last assigned** stay on that door leaves → `DIRTY`, normal room.
- Capacity: `Room.maxBed` / `RoomType.adultCapacity` (twin = 2, triple = 3, …). Same gender only on one door.

### Gender law (hard)

Share only when `Guest.gender` normalizes to **M** or **F**. Empty / unknown / any other catalog `GENDER` code → share **forbidden**; stay is exclusive (whole door). There is **no third share pool**. The system does not classify transgender status: FO clears «Подселение» when the guest must not enter an M or F pool.

`shareGender` is a **snapshot** at OPTION/CONFIRMED. Changing guest CRM gender does **not** rewrite `Reservation.shareGender` on live stays. Mismatch → break share / relocate / reject CRM change until pool is cleared.

Ungendered `shareEligible` does not consume inventory and must be refused on confirm.

### Hard gates

| Rule | Enforcement |
|------|-------------|
| Share only `adults=1` | Reject share when adults > 1 |
| Gender M/F required at OPTION/CONFIRMED | `shareGender` from `Guest.gender`; else exclusive only |
| Same gender only | Opposite gender rejected on same door / pool |
| OTA exclusive | `isOtaAgency` / channel ingest force `shareEligible=false` |
| Inventory at confirm | FIFO by booking time, not arrival; OPTION share consumes doors like CONFIRMED |
| Occupancy 2nd adult | Never applied across two independent share RoomStays |
| Capacity | `shareBedIndex` ∈ `1..maxBed`; pool full when count ≥ maxBed |

### Soft rules

- Warn when `agencyId` or `groupId` differs from pool neighbor (UI).
- Nafta union singles default share checkbox on **only** when guest gender is M/F (not walk-in BAR, not OTA, not ungendered).

### Schema (derived pool — no `RoomSharePool` table)

On `Reservation`:

| Field | Role |
|-------|------|
| `shareEligible` | FO opted into share assignment |
| `shareGender` | `M` \| `F` — locked copy from guest at confirm |
| `shareBedIndex` | `1..maxBed` after assign |

Pool state is **derived** from assigned share stays on `roomId` in OPTION/CONFIRMED/IN_HOUSE.

### Nightly door inventory

Per hotel night for a room type:

1. Exclusive stays (not effective share) = 1 door each.
2. Assigned share stays grouped by `roomId` = 1 door per occupied pool door.
3. Unassigned effective share: `ceil(countM / maxBed) + ceil(countF / maxBed)` virtual doors.
4. Sum > `baseQuota` → reject (T2: M confirmed consumes M-pool door; F rejected when no doors remain).

Sellable / channel push expose **exclusive doors remaining**, not beds. Two (or `maxBed`) share singles on one door **free that door** for BAR/OTA vs counting each stay as a door.

Occupancy reports: **doors %** = doors sold / quota; **guest nights** counted separately — never one unlabeled «sold».

### UI

- Reservation card: checkbox **«Подселение (share)»** on Stay/Assignment (not next to guest count); **Break share** when no overlapping roommate (else relocate first).
- Room plan: **N lanes** per door (`maxBed`); own arrow bars; room-number badge `♂ n/N` / `♀ n/N` (gender color on badge, bar color = status).
- Rack / chessboard: same badge; OCCUPIED door assignable for same-gender share when `occupied < maxBed`.

### Checkout / cancel / HK

- First share departure while roommate remains → room stays `OCCUPIED`; optional HK task notes «Share departure bed N, roommate remains» (not full DIRTY).
- Last assigned stay leaves door (checkout or cancel) → `DIRTY` + HK task; pool closed.
- Cancel of assigned CONFIRMED with roommate remaining does **not** DIRTY the door.

### Break share

`shareEligible=false` + clear `shareBedIndex` / `shareGender` when no overlapping share neighbor on the door. If a share roommate remains → 409 (relocate first).

## Elektraweb cutover (Excel + live bridge)

Elektraweb has **no share status on the primary guest**. Second guest only: Record Type `SHARE`, Room Count `0`, and/or FO list Room No suffix `707S`. Primary stays Record Type `NORMAL`, Room Count `1`, physical door `707`. Each guest keeps own dates, folio, Res Id. `ShareNo` is often empty — pair by **door + date overlap**, not ShareNo.

| EW | ERA |
|----|-----|
| `707` + `707S` (or both cards on `707`) | One `Room` `707`; two `Reservation` rows |
| Second: SHARE / RC=0 / `…S` | `shareEligible` + bed index; **pull** overlapping NORMAL neighbor into the same pool |
| Primary always NORMAL | Never treat NORMAL as “clear share” |
| After first checkout, FO flips remaining SHARE→NORMAL | Bridge/import **must not** clear `shareEligible`; pool stays share until ERA Break share |
| `Room Count=0` inventory hack | Not stored — door math uses share pool |
| Agency «Həmkarlar İttifaqı» | Hint only — **not** a trigger. Walk-in medical shares when EW marks the second guest the same way |

Nafta Excel list export (`11-Reservations.merged.xlsx`) currently has **no** Record Type / Room Count columns — cutover signal is **`Room No` ending in `S`** (52 rows) plus door pairing. Guests export **does** include `Gender` → `Guest.gender` for M/F lock. Re-import of reservations is idempotent on `externalRef` and **writes** share flags on already-loaded stays (including CHECKED_OUT history so door occupancy matches EW).

Code: `src/lib/integration/elektraweb-share-map.ts` (shared by Excel adapter + live bridge).

## References

- [hotel-booking-hierarchy.md](./hotel-booking-hierarchy.md)
- [hotel-fo-screen-chain.md](./hotel-fo-screen-chain.md)
- [hotel-elektraweb-import.md](./hotel-elektraweb-import.md) · [hotel-elektraweb-live-bridge.md](./hotel-elektraweb-live-bridge.md)
- Coverage: `HOT-FO-03` (API until UAT-SMOKE §30 UI signoff)

## Out of scope

- Agency AR / City Ledger / Exely ingest changes
- Auto-pairing OTA guest into union twin
- Door locks / keycards (external to ERA PMS)
- Virtual master room `707S` (never create)
