# ADR: Reservation card IA and party operations (Depart guest / Move guest / Swap)

**Status:** Accepted. Implementation waves W1–W6 landed as engineering API/SCREEN (not SHIPPED until UAT §43/§44).  
**Date:** 2026-09-10  
**Scope:** `era-hotel-pms` reservation card; `era-clinic` episode lifecycle on person-level depart/move; orchestrator hotel→clinic events

**Does not ship product readiness.** Do not Scaffold-green new AC rows from this ADR alone. Coverage IDs for new verbs are assigned at planning, not here.

## Context

FO compared the ERA reservation card with OPERA Cloud / Elektraweb. The card already matches the intended **two-pane** hotel chrome (`ReservationCardEditor`: left stay form, right Guests / Pricing / Folio / Notes, booking stays bar, bottom chips). Pain is **density and grouping**, plus missing **person-level** ops.

Three occupancy situations were conflated in Opera-inspired write-ups; ERA keeps **four** door situations:

1. Couple / family **in one room** — one product, several people; one guest may leave days earlier.
2. Union **open share pool** — two+ independent stays on one door, **same gender**, further same-gender singles can join until `maxBed`.
3. **Closed pair** on a share door — two independent RoomStays, one door, `adults=1`, **opposite gender allowed**, independent payers/dates (Nafta: union voucher + walk-in, e.g. husband/wife on 402). While **both live**, no third guest. After one **stay** checkout, the survivor is an **open** same-gender pool (`shareEligible` + `shareGender`). Not Depart guest, not Break share as “wife left”.
4. Family **on two (or more) rooms** — one booking envelope, several doors; people move between those doors.

Opera often models “two adults in a room” as **two Reservation IDs + Share**, because their atom is a **confirmation** (rate, folio, status, voucher). ERA’s atom is already [hotel-booking-hierarchy.md](./hotel-booking-hierarchy.md): **RoomStay (door + charged product) → party (`ReservationGuest`) → Booking (`ReservationGroup`)**. Copying Opera Share onto a **household couple on one product** still collides with party occupancy (Depart guest, not two contracts). The Nafta **two-contract** M+F hold on one door is a separate world (**closed pair** in D1), not Opera Share-as-spouse.

Clinic today: [nafta-episode-per-pax.md](./nafta-episode-per-pax.md) opens **one episode per pax**, but [clinic-episode-as-clinical-course.md](./clinic-episode-as-clinical-course.md) D5 still closes **every** OPEN episode on `SATELLITE_HOTEL_GUEST_CHECKED_OUT` for the reservation. Stay-level checkout of a companion would wipe the remaining guest’s course.

## Decision

### D1 — Occupancy worlds (hard)

| World | Inventory object | People | Independent dates | ERA mechanism |
|-------|------------------|--------|-------------------|---------------|
| **Exclusive party** | One RoomStay, one door | `ReservationGuest` (primary + companions, children bands) | **Depart guest** (new) | Not share. Opposite gender / `adults > 1` stay exclusive. |
| **Open share pool** | One door, **N RoomStays** | One adult per stay, **same** M/F pool | Already: checkout **that** stay | [hotel-shared-twin-assignment.md](./hotel-shared-twin-assignment.md). Break share ≠ spouse early departure. |
| **Closed pair** | One door, **exactly two** RoomStays | One adult each, **opposite** gender | Stay checkout of one opens the pool | FO: tick share, then pick the occupied share door (door list must not hide it as exclusive conflict). EW SHARE / `isSecond` maps the same. Plan/rack: **own name only**; no ♂/♀ room badge while mixed. Do not merge into one party card. |
| **Booking / family rooms** | N RoomStays, N doors | Party **per stay** | Per stay + Depart guest | `ReservationGroup` + `ReservationCardStaysBar`. Not connecting-room inventory. Not a second “linked reservations” entity. |

