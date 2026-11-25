# ADR: Construction estimate hierarchy (five-level smeta pack)

**Status:** Accepted  
**Date:** 2026-11-20  
**Coverage:** Construction ops estimate pack · dual mode per project · Finance bridges only

**Related:**

- [construction-domain-boundaries.md](./construction-domain-boundaries.md)
- [era-commercial-catalog.md](./era-commercial-catalog.md) — SKU `construction_estimate_hierarchy`
- [satellite-finance-bridge-pattern.md](./satellite-finance-bridge-pattern.md)
- Standards (open): RF Methodology **421/пр** §25; RF PP **87** (SSR chapters); AZ ARXKOM smeta practice + Forma-2/3

---

## Context

Government and mixed contractors need the CIS/AZ **five-document estimate pack** (lokal → obyekt → special costs → сводный → сводка затрат), approval, and plan–fact against acts. Private jobs often need only a flat BOQ. One org may run **both** in the same satellite.

ERA already has flat `BoqLine` + `ProgressAct` / lines (ops) and Finance Contract SOV / PayApp / KS print (money). Hierarchy must deepen Construction without relocating the ledger.

---

## Decision

### D1 — Dual mode on the project (not org-wide mutex)

| Field | Values |
|-------|--------|
| `Project.estimateMode` | `FLAT_BOQ` (default) \| `ESTIMATE_HIERARCHY` |

- Org SKU `construction_estimate_hierarchy` entitles hierarchy features.
- Same org may have project A = flat and project B = hierarchy.
- Org default for new projects may prefer hierarchy when SKU is on; per-project override remains.

### D2 — Estimate pack model (Construction owns)

| Entity | Role |
|--------|------|
| `EstimatePackage` | Versioned pack on a project; status workflow |
| `EstimateDocument` | One of: `LCR` \| `OCR` \| `SC` \| `SSR` \| `COST_SUMMARY` (+ optional `chapterNo` for SSR chapters) |
| `EstimateLine` | Qty / rate / amount under an LCR (or SC); ops leaf |

Cipher examples: `ЛС-02-01-01`, `ОС-02-01`, `СР-1`, `ССРСС`.  
OCR may be omitted when a single LCR covers the object (421/пр).  
COST_SUMMARY only when multi-stage / mixed composition needs it.

### D3 — Status workflow (Contour A)

`DRAFT` → `INTERNAL_REVIEW` → `EXTERNAL_REVIEW` → `APPROVED` → (`SUPERSEDED` on new version)

- `APPROVED` is immutable; changes require a new package version.
- On approve: project ops `BoqLine` rows are **projected** from LCR/SC lines (same `itemCode`); plan–fact and acts keep using BOQ / act lines.
- Money truth stays Finance.

### D4 — Contour B (execution) unchanged in ownership

- Forma-2-class pack = `ProgressAct` + lines (Construction).
- Forma-3 / KS / PayApp / payment = Finance (`contract_payapp_ks`).
- Bridges: optional SOV seed from approved baseline; richer `SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED`; `SATELLITE_CONSTRUCTION_ESTIMATE_PACKAGE_APPROVED` for Finance consumers.

### D4b — Finance Contract SOV seed (from estimate approve)

| Rule | Behavior |
|------|----------|
| Trigger | `APPROVED` + event `SATELLITE_CONSTRUCTION_ESTIMATE_PACKAGE_APPROVED` with `lines[]` |
| Gate | `financeContractId` on pack/project; missing → Finance no-op (`missing_financeContractId`) |
| Target | Finance `ContractLine` (SOV); **no** GL / journal |
| Idempotency | `ContractCommitment` `referenceType=construction_estimate`, `referenceId=packageId` |
| Conflict | If SOV has lines and no prior estimate commitment → skip `SOV_NONEMPTY_MANUAL` (do not wipe hand edits) |
| Supersede | Prior estimate commitment on same contract may be replaced when a new pack seeds |
| Amount limit | Set `contract.amountLimit` from pack total only when currently null |

### D5 — Plane rules

1. Do **not** put GL, PayApp ledger, or payment rails in Construction.
2. Do **not** require hierarchy for flat projects.
3. Do **not** duplicate Contract SOV as accounting truth in Construction — refs + events only.

---

## Consequences

- PRD M2 deepens; new coverage `CN-EST-01` / AC-CON-EST.
- UI: single hub tab **Estimate** switches flat vs tree by `estimateMode`.
- Acceptance: Scaffold only with negatives + UAT; no false `ga`.
- Normative rate databases (full DESN engines) are out of **estimate hierarchy v1** — import + hierarchy + rollup + approval are in. Rate-engine MVP is a **separate Construction SKU debt**: [construction-smeta-rate-engine.md](./construction-smeta-rate-engine.md).

## References

Pilot intake: [`docs/products/ERA-Construction-Pilot-Anket-AZ.md`](../products/ERA-Construction-Pilot-Anket-AZ.md)  
Sprint: `S-ESTIMATE-HIER` in Construction-Sprint-Index
