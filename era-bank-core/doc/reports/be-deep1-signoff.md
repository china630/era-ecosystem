# Bank BE Deep-1 — signoff

**Date:** 2026-08-06  
**Wave:** BE-Deep-1  
**Scope:** Money paths + SoD for Lite surfaces

## Delivered

- Fee assess posting (FEE_INCOME)
- Cash vault↔till posting
- Collections recovery SoD + NPL_WORKOUT / RECOVERY_INCOME
- LC/BG contingent issue posting (`TxnType.CONTINGENT`)
- Standing order `runDue` posting via STANDING_ORDER_CLEARING
- Credit line drawdown / islamic activate posting
- Cheque clear/bounce + sweep (cash-payments)
- Golden/unit: `be-deep-trade`, `be-deep-standing-order`, `be-collections`

## Honesty

- Contigent / islamic / recovery = lab GL mapping, not certified accounting policy
- External rail submit still stub (`BANK_RAIL_MODE`)

## Exit

- [x] Balanced leg utils + SoD self-approve reject
- [x] AC Scaffold ✅ for new AC-BNK-* with negatives
