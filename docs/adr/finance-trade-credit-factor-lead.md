# ADR: Trade credit factoring referral (Phase 2c)

**Status:** Accepted — referral-only; no GL  
**Date:** 2026-09-17  
**Product:** ERA Finance buyer cabinet + partner factor  

## Context

ADR [finance-trade-credit-control.md](./finance-trade-credit-control.md) Phase 2c separates **pay-in-cabinet** (existing acquiring / payment links) from **factoring**. Factoring must not become a second cash register or post disbursement into NAS without a dedicated accounting ADR.

## Decision

1. SKU `trade_credit_factor_lead` (list ~99 AZN/mo or partner-priced quote) unlocks buyer cabinet button **Get paid today**.
2. ERA stores a `TradeCreditFactorLead` row: org, counterparty, optional invoice id, partner key, **hashed** discipline stats (open AR bucket / sha256 of residual snapshot). **Never** send А–Г / `policyGroup` to the buyer or partner as a credit-score label.
3. Delivery is **referral**: partner bank/factor contacts the seller; ERA does **not** post factoring disbursement, interest, or fee into GL in this wave.
4. `era-bank` loan origination remains a different customer path (the bank), not the wholesaler buyer portal.

## Consequences

- Coverage id `FIN-TCC-04` covers pay-link + factor lead as API/STUB until UAT.
- Partner contract / revshare lives outside NAS list pricing when partner-priced.
- A future accounting ADR is required before any GL for factor advances.

## References

- [finance-trade-credit-control.md](./finance-trade-credit-control.md) §9.1 track 2c  
- [era-commercial-catalog.md](./era-commercial-catalog.md)  
