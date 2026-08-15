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
| Guest card depth | `GuestCardModal` | Config CRM + reservation grids ([GUEST-CRM-ELECTRAWEB.md](GUEST-CRM-ELECTRAWEB.md)) |
| Notes in list | `/reports/reservations` | No separate FO-notes menu item |
| Reports nav | `hotel_reports` | Actual check-in/out times |

### Wave D1 — Done (2026-06-02)

| Area | Notes |
|------|--------|
| Header order | `EraAppHeader`: Locale → Bell → Org → Profile |
| Room rack filters | Agency, booking source, pay status |
| Reservation card | Split panels, full PATCH, bottom bar, toolbar check-in |
| Tests | `reservation-full-patch.schema.spec.ts`, `e2e/reservation-card.spec.ts` |

### Wave D2 — Done (2026-06-02)

| Area | Notes |
|------|--------|
| Guest card | Split panels, all consent toggles, details schema fields, loyalty/time-share grids |
| Guest routes | `/guests/:id/notes`, `/guests/:id/tasks` |
| Reservation sub-modals | Credit card, packages, tasks, folio routing (API + modals) |
| Group reservations | `GroupBookingModal`, open reservation card from code/guest |
| Schema | `20260602120000_wave_d2_guest_res_submodals` |
| Tests | `e2e/guest-card.spec.ts` |

### Wave D3 — Done (closure 2026-06-02)

- Docs reconciled (this file, `FRONT-OFFICE-ELECTRAWEB.md`, `DELIVERY.md`, `UAT-SMOKE.md`, `UI_PLAYBOOK_SATELLITES.md`)
- FO i18n: `scripts/apply-wave-d2-i18n.mjs` + key parity `verify:i18n`
- Deploy: `npx prisma migrate deploy` in `era-hotel-pms` after pull

### Waves E–G — Done (2026-06-03)

- **E:** Reservation CSV (left panel, room icons, attach/lightning, guests/pricing/folio depth); migration `20260603120000_wave_e_reservation_csv`
- **F:** Guest CSV (ID mock reader, doc columns, loyalty points, time-share tabs, toolbar); migration `20260603130000_wave_f_guest_csv`
- **G:** Rack/plan room number colors (`rackNumberTextClass`); [FRONT-OFFICE-STATUS.md](FRONT-OFFICE-STATUS.md) closure
- **Done:** Guest CRM P0+P1 + Res details ([GUEST-CRM-ELECTRAWEB.md](GUEST-CRM-ELECTRAWEB.md)); P2/P3 disabled; clinic/finance satellites

### Backlog (post-FO CSV + legacy module drafts)

| Area | ERA today | Notes |
|------|-----------|--------|
| SPA scheduler depth | `/procedures`, `/spa/*` | MVP Wave B |
| Banquets BEO | backlog | — |
| Medical sanatorium | `era-clinic` satellite | Not in-hotel EMR |
| Platform CRM (`04 CRM.md`) | `era-crm` satellite | ≠ Guest Card CRM |
| Front Cash (`03 FRONT CASH.md`) | folio/cashier partial | Dedicated wave TBD |
| Channel Manager depth | `/channel` Wave B | Stop sale, channel log depth |
| SETUP MDM (`0 SETUP.md`) | admin + clone-spec 09 | 200+ screens → generic CRUD pattern |
| Contract management | agencies admin | Wave B |

Index of removed root folder: [reference/ELECTRAWEB-SOURCE-INDEX.md](reference/ELECTRAWEB-SOURCE-INDEX.md).

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

## Elektraweb Excel import (Stage 26)

Phased migration wizard at **`/admin/import`** (platform super-admin). Idempotent `.xlsx` upsert. **Chart of Accounts is not imported** (finance-core).

**Full guide:** [ELEKTRAWEB-IMPORT.md](./ELEKTRAWEB-IMPORT.md) · **ADR:** [docs/adr/hotel-elektraweb-import.md](../../docs/adr/hotel-elektraweb-import.md)

| Phase | Templates | Upsert key |
|-------|-----------|------------|
| 1 Dictionaries | Revenue codes, Bed types, Room views | `code` |
| 2 Master | Room types, Rate codes, Rooms, Agencies, Product/Stock cards | `code` / `roomNumber` |
| 3 Transactional | Guests, Reservations, Folios | `externalRef` |

Reference seed (all deployments): `npm run db:seed:reference`.

**Future:** same tool for additional Elektraweb hotels; owner self-service import planned (entitlement gate, not yet built).

---

## Finance boundary

GL / sales invoices → **era-finance-core** via `FinanceBoundaryBanner` and deep links.

---

## Related docs

- [FRONT-OFFICE-STATUS.md](./FRONT-OFFICE-STATUS.md) — FO traceability (Done / Partial / Planned)
- [FRONT-OFFICE-ELECTRAWEB.md](./FRONT-OFFICE-ELECTRAWEB.md)
- [GUEST-CRM-ELECTRAWEB.md](./GUEST-CRM-ELECTRAWEB.md) — Guest Card CRM + Reservation details
- [reference/ELECTRAWEB-SOURCE-INDEX.md](reference/ELECTRAWEB-SOURCE-INDEX.md) — mapping after `Electraweb/` removal
- [ELEKTRAWEB-IMPORT.md](./ELEKTRAWEB-IMPORT.md) — Elektraweb migration wizard (Stage 26)
- [DELIVERY.md](./DELIVERY.md) · [UAT-SMOKE.md](./UAT-SMOKE.md)
