# MDM natural-person identity — ecosystem audit matrix

Living baseline for natural-person `globalPersonId` linkage across ERA apps.

**SoR:** `era-orchestrator` → `era_mdm` (`GlobalNaturalPerson`, `PersonIdentifier`).

**Canonical client pattern:** `linkPersonIdentity` in `@era/satellite-kit` (lookup FIN → else resolve-or-create).

Related ADRs: [era-mdm-natural-person-identity.md](./adr/era-mdm-natural-person-identity.md) · [mdm-satellite-integration-contract.md](./adr/mdm-satellite-integration-contract.md)

| App | Entity | UI route | API | MDM pattern | Local ID fields | Enforcement | Gap | Wave |
|-----|--------|----------|-----|-------------|-----------------|-------------|-----|------|
| era-clinic | PatientRef | `/patients` | patient.service | linkPersonIdentity | finCode, passport, issuingCountry | **Strict** | — | 1 |
| era-clinic | Practitioner | `/admin/master-data` | `/api/admin/practitioners` | linkPersonIdentity | finCode, passport, phone | **Strict** | — | **Done** |
| era-hotel-pms | Guest | GuestCardModal | `/api/guests`, `/full` PATCH | linkPersonIdentity | nationalIdFin, passport | **Strong** | — | **Done** |
| era-finance-core | Employee | HR modal | `/hr/employees` | resolve on create/update | fin/passport cipher | **Strong** | — | 2 |
| era-finance-core | Counterparty ИП | CreateCounterpartyModal | POST counterparties | linkPersonIdentity + VÖEN | fin cipher + globalPersonId | **Read-only link** | — | 2 |
| era-bank-core | BankCustomer NATURAL | teller CIF | cif.service | linkPersonIdentity | globalPersonId only | **Strict** | — | 3 |
| era-bank | CIF ops UI | `/cif` | BFF + UBO modal | MDM badge + person-lookup | display masked | **Strong** | — | **Done** |
| era-fnb-pos | StaffRoster | — | `/api/labor/roster` | STAFF_PROVISIONED only | globalPersonId from Finance | **Event-driven** | — | 3 |
| era-logistics | — | — | — | N/A B2B | — | — | VÖEN via Finance | — |
| era-wholesale | — | — | — | N/A B2B | — | — | VÖEN via Finance | — |
| era-crm | Lead | — | convert → Finance CP | indirect | — | — | company VÖEN preview | — |

## Automation

```bash
node scripts/audit-mdm-identity.mjs
```

Fails CI when new create/PATCH routes use `lookupGlobalPersonByFin` without `linkPersonIdentity` / `resolvePersonIdentity`.

## Changelog

| Date | Change |
|------|--------|
| 2026-06-15 | Initial audit matrix; CLI-01 practitioner gap documented |
| 2026-06-15 | Wave 0–4 complete: linkPersonIdentity, practitioner/guest/finance/bank paths, merge ops UI |
| 2026-06-15 | Re-audit pass 2: era-bank CIF MDM badge + UBO modal SHIPPED (BANK-MDM-01) |
