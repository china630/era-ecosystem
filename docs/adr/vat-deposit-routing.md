# ƏDV deposit account routing (Wave 4)

## Status

Accepted — GL tracking and payment routing for the treasury VAT deposit account (ƏDV depozit hesabı).

## Context

Azerbaijani VAT payers remit collected VAT through a dedicated treasury deposit IBAN. ERA Finance previously classified bank accounts as `BankAccountType.VAT_DEPOSIT` but had no GL mechanics or payment routing. Wave 4 Block A aligned VAT posting roles with the NAS chart; Block E adds deposit lifecycle operations.

## Decision

### Chart and posting roles

| Role | Default NAS code | Meaning |
|------|------------------|---------|
| `VAT_INPUT` | **191** | Alınmış dəyərlər üzrə ƏDV |
| `VAT_OUTPUT` | **545** | Hesablanmış ƏDV (commercial preset) |
| `VAT_DEPOSIT_ACCOUNT` | **223** | ƏDV depozit hesabı |

Preset: `posting-roles-commercial.json`. Resolver: `PostingAccountResolver`. Output VAT is posted on invoice SENT for VAT payers. Netting uses Dr output / Cr 191.

### Bank account link

- Org may register one or more **`organization_bank_accounts`** with `accountType = VAT_DEPOSIT`.
- Optional `ledgerAccountCode` override; otherwise resolver uses role `VAT_DEPOSIT_ACCOUNT`.
- UI shows linked IBAN on `/reporting/vat-deposit`.

### Operations (`VatDepositService`)

| Action | Posting (simplified) | API |
|--------|----------------------|-----|
| **Route** incoming VAT share from main bank to deposit | Dr 223 / Cr bank | `POST /api/accounting/vat-deposit/route` |
| **Remit** VAT payment to treasury from deposit | Dr 521 (or tax payable) / Cr 223 | `POST /api/accounting/vat-deposit/remit` |
| **Reconcile** statement line to deposit movement | Match + optional adjustment journal | `POST /api/accounting/vat-deposit/reconcile` |
| **Balance / movements** | Read GL + `VatDepositLedger` audit rows | `GET …/balance`, `GET …/movements` |

All mutations run in **`prisma.$transaction`** with period-lock checks.

### UI and entitlements

- Web: **`/reporting/vat-deposit`** — balance, movement list, route/remit/reconcile actions.
- `@RequiresModule(tax_pro)` + `VoenIntegrityGuard` on all endpoints.

### e-taxes cabinet sync

Reconciliation against the e-taxes VAT ledger account is **reserved** for when e-Qaimə / e-taxes S2S credentials are live (`ERA_EQAIME_S2S_ENABLED` / HSM). Bank-statement reconcile is implemented in Wave 4.

## Consequences

- Orgs without a `VAT_DEPOSIT` bank account still post to account **223** via role; UI warns and suggests linking IBAN.
- Incorrect legacy overrides (`VAT_INPUT→241`) should be migrated via org posting-role import or manual fix.
- Full parity with 1C treasury VAT deposit workflows is **partial** until automated split on every inbound payment is wired (manual route/remit SHIPPED).

## Related

- [eqaime-s2s-submission.md](./eqaime-s2s-submission.md)
- [etaxes-hsm-asan-submission.md](./etaxes-hsm-asan-submission.md)
