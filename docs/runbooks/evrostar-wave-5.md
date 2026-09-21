# Evrostar Wave 5 — NAS ops freeze + MGMT labor delta + warehouse owners

**ADR:** [evrostar-workforce-pilot.md](../adr/evrostar-workforce-pilot.md) §5  
**Capability:** `FIN-BOOK-MGMT-01` (**API**, not SHIPPED / not `ga`)  
**Depends on:** Wave 1 (timesheet APPROVED → payroll NAS)

## Goal

Per VÖEN: white payroll + tax from **NAS** (`isDefaultOps` forever); owner sees full labor cost in **MGMT** via idempotent labor **delta** only; chemicals/PPE stock on each org’s own warehouse → NAS GL. No MGMT pay / cash / tax XML.

## Preconditions

- Each org: `hr_full`, NAS, `inventory`, entitlement **`accounting_book_extra` quantity 1**.
- Create MANAGEMENT book `code=MGMT` with **`coaStrategy=NAS_CLONE`** (wizard default for MANAGEMENT). Do **not** publish live NAS→MGMT mapping for cash/payroll.
- Set `Employee.internalRate` (card or CSV column 3) as **OWNER/ADMIN/DIRECTOR** only — ACCOUNTANT never sees grey rate; HR_MANAGER only if `settings.hr.internalRateVisibleToHrManager=true`.

## UAT steps

1. **Ops freeze** — `PATCH /api/accounting/books/{mgmtId}/default-ops` → 400 `OPS_BOOK_MUST_BE_NAS`. NAS remains default ops.
2. **Accountant chrome** — ACCOUNTANT book selector hides MGMT; `GET reporting/pl?accountingBookId={mgmt}` **and** `pl/export` → 403; `compare-books` nav hidden; API OWNER/ADMIN/DIRECTOR only. Manual adjustment to MGMT as ACCOUNTANT → 403.
3. **Contract vs internal** — OWNER sets salary 1000, internalRate 2000; payroll draft gross uses **1000**, not 2000. ACCOUNTANT GET employee has no `internalRate`.
4. **Delta** — APPROVE timesheet (or CP approve) → open Finance **`/hr/mgmt-labor-delta`** (OWNER/ADMIN/DIRECTOR) → Rebuild for month → MGMT JE Dr 721 / Cr 533 for delta only; NAS trial balance unchanged. Clear internalRate and rebuild → prior JE storno’d (orphans cleared). Rebuild again → storno + rewrite. API: `POST /api/hr/mgmt-labor-delta/rebuild?year=&month=`.
5. **No pay from MGMT** — No UI to pay delta; salary XML / mark-paid / cash / bank / stock post to NAS only.
6. **Warehouse** — Create warehouse on org A and org B; stock does not share; movements post NAS.

## Bulk salaries

CSV (not xlsx in this wave): `employeeId,salary[,internalRate]`. Column 3 requires OWNER/ADMIN/DIRECTOR.

## Out of scope

- Cash envelope from kassa for “grey” pay, second DSMF, IFRS, FaceID, holding shared stock.

## Evidence

Jest: `wave5-ops-mgmt.spec.ts`, `wave5-mgmt-delta.spec.ts`. COVERAGE stays **API** until Lab + field UAT.

## Commercial note

Extra book slot ≈ 19 ₼ × 2 orgs. Product language: management cost book — **not** “undeclared wage payment”.
