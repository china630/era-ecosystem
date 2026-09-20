# Hotel — Vouchers, promotions, certificates (Opera-shaped split)

## Status

Accepted as **product debt / deferred** — 2026-09-07  
Not scheduled for Nafta cutover. Implementation IDs: **H-BL-51 … H-BL-53**.

## Context

Operators and docs mix three different Opera concepts under one word «voucher»:

1. **Travel-agent / agency voucher number** — external document ref on a stay.
2. **Hotel promotion code** — marketing discount / special rate rules.
3. **Gift / prepaid certificates** — sellable liability redeemed on folio.

ERA today:

| Concept | Current state |
|---------|----------------|
| Agency voucher ref | `Reservation.voucherNo` free text (card, EW import/bridge). No catalog. Hint: agency/tour B2B. |
| Promotion codes | `PromotionCode` + `/distribution/promotion-codes` CRUD (code + %). **Not** applied on reservation card; **not** linked to `voucherNo`. Stay discount uses `discountPercent` manually. |
| Certificates | **Absent** |

Putting a promo code into `voucherNo` is wrong semantics and does nothing to price.

## Decision (target model — do not collapse)

Keep **three independent streams** (Opera shape):

```text
① Agency voucher ref     ② Promo apply              ③ Certificates
   Reservation.voucherNo    PromotionCode →           Certificate ledger
   + Agency                 discount / rate on stay   → redeem on folio
   (no price effect)        (price effect)            (balance / liability)
```

### ① Agency voucher ref (H-BL-51 — polish)

- **Meaning:** agency/tour voucher number only (parity with EW Voucher / `VOUCHERNO`).
- **Keep** free-text `voucherNo`; do **not** FK to `PromotionCode`.
- **Debt:** FO list/search by voucherNo; agency statement / reports column; UX copy that this is **not** a hotel promo.
- **Priority for Nafta-class hotels:** high (daily B2B). Effort: small.

### ② Promo apply (H-BL-52)

- **Meaning:** hotel-issued promo; validate → stamp stay discount (or rate/package) + audit.
- **MVP debt:** wire `/distribution/promotion-codes` to reservation card (select/enter code → `discountPercent` or explicit promo FK); dates/active checks; no double-count vs package/contract without rules.
- **Out of MVP:** full Opera rate-engine promos, channel-scoped stacks, OTA promo sync.
- **Priority for Nafta:** medium/low (packages + contracts dominate). City/OTA hotels: higher. Effort: medium.

### ③ Certificates (H-BL-53)

- **Meaning:** gift/prepaid certificate inventory; issue, expiry, redeem posting, void.
- **Not** `voucherNo`. New domain + folio tender/posting + Finance liability story.
- **Priority for Nafta cutover:** low. Effort: high. Gate: stable folio + FO money.

## Consequences

- Menu **Promotion codes** remains a master; treat as **Partial / debt** until H-BL-52.
- Do not invent a single «Voucher» module that mixes agency ref, promo, and gift cards.
- Nafta cutover: ship ① polish if needed; defer ②/③ unless a named hotel asks for promo desk or gift cards.
- Coverage / edition claims must not mark «vouchers» GA from CRUD-only promo or `voucherNo` alone.

## References

- Backlog: [era-hotel-pms/doc/BACKLOG-PRODUCTION.md](../../era-hotel-pms/doc/BACKLOG-PRODUCTION.md) P8 H-BL-51…53
- Agency vs company: [hotel-agency-vs-company-profiles.md](./hotel-agency-vs-company-profiles.md)
- Menu: [MENU-IA-CANON.md](../../era-hotel-pms/doc/MENU-IA-CANON.md) § Distribution
