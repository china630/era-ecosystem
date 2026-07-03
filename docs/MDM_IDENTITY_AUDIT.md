# MDM natural-person identity — ecosystem audit matrix

Living baseline for natural-person `globalPersonId` linkage across ERA apps.

**Layer audit (schema → UI → enforcement):** [DATA_MODEL_INTEGRATION_AUDIT.md](./DATA_MODEL_INTEGRATION_AUDIT.md) — authoritative for compliance gaps.

**SoR:** `era-orchestrator` → `era_mdm` (`GlobalNaturalPerson`, `PersonIdentifier`).

**Canonical client pattern:** `linkPersonIdentity` in `@era/satellite-kit` (lookup FIN → else resolve-or-create).

Related ADRs: [era-mdm-natural-person-identity.md](./adr/era-mdm-natural-person-identity.md) · [mdm-satellite-integration-contract.md](./adr/mdm-satellite-integration-contract.md)

| App | Entity | UI route | API | MDM pattern | Local ID fields | Enforcement | Gap | Wave |
|-----|--------|----------|-----|-------------|-----------------|-------------|-----|------|
| era-clinic | PatientRef | `/patients` | patient.service | linkPersonIdentity | MDM-only (`globalPersonId`) | **Strict** | — | **Done** (W1) |
| era-clinic | Practitioner | `/admin/master-data` | `/api/admin/practitioners` | CP hire + STAFF_PROVISIONED | MDM-only (`globalPersonId`); ops cache T3 | **Strict** create blocked | — | **Done** (v3 E) |
| era-hotel-pms | Guest | GuestCardModal | `/api/guests`, `/full` PATCH, `/api/mdm/person-ops-profile` | linkPersonIdentity + ops-profile | **MDM-only identity** (W4) | **Strong + ops cache** | [hotel-guest-pii-ops-cache ADR](./adr/hotel-guest-pii-ops-cache.md) | **COMPLIANT** |
| era-finance-core | Employee | HR modal | `/hr/employees` | resolve on create/update | fin/passport cipher | **Strong** | — | 2 |
| era-finance-core | Counterparty ИП | CreateCounterpartyModal | POST counterparties | linkPersonIdentity + VÖEN | fin cipher + globalPersonId | **Read-only link** | — | 2 |
| era-bank-core | BankCustomer NATURAL | teller CIF | cif.service | linkPersonIdentity | globalPersonId only | **Strict** | — | 3 |
| era-bank | CIF ops UI | `/cif` | BFF + UBO modal | MDM badge + person-lookup | display masked | **Strong** | — | **Done** |
| era-fnb-pos | StaffRoster | — | `/api/labor/roster` | STAFF_PROVISIONED from **CP** | globalPersonId + cpEmploymentId | **Event-driven** | — | **Done** (v3) |
| era-logistics | — | — | — | N/A B2B | — | — | VÖEN via Finance | — |
| era-wholesale | — | — | — | N/A B2B | — | — | VÖEN via Finance | — |
| era-crm | Lead | — | convert → Finance CP | indirect | — | — | company VÖEN preview | — |

## Automation

<!-- AUDIT:AUTO:mdm-scan-summary -->
MDM domain flags: **0** issue(s) as of 2026-06-16.
<!-- /AUDIT:AUTO:mdm-scan-summary -->

```bash
npm run audit:integration:strict
node scripts/audit-mdm-identity.mjs
```

## Changelog

| Date | Change |
|------|--------|
| 2026-06-15 | Initial audit matrix; CLI-01 practitioner gap documented |
| 2026-06-16 | R1 re-audit — clinic/hotel MDM COMPLIANT; W4 guest ops-profile |
| 2026-06-15 | Wave 0–4 complete: linkPersonIdentity, practitioner/guest/finance/bank paths, merge ops UI |
| 2026-06-15 | Re-audit pass 2: era-bank CIF MDM badge + UBO modal SHIPPED (BANK-MDM-01) |
| 2026-06-16 | Layer audit: clinic plaintext PII = drift (not planned); practitioner Open; see DATA_MODEL_INTEGRATION_AUDIT |
| 2026-06-16 | Guest row: Strong + ops cache ADR; status Open until W4 schema DROP |
| 2026-06-16 | W1 clinic: PatientRef/Practitioner MDM-only storage; strict practitioner create |
