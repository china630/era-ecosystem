# ERA Bank — ADR index

**Home for bank-domain ADRs** (`era-bank-core` engine, `era-bank` ops, `era-bank-dbo` channel). Platform / cross-satellite ADRs stay flat in [`docs/adr/`](../).

**Living implementation tracker:** [`.cursor/plans/bank-cbs-full.plan.md`](../../../.cursor/plans/bank-cbs-full.plan.md)  
**Acceptance:** [`Bank-Acceptance-System.md`](../../acceptance/Bank-Acceptance-System.md) · [`Bank-Capability-Inventory.md`](../../acceptance/Bank-Capability-Inventory.md) · Implementation / Product-Readiness / Sprint-Index under `docs/acceptance/Bank-*`.  
**Roadmap:** [`Bank-Full-CBS-Roadmap.md`](../../acceptance/Bank-Full-CBS-Roadmap.md)

## Reading order

| File | Role | Status |
|------|------|--------|
| [00-gap-vs-cbs-benchmarks.md](./00-gap-vs-cbs-benchmarks.md) | Gap vs mid-tier CBS (§§0–7) | Canon (analysis) |
| [01-az-regulatory.md](./01-az-regulatory.md) | AZ law map L1–L18 + [U] | Canon (analysis) |
| [02-remediation-backlog.md](./02-remediation-backlog.md) | P0/P1/P2 backlog + external blockers | Plan mirror |
| [era-bank-core.md](./era-bank-core.md) | Kernel D1–D9 (ledger vs finance, L1/L2/L3, branches, ACID, two-app) | **Accepted** |
| [era-bank-risk-and-audit.md](./era-bank-risk-and-audit.md) | Risk module + audit chain | Accepted |
| [era-bank-gl-account-mapping.md](./era-bank-gl-account-mapping.md) | Product + system GL mapping | Accepted |
| [era-bank-product-params.md](./era-bank-product-params.md) | Product Factory paramsJson | Accepted |
| [bank-multi-entity-holding.md](./bank-multi-entity-holding.md) | Holding / multi-entity (lab) | Accepted |
| [bank-domain-permissions-and-rbac.md](./bank-domain-permissions-and-rbac.md) | Variant A ops RBAC | Accepted |
| [03-external-blockers.md](./03-external-blockers.md) | Lawyer [U], CBAR, AKB, ASAN, cards partner gates | Living register |
| [bank-shared-az-residency.md](./bank-shared-az-residency.md) | SHARED pool + AZ data residency L10 | **DECLARED** |
| [bank-pension-psa-multi-entity-decision.md](./bank-pension-psa-multi-entity-decision.md) | Pension / PSA / multi-entity sell vs scaffold | **Accepted** |

## Stubs at old paths

Root files under `docs/adr/` that previously held this content are **stubs** pointing here:

- `docs/adr/bank-satellite-gap-analysis.md`
- `docs/adr/era-bank-core.md`
- `docs/adr/era-bank-risk-and-audit.md`
- `docs/adr/era-bank-product-params.md`
- `docs/adr/era-bank-gl-account-mapping.md`
- `docs/adr/bank-multi-entity-holding.md`
- `docs/adr/bank-domain-permissions-and-rbac.md`

## Locked architecture decisions (summary)

- Banking GL in `era-bank-core`; bank corporate books in `era-finance-core` (D1/D7).
- Thin kernel L1; product modules L2; Product Factory L3 (D2).
- Money postings: one ACID transaction, Serializable / row lock — never BullMQ (D6).
- Two-app: headless engine + ops satellite (+ DBO channel) (D9).
- Branches are dimensions, not orgs (D5).