Do not use share assignment, Break share, or auto-share to implement couple early departure or child room change. Do **not** auto-share an exclusive family stay into a closed pair.

**Two Reservation IDs on one door** remain valid when each stay is an independent contract (union voucher, two payers, EW SHARE row, **or** FO closed pair). Household occupancy stays one RoomStay + pax.

RoomStay means **one door / one charged product**, not “one person”. The hierarchy ASCII “one person/voucher” is historical; party on a stay is canonical.

### D2 — Do not clone Opera Cloud chrome

Copy Opera **laws** (independent guest departure, occupancy from a date, HK stayover vs DIRTY, person-scoped clinic/meal). Do **not** copy:

- Three-column layout (Stay Details \| tab grid \| Quick Actions rail). ERA: `lg:grid-cols-[2fr_3fr]`, `MODAL_FULL_CLASS`, one ModalShell chrome (`era-hotel-pms-ui.mdc`). Header/footer + existing bottom chips stay the action cluster.
- “Zero scroll” as a hard constraint. Nafta fields (four child bands, share-twin, sales contract, agency vs company) may still overflow; **density and grouping** are mandatory, literal no-scroll is not.
- Opera Share as the couple model (see D1).
- A Linked Reservations module beside `ReservationGroup`.
- Dragging a guest onto an arbitrary occupied door with “create share” (M+F **open pool** and family parties are exclusive; closed pair is FO assign of a second **share-eligible** single, not DnD).
- Merging `agencyId` and `companyId` ([hotel-agency-vs-company-profiles.md](./hotel-agency-vs-company-profiles.md)).
- Opera Source codes (DIRECT/WEB/GDS) as ERA `BookingSource`. ERA Source is **sell path**: `WALKIN` / `AGENCY` / `BOOKING` / `CORPORATE`. Do not use source code `COMPANY` (that is a folio type).

RTC (room type to charge) stays distinct from **booked** `roomTypeId` and **given** `givenRoomTypeId` ([hotel-stay-amendment-and-pricing.md](./hotel-stay-amendment-and-pricing.md)). UI may label all three; do not collapse them.

### D3 — Reservation card information architecture (target)

The card is a **stay card** (this door + this product). People and sibling rooms are first-class, not extra `FieldPanel`s.

**Header (always visible)**

- Primary guest name in **ModalShell title** (VIP optional suffix); status + short id in **subtitle** only — do not repeat identity above the money strip.
- Financial snapshot: stay total · deposit · guest folio balance (danger if debt). Occupancy chip only for **share** or **multi-room booking** (not for default 1-room exclusive).
- Stay actions: **icon** header cluster (Attach / Lightning / History / Menu→Print+Lock); Save + **room** check-in in footer. No duplicate Print. Room check-out and key encode remain out of scope until FO-primary.

Occupancy hint: exclusive vs share vs booking with N rooms — StaysBar is a **thin GRP strip** for 1 room; full family navigator only when sibling stays > 1.

**Left rail — grouped Stay Details (fewer panels, dates with times)**

