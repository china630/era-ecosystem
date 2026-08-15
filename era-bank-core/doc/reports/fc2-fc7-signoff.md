# FC-2…FC-7 — Full CBS lab depth signoff

**Date:** 2026-08-06  
**Scope:** `era-bank-core` engine waves FC-2 through FC-7  
**Migration:** `20260806030000_fc2_fc7_depth`  
**Tests:** `apps/api/__tests__/fc2-fc7.spec.ts`

## Waves closed

| Wave | Delivered (lab) |
|------|-----------------|
| FC-2 | Product kind params validation + hints; CreditPolicyRule; score() policy merge; ForbearanceStage; loan/deposit contract fields |
| FC-3 | 3DS threshold gate on authorize; dispute transition workflow; AcquiringMerchant + merchant auth |
| FC-4 | MoneyMarketPlacement book/post; nostro corr payment; SCF activate/fund; packing credit register; SWIFT MT catalog |
| FC-5 | AML batch screen; fraud device/mule fields + payment submit hook; PEP/mlScore ops; IRRBB gap; OpRisk capital add-on; FATCA workflow; large exposure report |
| FC-6 | CustodyPositionLedger + CSD field; InsuranceProduct/policy link; queue assign/CRM notes; DBO Open AIS accounts |
| FC-7 | Inventory optional GL post; credit policy + forbearance stage API routes; insurance beyond affiliate commission |

## Explicit non-claims

- `pilot_ready` remains **false**
- Card/SWIFT/rails remain **mock / SENT_STUB**
- No live ASAN, AKB, or CBAR submit

## Verification

```bash
cd era-bank-core
npm run db:generate
npm test -- fc2-fc7
npm run build
```

## Inventory

Updated rows in [Bank-Capability-Inventory.md](../../../docs/acceptance/Bank-Capability-Inventory.md) PARTIAL→IN for FC scope.
