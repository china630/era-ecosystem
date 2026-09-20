# Front Office — ElectraWeb parity (ERA)

> Operational guide for FO screens in **era-hotel-pms** (Wave A–D).  
> Legacy AZ spec (`Electraweb/front office.md`) merged here and into [FRONT-OFFICE-STATUS.md](./FRONT-OFFICE-STATUS.md) (2026-06-04).  
> **Line-by-line status (Done / Partial / Planned):** [FRONT-OFFICE-STATUS.md](./FRONT-OFFICE-STATUS.md).  
> **Menu / URL canon (2026-08-07):** [MENU-IA-CANON.md](./MENU-IA-CANON.md) — all FO routes under `/fo/*`.


## FO screen chain (2026-07-27)

Operational priority (Electra-aligned) — see [ADR hotel-fo-screen-chain](../../docs/adr/hotel-fo-screen-chain.md):

1. **Room type availability** `/fo/availability` — sellable Avl/Occ (unassigned stays occupy inventory).
2. **Reservation list** `/fo/reservations` — stays queue; assign / check-in.
3. **Room rack** `/fo/rack` — door tiles for the shift (HK + in-house).
4. **Room plan** `/fo/room-plan` — timeline bars after roomId.
5. Groups / allotment blocks — booking envelopes and corporate holds.

**Sidebar FO order** (menu IA): availability → reservations → **room plan** → **rack**. See [MENU-IA-CANON.md](./MENU-IA-CANON.md).

Empty rack/plan cells = free **doors**, not sellable type inventory. Create form shows sellable preview and links to RTA when Avl = 0.

## Wave C — Core navigation order

| # | Screen | Route | Status |
|---|--------|-------|--------|
| 1 | **Əsas** (Executive cockpit / Daily Flash) | `/executive` | Cockpit: fact/plan occupancy, ADR/RevPAR compare, revenue MTD/YTD, receivables, status |
| 1b | **Forecast** | `/executive/forecast` | Occupancy forecast 7 / 14 / 30 / 90 days |
| 1c | **Unit economics** (planned) | `/executive/unit-economics` | CPOR / BEP / service-fee·food·medical COGS trends + below-floor risks — [ADR](../../docs/adr/hotel-bar-accounting-vs-package-sell.md) `HOT-UE-01` |
| 2 | Room rack | `/` | Wave C — enriched tiles + DnD relocate |
| 3 | Room plan | `/room-plan` | Wave C+ — split room column, arrow bars, hover tooltip, full width |
| 4 | Reservation list | `/reports/reservations` | Wave C — notes column + filter |
| 5 | Group reservations | `/reports/group-reservations` | Separate menu (group balance) |
| 6 | In-house guests | `/in-house` | Wave C — guest card |
| 7 | EOD logs | `/reports/end-of-day-logs` | Wave B |
| 8 | Room change plans | `/reports/room-changes` | Wave B (+ auto plan on DnD) |
| 9 | Daily in-house | `/reports/inhouse-daily` | Wave B |
| 10 | Night audit ops | `/operations` | Wave B |

**Reports** section (not in Core): Actual check-in/out times → `/reports/reservation-times`.

**Removed from Core menu:** FO with notes → merged into reservation list (`?hasNotes=1` redirect from `/reports/reservations/notes`).

## Spec traceability (`front office.md`)