| Block | Fields |
|-------|--------|
| Stay window | Row 1: check-in **date+time** + nights. Row 2: check-out **date+time** + **one** plane under nights: today = CI → red landing; today = CO → red takeoff; `IN_HOUSE` and today strictly between → yellow takeoff **button** (stay early checkout, unused nights / folio path). Not both icons. Room check-in stays footer. |
| Room | **Room type** = charge (Pricing / night audit). **Given room type** = physical category for **Room no.** list (empty → same as Room type). **Room no.** doors of physical category + HK badge slot always reserved. Changing Given clears an incompatible pending door; check-in requires the **assigned** door to match physical category (UI + API). Share checkbox / Break share (share world only). |
| Pax & board | Adults + three child bands on one row; meal plan (`MealPlan` rows; board codes `RO` / `BB` / `HB` / `FB` / `AI` are ensured per org, same codes as lookup `ACCOM_TYPE`). Stay-level package/rate lives in Rate & source. Medical package **per pax** is not an in-grid `CatalogField` on Guests. |
| Rate & source | **Source** = sell path. Reception picks only **Walk-in** (`WALKIN`), **Agency** (`AGENCY`), **Corporate** (`CORPORATE`). **OTA** (`BOOKING`; channel ingest codes like `EXPEDIA` resolve to it) and **Website** (`WEB`, IBE) are stamped automatically and only shown when already on the stay; agency-portal bookings stamp `AGENCY`. When `sourceId` is empty but the stay has an agency row, the card infers the source from that row: OTA agency (`EXPEDIA`, `BOOKING.COM`, `EXELY.COM`) → OTA; Nafta walk-in rows (`WALKIN MEDICAL`, `Premium paket Walkin`, any `WALK-IN` in code/name) → Walk-in; any other agency → Agency. Walk-in rows are not travel agents: they are hidden from Agency/OTA pickers, offered as an optional **Walk-in profile** under the Walk-in source, and **kept** on save (`persistCounterpartyIds` `agencyIsWalkIn`) because medical package SKU rules match on the agency name. The Elektraweb bridge fills an empty `sourceId` from the same agency inference on sync (never overwrites a source set at reception). OTA detection matches `OTA` as a word only (not `Kota`). A stored agency/company outside the current filter stays visible as its name, not as a raw id. Counterparty pickers are kit `SEARCHABLE` autocompletes showing the agency/company **name** only. **Agency contract** vs **Company contract** by `SalesContract.counterpartyType` (one `salesContractId`). Market, segment. Rate/package. Optional Company on agency/OTA/walk-in is City Ledger only — does not swap the contract list. |
| Billing summary | Payment method, credit limit, **one-line** routing (GUEST / AGENCY / COMPANY). Full routing editor stays the existing submodal. |

Collapse rare Elektraweb residue (option date/state, preferred bed/view, color) in Additional. Truncate or hide per-field hints that double vertical rhythm.

**Layout chrome:** near-fullscreen (`MODAL_FULL_CLASS` ≈ 99vw); body **`lg:grid-cols-[2fr_3fr]`** (~40% left / 60% right).

**Right**

- Tabs unchanged: Guests · Pricing · Folio · Notes.
- Guests: compact party grid; **no** PRIMARY/EQUAL billing mode chrome (1 guest → obvious folio; multi → named sections on Folio).
- Folio: All / Guest / Agency / Company; when party > 1, **named guest folio sections**.
- Booking stays bar: thin GRP for single door; family navigator when N>1.
- Bottom chips (card, packages, tasks, folio routing) stay; do not duplicate under Guests only.
- Guests grid: compact party table; row menu for D4/D5. Pin a short specials strip (VIP type, trip reason, bed preference, voucher, allergies) under the grid — VIP/trip are person/visit, not Rate & source.

Assignment (physical door, lock, assign, share, early/late) **merges visually** with Room + Stay window; the `showAssignment` **gate** for mutating the door may remain CONFIRMED+, but **times** are not gated.

### D4 — Depart guest (exclusive party; planned verb)

**When:** IN_HOUSE exclusive stay; companion (or primary with a remaining in-house pax) leaves before stay `checkOutDate`.

**Must:**

1. Mark that `ReservationGuest` departed (`departedAt` or equivalent). Do not delete the row (history).
2. Keep RoomStay `IN_HOUSE`. Inventory door stays occupied. Plan/rack must not free the room.
3. From departure hotel date, occupancy counts drop (adults/children) and remaining **unlocked** nights recalc per [hotel-stay-amendment-and-pricing.md](./hotel-stay-amendment-and-pricing.md) (posted nights untouched; occupancy-driven sell from effective date). PRIMARY: default leave room&tax on the stay folio; optional folio split of charges tagged to that pax. EQUAL: close that guest’s GUEST folio (same idea as H-BL-45) before the person is departed.
4. HK: stayover / pickup (one bed), **not** full DIRTY / post-checkout — unless this was the last in-house person (then normal `checkoutReservation`).
5. Clinic/meal: cancel or archive **that person’s** future unused package/procedures. **Forbidden:** emitting stay-level `SATELLITE_HOTEL_GUEST_CHECKED_OUT` while other pax remain in-house.

