# Hotel — Agency Commission Payable (AP, not City Ledger)

## Status

Accepted — 2026-10-29

## Context

Travel agents earn commission when guests come through them. Corporate companies on City Ledger owe the hotel for stays. Front Cash agency ledger is **AR** (agency → hotel). Commission is the opposite direction (hotel → agency). Mixing them on AGENCY folios or netting `cityLedger − commission` breaks Opera-shaped ops and audit.

Existing reports (`agency-p1`, profitability) invent commission from `totalAmount × %` without durable payable lines or Finance AP handoff.

## Decision

1. **Separate contours:** City Ledger AR stays on `/front-cash/agency-ledger`. Commission payable lives on `/distribution/agency-commission`.
2. **Never** post commission as a folio charge/payment on AGENCY/COMPANY. Empty B2B pockets stay closed for commission ([hotel-room-payer-and-commission-basis.md](./hotel-room-payer-and-commission-basis.md)).
3. **Accrue** durable `AgencyCommissionLine` rows when a stay becomes `CHECKED_OUT`, one line per commercial period (or one default period). `%` = sales contract else agency card; `GROSS` → amount; `NET` → `SKIPPED_NET` amount 0.
4. **Revenue base (P0):** posted stay-night / ROOM roles only (`STAY_NIGHT_ROLES`). City tax and extras out of base until contracts require otherwise.
5. **Pay** only in Finance (AP / purchase invoice). Hotel submit publishes `SATELLITE_HOTEL_AGENCY_COMMISSION_PAYABLE`; hotel cash pay returns `FINANCE_ONLY_COMMISSION_PAY`. Paid → inbound `commission-paid` (peer URL pattern like HOT-CL-07).
6. **Forecast** is estimated (future nights × rate × %) on the same hub; not payable until checkout accrual.
7. **Hold / dispute** block READY/submit. **AR↔AP offset** is Finance-only (P3); PMS never auto-nets on the agency ledger screen.

## Consequences

- Coverage: `HOT-AG-COMM-01`…`04`. AC-HOT-AG-COMM stays out of Scaffold BE rollup until negatives + UAT; does not reopen AC-HOT-CASH.
- Related: [hotel-agency-vs-company-profiles.md](./hotel-agency-vs-company-profiles.md), [HOSPITALITY_FINANCE_BOUNDARY.md](../HOSPITALITY_FINANCE_BOUNDARY.md), [satellite-peer-url-resolution.md](./satellite-peer-url-resolution.md).
