# ADR: Hotel agency portal (B2B extranet)

**Status:** Accepted  
**Date:** 2026-08-20  
**Scope:** `era-orchestrator` (identity) + `era-hotel-pms` (booking SoT)  
**SKU:** `hotel_agency_portal` (not in city/resort/sanatorium bundles by default)

## Context

Travel agencies need a self-service extranet: log in, book under contract allotment, attach passport scans for FO visual check; hotel staff confirm/decline when auto-confirm is off. Elektraweb Agency Portal (WA0225) was out of Nafta phase-1 scope. Existing SHIPPED pieces (`Agency`, `SalesContract`, `ContractAllotment`, city ledger) are hotel-staff only.

## Decision

### 1. Planes

| Concern | Owner |
|---------|--------|
| Password, multi-hotel grants, property picker | Orchestrator — `AgencyPortalAccount` + `AgencyPropertyGrant` |
| Quote, allotment, Reservation, inbox, passport file | Hotel PMS |
| GL / e-qaimə / AR aging | Finance (unchanged) |
| KBS / tourism registry | Not from portal; FO at check-in only |

Agency is **not** an ERA `Organization` and does **not** use `OrganizationMembership`. Staff hotel `User` rows are not reused for agents.

### 2. Identity and SSO

- One email/password across hotels; each hotel invites a **grant** (`organizationId` + local `agencyId` + VÖEN).
- Without agency VÖEN, portal invite is refused.
- Agency HMAC payload (distinct from owner/staff SSO):

  `agency|{email}|{organizationId}|{agencyId}|{expiresAt}` (+ jti / replay guard)

- Hotel exchange: `POST /api/auth/agency-sso/exchange` → cookie `era_agency_session`.
- Do **not** map agency SSO into `Hotel_Admin` / `Financial_Auditor`.

### 3. Confirm policy (hotel-wide)

`HotelProfile.policyJson.agencyPortalAutoConfirm` — default **`false`**.

| Flag | Create result |
|------|----------------|
| OFF | `OPTION` + FO inbox |
| ON | `CONFIRMED` if allotment + credit limit allow |

Not a `SalesContract` field. P1: no BAR overflow beyond contract allotment. `OPTION` holds sellable inventory (existing rule).

### 4. Passport scan

Optional `PASSPORT_SCAN` on `ReservationAttachment` via `@era/storage` (`attachments/{organizationId}/…`). FO reads on reservation card. Not MDM master; not sent to KBS from portal.

### 5. Entitlement

- Module key `hotel_agency_portal` under gate `industry_hotel_pms`.
- Routes `/agency`, `/api/agency` require the module.
- Invite UI on travel agencies also requires `hotel_distribution`.
- Grants for orgs without the module are hidden from the property picker.

### 6. Out of scope (P2+)

Notify Pack triggers, CL snapshot in agency UI, self-cancel by cutoff, mandatory scan, group/MASTER folio from portal, live OTA, `/b2c` BAR for agents.

## Consequences

- Coverage: `HOT-AGP-01` … `HOT-AGP-03`; AC `AC-HOT-AGP`.
- Taxonomy: 10th hotel submodule key (was “9-key”; docs updated).
- Negative tests required before Scaffold ✅.

## References

- [hotel-b2b-sales-contracts.md](./hotel-b2b-sales-contracts.md)
- [hotel-booking-hierarchy.md](./hotel-booking-hierarchy.md)
- [hotel-module-taxonomy.md](./hotel-module-taxonomy.md)
- [INTEGRATION_SSO_EVENTS.md](../INTEGRATION_SSO_EVENTS.md)