**Must not:** Break share; create a second RoomStay on the same exclusive door solely to reuse `checkoutReservation`; check out the stay.

Share-world early departure of a roommate is **existing stay checkout** + `releaseDoorAfterShareDeparture`. Do not route it through Depart guest.

UI: Guests row action **Erkən çıxış / Depart guest** → modal (actual date-time, folio option, occupancy preview). Header Check-out remains **room** checkout when the last in-house guest leaves.

### D5 — Move guest and Swap rooms (booking world; planned verbs)

**Move guest:** reassign a live `ReservationGuest` from RoomStay A to sibling RoomStay B in the **same** `ReservationGroup`. Update occupancy on both stays from an effective date (D4 pricing law). Do not offer “any door in the hotel” as the primary path (that is relocate of a stay or a new stay). Connecting rooms are an inventory attribute, not this verb.

Clinic: episode stays the same clinical course (`globalPersonId` / `paxKey`); update `reservationId` / `hotelStayId` / room for folio routing. Do not close the episode. Prefer a person-scoped room/stay move event over stay-level checkout. Meal/package that are **pax-owned** follow the person; stay-level meal on B is not silently the child’s board.

**Swap rooms:** exchange `roomId` (and given-type if needed) between two relocatable stays. Do not rewrite folios or nightly rates. Compose two `relocate` operations with a swap-aware conflict rule (today relocate to an occupied exclusive door fails). Plan DnD already moves **a whole stay**; Swap is the explicit two-stay action.

**Out of this ADR:** key encoder; restaurant bracelet room display (follow `globalPersonId` + current stay room once Move exists).

### D6 — Clinic and events (amendment)

[nafta-episode-per-pax.md](./nafta-episode-per-pax.md) §5 and [clinic-episode-as-clinical-course.md](./clinic-episode-as-clinical-course.md) D5 remain correct for **stay checkout** (last guest / whole RoomStay `CHECKED_OUT`).

**Amend when D4/D5 land:**

- Depart guest → close/cancel **that pax’s** OPEN episode only (`paxKey` / `globalPersonId` / `patientRefId`).
- Move guest → retarget episode stay/room; no close.
- Introduce or extend a hotel lifecycle payload so clinic can distinguish stay checkout vs person depart vs person move. Do not reuse stay `GUEST_CHECKED_OUT` for companion departure. Contract change belongs in `docs/INTEGRATION_SSO_EVENTS.md` in the same implementation PR.

Share: two reservations → two episodes; unchanged.

### D7 — Implementation order (intent)

1. Card IA (D3): header snapshot, stay window+times, HK badge, fewer left panels, compact Guests — **no new verbs**.
2. Depart guest (D4) + clinic person-scoped checkout.
3. Booking bar as family navigator.
4. Move guest (D5) within group.
5. Swap rooms.
6. Keys / HK pickup polish.

## Commercial strip (2026-10)

The card columns are 40/60. The left column opens with one row above the dates: source, agency, company. A plus at the end of the agency or company field opens a short profile under that field only (agency: name and phone; company: name and VÖEN). The contract and the free-text contract number appear on the next row only after an agency or a company is chosen. The nights field uses the native number spinner. The package stays with the room type. Booker, paid-by, and folio stay in the billing block.

Source at the desk is Walk-in, agency, or online. Walk-in is not renamed. Company is not a source: both profiles can be filled, and choosing a company does not hide the agency. A stored corporate source still opens with the company filled and the agency lookup available. One stay has one sales contract, taken from the profiles already chosen; it sets the rate and the allotment and does not clear the other profile.

