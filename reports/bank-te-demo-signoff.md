# Bank TE demo signoff — YC-C1

- Product: bank
- Wave: YC-C1 TE pack
- Date: 2026-08-06
- Result: te-pack-ready

## Scripted path (lab)

1. CIF → account → deposit open (in-band)
2. EOD → evidence `depositInterestAccrual` on `/admin/eod`
3. Loan originate → disburse → repay-by-schedule
4. Payment SoD (maker ≠ checker) + reject reason
5. Exception pricing SoD (one deposit or loan)
6. Risk staging + ECL lab + provision SoD
7. `/risk/capital` CAR/LCR snapshot
8. Trial balance `/gl`
9. Cash desk `/cash` post movement + `/fees` tariff/SDB
10. Payments extras SO/VA/cheque
11. Loan applications SoD book + collections recover SoD negative
12. Trade LC issue (SWIFT stub label) + islamic activate + wealth safekeeping
13. AML case + card dispute / 3DS ops view

## Automated evidence

- Unit: `bank-auth-jwt`, `loan-repay` (overpay), `pricing-exception-sod`, `payment-approve-sod`, deposit interest
- Docs: `era-bank/doc/UAT-SMOKE.md` steps 5–9 + UI envelope 17–24

## Honesty

Demo/TE layer ✅ for **lab TE pack** (full ops UI envelope after UI waves). This is **not** Pilot field / not edition ga / not live SWIFT or rails.
YC-E remains ⏸.
