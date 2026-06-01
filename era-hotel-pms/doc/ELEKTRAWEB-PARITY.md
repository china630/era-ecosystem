# ElectraWeb → ERA Hotel PMS — Parity Manifest

> Screen-level target for ERA Hotel PMS vs ElectraWeb (AZ market).  
> **Terminology:** ElectraWeb features = `pricing_modules` (`hotel_*`), **not** platform add-ons.

---

## Glossary

| ERA term | Meaning |
|----------|---------|
| **Hotel module** | Paid functional area inside PMS | `hotel_core`, `hotel_distribution`, `hotel_housekeeping` |
| **Platform add-on** | Cross-product CP service | `platform_notifications` |

**Guest Experience ≠ era-crm:** UI labels: **Guests**, never «CRM».

---

## Wave status (2026-06-01)

### Wave A — Done

- Room Rack, Room Plan grouping + availability row
- Reservation Card shell (edit), Guest Card MVP
- `/reports/reservations`, `/reports/group-reservations`
- Satellite notification bell (all industry shells)

### Wave B — Done

| Area | Route | API / notes |
|------|-------|-------------|
| Reservation Card pricing | Modal → Pricing tab | `POST /api/reservations/:id/pricing/recalc`, `charge-all` |
| Unified create/edit | Modal | `onCreated` stays on card |
| FO with notes | `/reports/reservations/notes` | `GET /api/reports/reservation-notes` |
| Daily in-house | `/reports/inhouse-daily` | `GET /api/reports/inhouse-daily?date=` |
| EOD logs | `/reports/end-of-day-logs` | `GET /api/reports/night-audit-runs` |
| Reservation times | `/reports/reservation-times` | `GET /api/reports/reservation-times` |
| Room changes | `/reports/room-changes` | `GET/POST /api/reports/room-changes` |
| Guest identity | Guest Card tab | `/api/guests/:id/documents|contacts|addresses` |
| Group balance | `/reports/group-reservations` | `groupBalance` in groups API |
| Promotion codes | `/admin/promotion-codes` | CRUD API |
| Travel agencies | `/admin/travel-agencies` | Agency CRUD |
| Child matrix | `/admin/child-matrix` | CRUD API |
| Channel availability | `/channel` | Matrix + `GET /api/channel/availability` |
| Channel mapping MVP | `/channel` | `GET/POST /api/channel/mappings` |
| HK closed OOO | `/housekeeping/closed-rooms` | `GET /api/housekeeping/closed-rooms` |
| HK maids | `/housekeeping/maids` | Housekeeper + assign |
| HK minibar | `/housekeeping/minibar` | Items + post to folio |
| HK lost & found | `/housekeeping/lost-and-found` | CRUD |
| SPA places | `/spa/places` | `SpaPlace` CRUD |
| SPA reservations view | `/spa/reservations` | Links to `/procedures` |
| SPA staff match | `/spa/staff-match` | Aggregated grid |
| Airport transfers | `/transfers/airport` | Filter `flightNo` |
| NA polish | `/operations` | Link to EOD logs |
| Room plan print | `/room-plan` | `window.print()` |

**No `HotelParityPage` stubs remain** on Wave B routes.

### Wave C — Done (Front Office product)

| Area | Route / component | Notes |
|------|-------------------|--------|
| **Əsas** executive KPI | `/executive` | Occupancy %, in-house, arr/dep, revenue, AR, ADR, RevPAR |
| Rack tile parity | `/` `RoomRackView` | Guest, dates, pay badge, procedures |
| Rack / plan DnD relocate | `POST .../relocate` | HK-03 + `RoomChangePlan` |
| Room plan filters | `/room-plan` | `FilterMenuButton` grouping + period |
| Room plan room column | `/room-plan` | Left fixed column; timeline does not shift room numbers |
| Room plan bar shapes | `/room-plan` | Arrow end; turnover notch when checkout = next check-in |
| Room plan tooltip | `/room-plan` | Hover popup with reservation fields |
| Reservation card UX | `ReservationCardModal` | Shared toolbar; create → edit same card |
| Guest card depth | `GuestCardModal` | CRM + reservation action grids |
| Notes in list | `/reports/reservations` | No separate FO-notes menu item |
| Reports nav | `hotel_reports` | Actual check-in/out times |

### Wave D — Planned

- SPA scheduler depth, banquets BEO, medical sanatorium flows, Credit Card/Packages sub-modals

---

## Screen manifest (summary)

| ElectraWeb area | ERA route | Wave |
|-----------------|-----------|------|
| Rack / FO core | `/`, cards, reports | A–B |
| Night audit / EOD | `/operations`, `/reports/end-of-day-logs` | B |
| Distribution | `/channel`, `/admin/*` | B |
| HK | `/housekeeping/*` | B |
| SPA / Transfers | `/spa/*`, `/transfers/airport` | B (MVP), C (depth) |

---

## Finance boundary

GL / sales invoices → **era-finance-core** via `FinanceBoundaryBanner` and deep links.

---

## Related docs

- [FRONT-OFFICE-ELECTRAWEB.md](./FRONT-OFFICE-ELECTRAWEB.md)
- [DELIVERY.md](./DELIVERY.md) · [UAT-SMOKE.md](./UAT-SMOKE.md)