If the profile is missing, the desk creates a short one: agency name and phone, or company name and VÖEN. That row is incomplete. Commission, settlement terms, and the contract are edited only in the agency and company directories.

## Reservation card desk rules (2026-10)

Front-office card behavior that the services and the editor must keep:

- **Create** persists the whole party (names, DOB, passport, FIN, sex, nationality, medical package code), child age bands, room, market, segment, VIP, trip reason, booker, guest representative, paid-by, voucher, external res no., notes, manual nightly rate, and discount. A typed name is not a guest until it is picked from search. The required-field message names what is missing. Create always stores `shareEligible: false`. Share is a human tick on a saved stay with exactly one adult.
- **Primary guest** is a yellow star. Other adults are gray stars. One adult cannot drop the star. A minor (age from date of birth, under 18) has no star and cannot be primary. Making a gray star primary sets `PRIMARY` billing and that adult’s folio. Clearing the yellow star is allowed only when nobody is under 18; billing becomes `EQUAL` and each adult owns a folio. Child counters do not by themselves mark a row as a child.
- **Medical package** on each guest is the sold rate plan (`PKG-*`) when notes and the agency profile do not name a package. Notes still win over the rate-plan code.
- **Package vs room type.** Changing the charge room type does not clear the package. If the package is scoped to another room type, the card keeps it and offers three covers: guest pays the higher nightly (sold vs the peer medical plan for the new type), guest pays the lower, or the hotel keeps the sold price and records a price note.
- **Night grid.** The first row is the check-in night. `manualFlag` means a desk override, not “this night is in the past”. A night is closed when it is before the open business date or already has a posted room / package / rate-adjustment charge. Future nights stay editable and can take a stay percent on top of a manual rate. A derived plan with no BAR parent falls back to `pricePerNight`. Saving with new dates rebuilds nights that fall outside the stay and writes `reservation.totalAmount` from the grid.
- **Posting.** Check-in is inactive until the arrival date in Asia/Baku. Early check-in is a separate confirm and posts the early fee plus, only when the business date already sits inside the stay, that one night. A payment before or on arrival is a deposit (advance receipt), not N room charges. “Charge all” after the guest is in-house posts only the current business-date night. Remaining nights post on night audit.
- **Card, packages, and tasks** are in-modal fields. They do not use a browser prompt.

## Guest card — time share hidden

`GuestTimeShareAgreement` and `GET/POST /api/guests/:id/time-shares` stay in the hotel database. The guest-card **Time share** tab and the CRM **Müqavilələr** button (same time-share rows) are **not shown**. Hotel pricing modules have no time-share key, and there is no options checkbox for it. Show the tab only after a dedicated module flag exists. Do not treat the hidden API as a sold product.

## Guest card — identity now, documents at check-in

Saving a guest (create and edit) requires first name, last name, gender, birth date and citizenship. Patronymic stays optional. Phone, FIN and passport are **not** required at booking: reception often does not have the copy yet. Check-in refuses the stay until every named guest (primary and companions, not departed, not an empty slot) has a document — FIN or passport for AZ, passport otherwise. An AZ guest aged 18 or older also needs a phone; under 18 the phone is waived. Age comes from the birth date (Asia/Baku), then from a typed age. A missing age is treated as an adult, so the phone rule applies. Saving the reservation still succeeds and returns `operationalGaps` for a warning toast.

## Party counters follow the rows

Each guest row has one age band: adult (12 and older, same cut as Depart guest), 11–6, 5–2, or 0–1. The birth date decides the band; an empty slot stores a representative age so the band survives a reload. A departed guest stays on the list and does not count. The four counters are the count of rows in each band. Adding a child adds an empty row of that band only. Search above the list fills an empty slot of the same band, or appends a row — an adult never occupies a child slot. Deleting a row removes that row’s band only. A named row is not dropped when a counter is lowered past it; the counter snaps back.

