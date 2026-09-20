# Hotel — Agency vs Company profiles (Opera split)

## Status

Accepted — 2026-09-07

## Context

Opera keeps **two independent profiles** on a reservation:

- **Travel agent** — commission, allotment, voucher.
- **Company** — corporate direct bill (City Ledger), no travel-agent commission.

A stay can have both at once. The **guest** is never on City Ledger.

ERA previously had a single `Agency` master and `reservation.agencyId`. COMPANY folios were opened from guest VÖEN. The Front Cash agency ledger mixed AGENCY and COMPANY activity. H-BL-46 claimed prepaid/postpaid; the field did not exist.

## Decision

1. Keep `Agency` as the travel-agent profile (`commissionPercent` + mandatory `settlementMode` PREPAID|POSTPAID).
2. Add `Company` as the corporate profile (credit terms + `settlementMode`, **no commission**).
3. `Reservation.agencyId` and `Reservation.companyId` are independent FKs (Opera shape).
4. Open an AGENCY folio when `agencyId` is set; open a COMPANY folio when `companyId` is set (or guest VÖEN still present).
5. Front Cash has **two menu screens** (Opera IA): `/front-cash/agency-ledger` (AGENCY folios + commission) and `/front-cash/company-ledger` (COMPANY folios, no commission). Shared summary API still accepts `kind=AGENCY|COMPANY|ALL`.
6. Master screens: `/distribution/travel-agencies` (commission + settlement) and `/distribution/companies` (settlement, no commission).

## Consequences

- Prepaid vs postpaid is a profile flag for B2B AR timing; commission posting still follows existing contract/agency percent.
- Guest folio remains the in-house guest bill; CL is B2B after (or instead of) guest settle per existing checkout/CL rules.
- Company CL snapshot/Finance re-push is **not** cloned from agency snapshot in this wave (agency HOT-CL-04 unchanged).
