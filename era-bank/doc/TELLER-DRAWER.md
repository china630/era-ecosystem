# Teller cash drawer (vNext)

**Status:** Document-only for ops-mvp. Physical drawer reconciliation is **not** implemented in this release.

## Intended model

| Concept | Location |
|---------|----------|
| Cash GL (`1000101`) | `era-bank-core` ledger |
| Teller session | `era-bank` `OpsSession.branchId` + ops user |
| Drawer limit | `OpsRole.limitsJson.maxDebitMinor` |

## GA behaviour

- Teller posts cash deposit/withdrawal via `/postings/new` → engine teller templates → maker-checker queue.
- Branch manager approves on `/postings/[id]`.
- No separate drawer float table in `era_bank` DB (by design — money only in core).

## vNext (pilot if required)

1. Link `OpsSession` to vault GL sub-account or branch cash position snapshot.
2. End-of-shift reconciliation: counted cash vs GL `1000101` branch slice.
3. Over/short posting template with compliance approval.

See plan wave W4.4 in internal delivery docs.