## Room class is not always a free upgrade

The pricing tab keeps one action bar (manual nightly, discount, stay total, or restore the package night price) and a scrolling night grid. The night the guest pays is the only price on the row. Discount is a percent of the selected package’s nightly sell (the rate-plan price only when the stay has no package composition). Restore writes that package price onto nights that are still open, clears the percent, and clears the fix; it does not touch a posted night or a night before the business date. Manual, discount, and stay-total still skip fixed nights. A posted night is read-only; saving the card does not rewrite it. A past night with no posting stays visible and is not part of Apply. The footer is the grid sum, labeled as the stay total. Package line composition is not shown on this tab. A price explanation, when the number itself is not enough, stays on the billing price note.

When the given (physical) type differs from the charged type, the card does not call it a complimentary upgrade. The hotel can cover the difference (charged type stays, price note). The guest can pay the given class: the charged type becomes the given type and remaining nights (today onward, unlocked) take that class’s nightly price when a type-scoped rate exists. A cheaper given class is a downgrade: the hotel refunds the difference, or the guest asked for the cheaper class. Both move the charged type to the given class. The door must still belong to the given type. Posted past nights are not rewritten. A dated product change remains the stay-amendment wizard.

## Room moves

A move is stored in `RoomChangePlan` only when the door actually changes. The card shows them collapsed under the room number, newest first, with a translated reason (the raw `CARD_ASSIGN` code is not shown). No moves means no block. The hotel-wide list stays at `/fo/room-changes`. The history icon opens the same stay journal (moves and notes), not the reports catalog. Folio payment and invoice links scroll to those sections on the folio page. Creating a stay writes the same extra card fields the later save writes (bed, location, color, option, contract, credit limit, accommodation and record type, rate type). A locked guest card also hides CRM, archive, family, and loyalty adds; the guest family page searches guests instead of asking for a UUID, and the accompanying and booker-history pages open the same guest or reservation card as the dialog.

## Consequences

- Reservation card playbook (`era-hotel-pms-ui.mdc`) stays the **shipped** chrome until a UI wave lands D3; this ADR is the **target**.
- FO training: four worlds (exclusive / open share / closed pair / booking rooms); verbs (room checkout vs Depart guest vs Break share vs closed-pair stay checkout).
- Occupancy 2→1 mid-stay is a pricing amend, not unused-nights refund of the whole stay ([hotel-early-checkout-unused-nights.md](./hotel-early-checkout-unused-nights.md) applies when the **stay** checks out early).
- Group booking wizard already creates N stays; pax still often share one `guestId` on create — Move guest assumes pax rows are real people (MDM / guest cards), not empty slots.

## Out of scope

- Opera folio windows 1–8 as the data model (ERA folio types GUEST/AGENCY/COMPANY + routing overrides).
- Connecting-room sellable product.
- Cloning two Res IDs for every couple.
- Key card hardware.
- Sell/show / edition `ga` claims.

## Related

- [hotel-booking-hierarchy.md](./hotel-booking-hierarchy.md)
- [hotel-shared-twin-assignment.md](./hotel-shared-twin-assignment.md)
- [hotel-stay-amendment-and-pricing.md](./hotel-stay-amendment-and-pricing.md)
- [hotel-agency-vs-company-profiles.md](./hotel-agency-vs-company-profiles.md)
- [hotel-fo-screen-chain.md](./hotel-fo-screen-chain.md)
- [nafta-episode-per-pax.md](./nafta-episode-per-pax.md)
- [clinic-episode-as-clinical-course.md](./clinic-episode-as-clinical-course.md)
- [sanatorium-vnext.md](./sanatorium-vnext.md) SV10 lifecycle events
- UI rule: `era-hotel-pms/.cursor/rules/era-hotel-pms-ui.mdc`
