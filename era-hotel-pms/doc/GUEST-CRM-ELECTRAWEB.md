# Guest CRM — ElectraWeb parity

> **Source:** legacy `Electraweb/crm.md` (matrix + waves) — implemented in [`guest-crm-config.ts`](../src/lib/guest-crm-config.ts) (2026-06-04). Index: [reference/ELECTRAWEB-SOURCE-INDEX.md](reference/ELECTRAWEB-SOURCE-INDEX.md).  
> **UI:** `GuestCardModal` tabs **CRM** and **Reservation details**  
> **Config:** [`src/lib/guest-crm-config.ts`](../src/lib/guest-crm-config.ts)

## Satellite boundary

| Module | ElectraWeb path | ERA behavior |
|--------|-----------------|--------------|
| Medical (6 buttons) | `/medical/guests/{id}` | `clinicGuestDeepLink` → `era-clinic` (`NEXT_PUBLIC_CLINIC_WEB_URL` / `NEXT_PUBLIC_SATELLITE_CLINIC_URL`) |
| Finance | `/finance/guests/{id}`, folios | `financeGuestDeepLink` → `era-finance-core` |
| Logistics transfers | `/transfers?guestId=` | In-hotel `/transfers` + API filter; optional logistics satellite URL |
| Hotel `/medical` page | — | Operational alerts only; **not** used from CRM grid |

## Waves delivered

| Wave | Scope | Status |
|------|--------|--------|
| H1 | tasks, notes, tags, archive, deep links | Done |
| H2 | preferences, allergens, special dates, favorites, special notes | Done |
| H3 | clinic/finance satellite buttons | Done |
| H4 | comments, surveys, reclaims, incidents | Done |
| H5 | WhatsApp/email/SMS stubs (`GuestCommunication` status STUB) | Done (integrations Partial) |
| H6 | P2/P3 buttons visible-disabled in config | Deferred |
| Res-H1 | reservations/transfers/lost-found/folio deep links | Done |
| Res-H2 | family, accompanying, booker | Done |
| Res-H3 | trip reasons, reservation sources analytics | Done |
| Res-H4 | web/call, auto tasks, other hotels | Deferred |

## P0+P1 button map (CRM tab)

| button_id | Route / target |
|-----------|----------------|
| tasks | `/guests/{id}/tasks` |
| notes | `/guests/{id}/notes` |
| document_archive | `/guests/{id}/archive` |
| tags | `/guests/{id}/tags` |
| preferences | `/guests/{id}/preferences` |
| allergens | `/guests/{id}/allergens` |
| health_info … lab_test_results | Clinic satellite query `guestId` |
| expenses | Finance satellite expenses |
| comments, surveys, reclaims, incidents | Under `/guests/{id}/…` |
| whatsapp, emails, sms | `/guests/{id}/whatsapp` etc. |

## Reservation details tab

| button_id | Route |
|-----------|--------|
| reservations | `/reports/reservations?guestId={id}` |
| transfers | `/transfers?guestId={id}` |
| lost_and_found | `/housekeeping/lost-and-found?guestId={id}` |
| guest_all_folio | Finance folios deep link |
| accompanying, family, booker | `/guests/{id}/accompanying` … |
| trip_reasons, reservation_sources | Analytics API `GET /api/guests/{id}/reservation-analytics` |

## Schema

Migration `20260604120000_guest_crm`: `GuestTag`, `GuestArchiveFile`, `GuestPreference`, `GuestAllergen`, `GuestSpecialDate`, `GuestFavoriteRoom`, `GuestComment`, `GuestSurvey`, `GuestIncident`, `GuestCommunication`, `GuestContactLog`, `GuestFamily`, `Reservation.bookerGuestId`.

**Note:** Identity passports remain `GuestDocument`; archive files are `GuestArchiveFile`.

## UAT

See [UAT-SMOKE.md](./UAT-SMOKE.md) §16.
