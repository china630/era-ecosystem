# ADR: Statutory tax scheme (dated rules, not a second chart of accounts)

**Status:** Accepted — design. Not shipped.  
**Date:** 2026-10-18  
**Related:** [eqaime-s2s-submission.md](./eqaime-s2s-submission.md) · [finance-manual-adjusting-journal.md](./finance-manual-adjusting-journal.md) · [finance-per-book-period-close.md](./finance-per-book-period-close.md) · [vat-deposit-routing.md](./vat-deposit-routing.md) · [satellite-finance-bridge-pattern.md](./satellite-finance-bridge-pattern.md)

## Context

Operational satellites already post facts into Finance by posting role. Managers are not meant to see debits and credits. What is still missing is the layer above the ledger: which tax regime applies, which rate and document the fact requires, and what blocks a period close.

Today the simplified-tax export multiplies revenue by a flat **2%** (`tax-export.service.ts`). It does not apply the POS coefficient, the 2026 cashless rate, the e-qaimə share that ends simplified-tax eligibility, or a regime change. A VAT-threshold reminder exists; a regime switch does not.

e-Qaimə server submit is a process environment flag, `ERA_EQAIME_S2S_ENABLED`, not an organization setting. The manual adjusting journal is the way a tail is closed, and it is gated to `OWNER` / `ADMIN` / `ACCOUNTANT`.

Azerbaijan’s activity classifier (İFNT / NACE) is finite: 21 sections, 88 divisions, 272 groups, 615 classes, 751 subclasses. Almost all of them share one statutory skeleton (simplified tax while allowed, otherwise profit tax, plus VAT 18% once registered). Special cases are an exception list: another rate, excise, a simplified-tax ban, a licence, a different e-qaimə timing. Hotel, clinic, and food service are three sections of that table, not three engines.

## Decision

### 1. A scheme is a dated parameter set

A **tax scheme version** has `effectiveFrom` (and optional `effectiveTo`) taken from the legal act, not from the day the patch is published. Parameters, not journal lines:

- regime family: simplified tax, profit tax without VAT, profit tax with VAT;
- rates, thresholds, the POS coefficient, the e-qaimə share that cancels simplified tax;
- default line treatment: 18%, zero, exempt, out of scope, or a simplified-tax rate-card row;
- buyer class: population, VAT payer, legal entity without VAT, non-resident;
- settlement: cash register, POS, bank, offset;
- timing: advance versus delivered;
- when an e-qaimə is required.

One default tuple covers the common subclass. An exception is **one registry row** on the same axes (section, activity code, or a narrower condition). A new combination is a new row. It is not a new ledger and not a checkbox per theoretical cell.

Organizations do not copy the scheme. They bind to a published version and keep only local facts: activity section, elected regime, POS, licence, whether shelf prices include tax.

### 2. Publish, then recalc what is still open

SaaS publishes a scheme version from the server and applies it to bound organizations. On-prem receives the same package through the support channel. There is no second rule model.

- A period that is not yet filed is recalculated in place. The manager sees the delta.
- A filed period is not rewritten. The product drafts an amended declaration for the delta and will not close the next period until that draft is sent.
- A norm that has no retroactive force does not worsen a closed period.

### 3. Simplified-tax watcher (first scheme body)

The first scheme must replace the flat 2% export. Initial legal content, each item dated:

- VAT registration threshold **200 000 AZN** of taxable operations in any rolling 12 months;
- for retail and services to persons who are not tax-registered, POS cashless turnover enters that threshold at coefficient **0.5**;
- from **2026-01-01**, for three years, services to the population paid cashless via a POS integrated with the cash register are simplified-taxed at **6%** where that rule applies;
- simplified-tax eligibility ends when the quarter’s operations that must be covered by e-qaimə exceed **30%** of the relevant total (trade or services, non-operating income excluded);
- licensed activities and goods the code lists as ineligible cannot stay on simplified tax.

Crossing a line switches the regime from the date the code states. The general manager gets a marker, not a chart-of-accounts task: shelf prices that were gross to the guest now contain 18% VAT, and the screen shows the old price, the net, the gross, and the margin. Sales at the unconfirmed price list do not close the day.

### 4. Facts block the period; the manual journal does not

A bank line, cash movement, or delivery with no classified fact stays in a queue. Work may continue. The day or month does not close while the queue is non-empty. The person who knows what happened (the manager) picks a menu item. The system does not invent the meaning.

The manual adjusting journal stays an optional escape for `OWNER` / `ADMIN` / `ACCOUNTANT`. It is not the daily path. Reclassification posts a reversal and a new meaning; both remain. A filed period is corrected by the next document, not by editing the submitted figures.

A line may be posted as **provisional**: charge 18% and do not deduct the expense until the document exists. When the act or e-qaimə is linked, the scheme posts the adjustment: input VAT becomes creditable against later output VAT. A cash refund from the tax authority is not a button. That path is a separate audit.

### 5. Two different e-qaimə switches

| Switch | Where | Meaning |
|--------|--------|---------|
| Channel alive | Deployment setting (credentials, URL, signature). Today this is only `ERA_EQAIME_S2S_ENABLED` on the process. | Server submit is possible. Off means 503 and RPA prefill, as now. |
| Document required to close | Organization / scheme rule, visible in settings UI. | A fact that the scheme says needs an e-qaimə does not close the day without a linked document. |

The environment flag must not be the only place this policy lives. Deployment capability and the close rule are independent: a site can have a live channel and still decide, per scheme, which facts require the document.

## Current code this decision does not pretend is done

- Simplified-tax XML / amount: flat `0.02` on revenue credits.
- VAT threshold: reminder only.
- e-Qaimə S2S: env guard, COVERAGE `FIN-EQAIME-01` stays STUB/API until credentials and the org close rule exist.
- No provisional-VAT status, no unclassified-fact queue on period close, no dated scheme publication.

## Consequences

- Law changes are scheme versions, not a branch per rate.
- Hotel, clinic, and food service can ship on the common skeleton plus a short exception list. The other sections are more rows in the same registry.
- An accountant is optional on the queue and on scheme review. The posting path does not require one.
- Categorisation is rules and settings only. No model infers the tax meaning of a payment.

## Related

- [eqaime-s2s-submission.md](./eqaime-s2s-submission.md) — channel flag; close rule is this ADR
- [finance-manual-adjusting-journal.md](./finance-manual-adjusting-journal.md) — optional voucher
- [finance-per-book-period-close.md](./finance-per-book-period-close.md) — close stays per book; the fact queue is an additional gate
