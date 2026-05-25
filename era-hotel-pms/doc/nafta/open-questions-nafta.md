# Nafta — open questions (NotebookLM + on-site)

Recorded 2026-05-25 from NotebookLM export. Confirm with Nafta on site — update [13-nafta-validation-checklist.md](../clone-spec/13-nafta-validation-checklist.md) when answered.

## Transfers (HN-7)

1. **Transfers pricing:** Fixed price by route (Ganja/Baku airport) or by vehicle class (Standard/VIP)? Can transfer be **included in medical package**, or always extra folio line?
2. **Outsourced transfers:** Is `Hotel Group Transfer List (Out Source)` used? Need agency ledger for external taxi vendors in PMS?
3. **Confirmation workflow:** Is authorizer step (WA_TRANS_02) mandatory before dispatch, or reception-only?

## Banquets (HN-8)

4. **BEO vs POS execution:** When BEO fixes menu for 50 pax, must fb-pos ring all 50 portions (recipe stock), or POS **only for extras** (alcohol beyond contract)?
5. **Saloons vs daily restaurant:** Are Naftani / Xudmani halls used à la carte on non-event days? Overlap with fb-pos table map?
6. **BEO advance:** Advance on event master folio (Front Cash) or company bank transfer / city ledger in Finance only?

## Clinical / compliance

7. **Lab LIS:** Manual entry from paper vs instrument HL7 — defer LIS per Wave 3 default; confirm Nafta lab workflow.
8. **e-qaimə AZ:** Excel export to tax portal vs direct `era-finance-core` API to e-taxes.gov.az?

## Defaults until answered (Wave 4 dev)

| Topic | Default |
|-------|---------|
| Transfer pricing | Fixed AZN per route; extra folio `TRANSFER` code |
| Package-included transfer | No — always extra unless rate plan flag added later |
| BEO POS | Extras only on event day; base BEO total on PMS folio |
| BEO advance | Guest/company folio deposit line on BEO confirm |
| Outsourced vendor | Out of scope P0 — internal fleet only (Vehicle List) |