| Spec item | Implementation | Wave |
|-----------|----------------|------|
| Əsas KPI dashboard | `ExecutiveDashboard`, 7 KPIs | C |
| Rack tile: status, guest, dates, pay, procedures | `RoomRackView` + `listRoomsForRack` — tile stay must overlap **From–To**; filter pane and grid scroll separately; gender via `normalizeShareGender` | C |
| Rack DnD relocate | `POST /api/reservations/:id/relocate` | C |
| Room plan grouping/period dropdowns | `FilterMenuButton` | C |
| Room plan layout | Fixed **room column** + scrollable timeline; full page width | C+ |
| Room plan bars | Half-day model; blunt EW chevron (`CHEVRON_PX`); high-contrast day-state palette + HK squares (`plan-bar-theme.ts`); sticky date/availability headers on vertical scroll; share **N parallel lanes** only when `shareEligible` (no paint safety-net — fix data) (`share-lanes.ts`) | C+ / EW palette |
| Room plan hover | Tooltip portal with res/guest/dates/agency/payment | C+ |
| Unified reservation card create/edit | `ReservationCardModal` + `ReservationCardToolbar` | C |
| Reservation card near-fullscreen | `MODAL_FULL_CLASS`; 50/50; Phase 0 panels Stay/Product/Pax/Class/Commercial + Assignment (stage) + Additional; create=edit | C+ |
| Guest card FO parity | Same chrome; left FieldPanels (Identity/Classification/Documents+MDM/Other); right collections; no Details tab; create=edit | C+ |
| Modal dismiss (kit) | Backdrop / Esc do not close; body scroll lock; overlay `pt-10` | C+ |
| Guest card CRM grids | `GuestCardModal` tabs CRM / Res. details | C |
| Notes in reservation list | `/api/reports/reservations-grid` | C |
| Header AZ/RU/EN → org → bell → profile | `satellite-kit` + `HotelOpsShell` | A/B (D1: DOM = Locale → Bell → Org → Profile) |

## Wave D1 — Reservation card depth (2026-06-02)

| Spec item | Implementation | Wave |
|-----------|----------------|------|
| Rack filters agency/source/pay | `RoomRackView` aside + `room-rack.service` | D1 |
| Reservation left panel all schema fields | `ReservationCardLeftPanel` | D1 |
| Guests/pricing/folio/notes tabs | `reservation-card/*` panels | D1 |
| Bottom bar + sub-modal stubs enabled | `ReservationCardBottomBar` | D1 → D2 full modals |

## Wave D2 — Guest card + sub-modals (2026-06-02)

| Spec item | Implementation | Wave |
|-----------|----------------|------|
| Guest card split + toolbar copy/print | `guest-card/*`, `GuestCardToolbar` | D2 |
| Identity grids + 6 consents | `GuestCardIdentityTab` | D2 |
| Details tab editable fields | `GuestCardDetailsTab` + guest PATCH | D2 |
| Loyalty / time-share grids | `GuestLoyaltyCard`, `GuestTimeShareAgreement` | D2 |
| CRM notes/tasks routes | `/guests/:id/notes`, `/guests/:id/tasks` | D2 |
| Group page UX | `GroupBookingModal`, `ReservationCardModal` from code/guest | D2 |
| Credit card / packages / tasks / routing | `ReservationCardSubModals` + APIs | D2 |

## Reservation Card

- **Component:** `ReservationCardModal` — create and edit share `ReservationCardEditor` (POST then same card after save).
- **Toolbar / bottom bar:** `ReservationCardToolbar`, `ReservationCardBottomBar`.
- **API:** `GET/PATCH /api/reservations/:id/full`, pricing, lock, folio deep links.

## Guest Card

- **Component:** `GuestCardModal` — stats bar, 6 tabs, split panels under `src/components/guest-card/`.
- **Routes:** `/guests/:id/*` CRM pages — see [GUEST-CRM-ELECTRAWEB.md](GUEST-CRM-ELECTRAWEB.md).
- **Satellites:** Medical/finance buttons use `satellite-links.ts` / `finance-links.ts` (not `/medical` in hotel).
- **API:** `GET/PATCH /api/guests/:id/full`, documents/contacts/addresses, loyalty-cards, time-shares.
- **API:** `/api/guests/:id/full`, documents, contacts, addresses, loyalty.

## API (Wave C)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/executive/dashboard?date=` | Management KPIs |
| `GET /api/reports/reservations-grid` | List with `hasNotes`, `notePreview` |
| `POST /api/reservations/:id/relocate` | Quick room move + `RoomChangePlan` |

## Related

- [GUEST-CRM-ELECTRAWEB.md](./GUEST-CRM-ELECTRAWEB.md)
- [ELEKTRAWEB-PARITY.md](./ELEKTRAWEB-PARITY.md)
- [UAT-SMOKE.md](./UAT-SMOKE.md) §14–16
- [DELIVERY.md](./DELIVERY.md) — Wave C checklist
- [reference/ELECTRAWEB-SOURCE-INDEX.md](reference/ELECTRAWEB-SOURCE-INDEX.md)
