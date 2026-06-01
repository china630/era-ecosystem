# Front Office — ElectraWeb parity (ERA)

> Operational guide for FO screens in **era-hotel-pms** (Wave A + B + **Wave C**).  
> Source: [`Electraweb/front office.md`](../../Electraweb/front office.md).

## Wave C — Core navigation order

| # | Screen | Route | Status |
|---|--------|-------|--------|
| 1 | **Əsas** (Executive cockpit / Daily Flash) | `/executive` | Cockpit: fact/plan occupancy, ADR/RevPAR compare, revenue MTD/YTD, receivables, status |
| 1b | **Forecast** | `/executive/forecast` | Occupancy forecast 7 / 14 / 30 / 90 days |
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
| Rack tile: status, guest, dates, pay, procedures | `RoomRackView` + `listRoomsForRack` | C |
| Rack DnD relocate | `POST /api/reservations/:id/relocate` | C |
| Room plan grouping/period dropdowns | `FilterMenuButton` | C |
| Room plan layout | Fixed **room column** + scrollable timeline; full page width | C+ |
| Room plan bars | Arrow tip on depart; **concave inward** start/end when checkout = check-in same cell | C+ |
| Room plan hover | Tooltip portal with res/guest/dates/agency/payment | C+ |
| Unified reservation card create/edit | `ReservationCardModal` + `ReservationCardToolbar` | C |
| Guest card CRM grids | `GuestCardModal` tabs CRM / Res. details | C |
| Notes in reservation list | `/api/reports/reservations-grid` | C |
| Header AZ/RU/EN → org → bell → profile | `satellite-kit` + `HotelOpsShell` | A/B |

## Reservation Card

- **Component:** `ReservationCardModal` — create and edit share `ReservationCardEditor` (POST then same card after save).
- **Toolbar / bottom bar:** `ReservationCardToolbar`, `ReservationCardBottomBar`.
- **API:** `GET/PATCH /api/reservations/:id/full`, pricing, lock, folio deep links.

## Guest Card

- **Component:** `GuestCardModal` — stats bar, 6 tabs, CRM action grid, identity CRUD.
- **API:** `/api/guests/:id/full`, documents, contacts, addresses, loyalty.

## API (Wave C)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/executive/dashboard?date=` | Management KPIs |
| `GET /api/reports/reservations-grid` | List with `hasNotes`, `notePreview` |
| `POST /api/reservations/:id/relocate` | Quick room move + `RoomChangePlan` |

## Related

- [ELEKTRAWEB-PARITY.md](./ELEKTRAWEB-PARITY.md)
- [UAT-SMOKE.md](./UAT-SMOKE.md)
- [DELIVERY.md](./DELIVERY.md) — Wave C checklist
