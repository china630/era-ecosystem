# Evrostar Wave 7 — ƏMAS / portal (manual + extension prefill)

**ADR:** [workforce-compliance-emas-boundary.md](../adr/workforce-compliance-emas-boundary.md)  
**Pilot:** [evrostar-workforce-pilot.md](../adr/evrostar-workforce-pilot.md) wave 7  
**Capability:** `FIN-EMAS-01` (**STUB** / API — not SHIPPED until live portal UAT)

## Goal

Per VÖEN: HR gets ERA help for **manual** ƏMAS filing — order PDF (CP wave 4) + e-müqavilə prefill (extension). No auto-İmzala. No S2S until `EMAS_SUBMIT_URL` + operator contract. **Never** send `Employee.internalRate` to the portal.

## Org policy (`settings.hr.emasMode`)

| Mode | Behavior |
|------|----------|
| `OFF` (default) | Hire/terminate do **not** create queue rows |
| `SELECTIVE` | Queue only when `emasEligible` (FIN present) |
| `FULL` | Queue all hires/terminates; FIN may still be pending; hire returns `emasFinWarning` |

UI: Finance **Organization settings** → ƏMAS mode (per legal entity / VÖEN).  
API: `PATCH /api/organizations/settings` `{ "emasMode": "SELECTIVE" }`.

## Manual queue

On CP hire/terminate mirror (and Finance local hire): create `EmasContractEvent` **`PENDING_MANUAL`** — **no HTTP**.

UI: `/hr/emas-queue`

- Prefill JSON download (`salaryGrossAzn` = contract salary)
- Per-row deep-link to CP personnel orders `?employmentId=&autoPdf=1&orderType=` (auto-download ISSUED PDF; DRAFT → toast Issue first)
- Open portal + copy employeeId for extension
- Mark submitted → `SUBMITTED_MANUAL` + actor/time/note audit
- CSV export (Excel-compatible; columns FIN, name, dates, contract salary — **no** `internalRate`)
- Status label: plan ERROR = schema `FAILED`

Import of ƏMAS portal export for FIN reconcile — deferred (no stable layout).

S2S buttons on employee card are **Advanced** (collapsed); primary CTA is `/hr/emas-queue`. Adapter → **503** when unset (correct).

## Convert-to-FIN / salary 0

- Employee card: convert-to-FIN when no FIN / `emasEligible=false`
- List badges: `PENDING_FIN`, missing contract salary + filter
- FULL hire without FIN → toast / CP confirm

## Extension

- Host `emas.sosial.gov.az`, entitlement `hr_full`
- Queue picker: `PENDING_MANUAL` READY rows for current org (Advanced UUID still available)
- Missing ERP VÖEN or portal mismatch → block autofill
- Prefill only when `emasStatus=READY`; **user clicks İmzala**
- Shared `EMAS_FIELD_MAPPING_VERSION` (`@erafinance/api-contracts`) — DOM miss → hard error

## Lab UAT / UAT-SMOKE

See [era-finance-core/doc/UAT-SMOKE.md](../../era-finance-core/doc/UAT-SMOKE.md) § FIN-EMAS-01.

1. Set org A `emasMode=FULL`, hire → queue row PENDING_MANUAL.
2. Org B queue empty for org A employee (isolation).
3. Prefill JSON has no `internalRate`.
4. Mark submitted → SUBMITTED_MANUAL (who/when visible).
5. S2S hire without gateway → 503; employee still exists.
6. Extension: wrong portal VÖEN → blocked; AwaitSign does not auto-click.
7. Convert-to-FIN on card → PENDING_FIN clears; extension select shows READY.
8. Queue Order PDF → CP `autoPdf=1` downloads ISSUED (or toast if DRAFT).
9. Salary 0 badge → set salary → READY for prefill.

## Out of scope

Headless portal login, fake-success S2S stub, auto-bildiriş, FaceID→ƏMAS, edition `ga`.

## Evidence

Jest: `emas-wave7.spec.ts`, `emas-extension-wave7.spec.ts`, employment sync FIN/`emasEligible`. COVERAGE stays **STUB** until field portal signoff. **P1:** CP transfer mirror enqueues TRANSFER; Excel import marks queue SUBMITTED_MANUAL; queue shows PENDING_SALARY + actor email — still STUB (no live portal). **P2:** distinct labels for queue CSV vs portal-result xlsx vs salary CSV; S2S mutations only when `s2sConfigured`.
