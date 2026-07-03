# Data model integration audit — layer matrix (MDM, data-hub, HR provision)

Living audit of **schema → service → API → UI → enforcement → docs** alignment with ecosystem integration contracts.

**Date:** 2026-06-16 (R1 re-audit v2)  
**Scope:** All `era-*` apps + `packages/satellite-kit` integration clients  
**R1 delta:** [audit-snapshots/r1-delta-2026-06-16.md](./audit-snapshots/r1-delta-2026-06-16.md)  
**Automation:** `npm run audit:integration:strict` (W5 unified runner)

---

## 1. Methodology

### 1.1 Integration domains

| Domain | System of record | Primary ADR |
|--------|------------------|-------------|
| **A. MDM natural person** | `era-orchestrator` → `era_mdm` (`GlobalNaturalPerson`, `PersonIdentifier`) | [era-mdm-natural-person-identity.md](./adr/era-mdm-natural-person-identity.md) |
| **B. MDM legal entity** | `era_mdm` (`GlobalLegalEntity`) + Finance counterparty registry | [mdm-legal-entity-vs-finance-counterparty-registry.md](./adr/mdm-legal-entity-vs-finance-counterparty-registry.md) |
| **C. Reference data** | `era-data-hub` `/registry/v1/*` (SoR); industry reads via orchestrator gateway | [reference-data-ecosystem.md](./adr/reference-data-ecosystem.md), [orchestrator-platform-integration-gateway.md](./adr/orchestrator-platform-integration-gateway.md) |
| **D. Workforce identity** | Finance `Employee` → `SATELLITE_STAFF_PROVISIONED` | [workforce-identity-and-hr-provisioning.md](./adr/workforce-identity-and-hr-provisioning.md) |
| **E. Finance counterparty** | `era-finance-core` tenant DB + MDM link for ИП | Finance TZ §28 / PRD §4.18 |

### 1.2 Layers (per entity)

| Layer | What we check |
|-------|----------------|
| **L1 Schema** | Fields on Prisma model vs ADR (e.g. `globalPersonId` only vs plaintext PII) |
| **L2 Service** | `linkPersonIdentity` / resolve / merge; cipher patterns; transactional integrity |
| **L3 API** | DTO accepts identifiers; calls identity client on POST/PATCH |
| **L4 UI** | Create + edit hydrate; list columns; MDM lookup/merge; masked badge |
| **L5 Enforcement** | Strict / Strong / Event-driven tier vs runtime behaviour |
| **L6 Docs** | `COVERAGE_MATRIX`, DELIVERY `[x]`, prior audit rows match code |

### 1.3 Status codes

| Code | Meaning |
|------|---------|
| **COMPLIANT** | All checked layers match contract |
| **SCHEMA_DRIFT** | DB model violates ADR (e.g. plaintext FIN when MDM-linked) |
| **API_ONLY** | Backend wired; UI incomplete |
| **UI_GAP** | Form/list/hydrate broken or incomplete |
| **ENFORCEMENT_GAP** | Documented Strict/Strong but optional at runtime |
| **DOC_DRIFT** | COVERAGE/DELIVERY/audit doc claims SHIPPED/Done; code disagrees |
| **ADR_CONFLICT** | Code follows one pattern; ADR states another (needs ADR amend or refactor) |
| **N/A** | No natural-person entity; B2B / event-only |

---

## 2. Normative rules (baseline)

From [mdm-satellite-integration-contract.md](./adr/mdm-satellite-integration-contract.md) and [era-common-laws](../.cursor/rules/era-common-laws.mdc):

1. Industry satellites store **`globalPersonId`** for natural-person identity links; **identifier values (FIN, passport) live in MDM**, not duplicated as plaintext on satellite models (see [hotel-guest-pii-ops-cache.md](./adr/hotel-guest-pii-ops-cache.md) for hotel ops-cache exception).
2. Client pattern: **`linkPersonIdentity`** (lookup FIN → else resolve-or-create) — not lookup-only on create routes.
3. **Anti-pattern:** duplicate FIN/passport **plaintext** in satellite DB when MDM-linked.
4. Reference data: industry satellites **must not** call `era-data-hub` or `era-finance-core` for **sync global catalog reads** (calendar, FX display convert, VÖEN directory). Use **Orchestrator Platform Gateway** `GET /platform/v1/catalog/*` via `@era/satellite-kit` — [orchestrator-platform-integration-gateway.md](./adr/orchestrator-platform-integration-gateway.md). HS tariff preview and tenant counterparty operations remain Finance-only.
5. Workforce (v3): **single hire path** via CP `/workspace/workforce` when `platform_workforce` entitled (`hireMode=cp_workforce`); SatAdmin practitioner **POST forbidden**; CP publishes `STAFF_PROVISIONED`; Finance mirrors payroll when `hr_full` entitled. See [cp-core-workforce-hub.md](./adr/cp-core-workforce-hub.md).

**Clarification (2026-06-16):** Local plaintext copies of FIN/passport on `era-clinic` models were **not** an intentional product decision — they are **schema drift** from the MDM contract (same class of issue as hotel guest identifier fields retained locally).

---

## 3. Domain A — MDM natural person

### 3.1 Enforcement tiers (ADR)

| Tier | Rule | Declared entities |
|------|------|-------------------|
| **Strict** | Block save without resolved `globalPersonId` when identifier provided | PatientRef, Practitioner, Bank CIF natural |
| **Strong + ops cache** | Resolve mandatory; no plaintext FIN/passport on `Guest` after W4 | Guest — [hotel-guest-pii-ops-cache.md](./adr/hotel-guest-pii-ops-cache.md) |
| **Strong** | Cipher + blind index + `globalPersonId`; Finance SoR | Employee (Finance) |
| **Event-driven** | `globalPersonId` from CP `STAFF_PROVISIONED` v2 (`cpEmploymentId`); SatAdmin hire blocked when `cp_workforce` | FNB StaffRoster, clinic Practitioner |
| **Read-only link** | VÖEN primary; FIN links person | Counterparty ИП |

### 3.2 Entity matrix

| App | Entity | L1 Schema | L2 Service | L3 API | L4 UI | L5 Enforcement | L6 Docs | Overall |
|-----|--------|-----------|------------|--------|-------|----------------|---------|---------|
| **era-clinic** | `PatientRef` | **COMPLIANT** — `globalPersonId` only (W1) | `linkPatientGlobalPerson` MDM-only persist | strict create + transient identifiers | `/patients` MDM badge + types | **Strict** | CLI-MDM-02 SHIPPED | **COMPLIANT** |
| **era-clinic** | `Practitioner` | **COMPLIANT** — `globalPersonId` only (W1) | resolve-first create | strict POST; PATCH transient | master-data MDM + identifier types | **Strict** create | CLI-01 / CLI-MDM-01 | **COMPLIANT** |
| **era-clinic** | `ClinicalEpisode` | `globalPersonId` only (OK) | copied from patient on flows | — | — | N/A | — | **COMPLIANT** |
| **era-hotel-pms** | `Guest` | **COMPLIANT** — `globalPersonId` + ops cache only (W4); identity via MDM ops-profile | `guest-identity.ts` + `linkPersonIdentity` | `/api/guests`, `/full` PATCH, `/api/mdm/person-ops-profile` | GuestCardModal — masked MDM + transient lookup | **Strong + ops cache** — `ERA_HOTEL_GUEST_MDM_STRICT=true` in prod templates | HOT-MDM-01 SHIPPED | **COMPLIANT** |
| **era-finance-core** | `Employee` | Cipher + blind index + `globalPersonId` (Finance exception: encrypted operational copy) | `resolvePersonIdentity` on hire/update | `/hr/employees` | HR modal + MDM badge | **Strong** — resident FIN required | FIN-HR-MDM-01 SHIPPED — **accurate** | **COMPLIANT** (Finance SoR) |
| **era-finance-core** | `Counterparty` (ИП) | `finCodeCipher` + `globalPersonId` | `linkPersonIdentity` on FIN | POST/PATCH counterparties | Create modal | Read-only link tier | FIN-CP-MDM-01 SHIPPED | **COMPLIANT** |
| **era-bank-core** | `BankCustomer` NATURAL | **`globalPersonId` only** — no plaintext FIN in schema | `cif.service` + `MdmClient` | CIF API | via `era-bank` BFF | **Strict** with `MDM_REQUIRED` | — | **COMPLIANT** |
| **era-bank** | CIF ops display | `globalPersonId` on local mirror | person-lookup BFF | `/api/mdm/person-lookup` | CIF modal MDM badge + UBO | Strong | BANK-MDM-01 SHIPPED | **COMPLIANT** |
| **era-fnb-pos** | `StaffRoster` / `User` | `globalPersonId` only (+ financeEmployeeId) | staff-provision handler | `/api/integration/staff-provision` | — (PIN roster) | Event-driven | — | **COMPLIANT** |
| **era-clinic** | staff via event | Practitioner upsert | `staff-provision.ts` | integration route | — | Event-driven; **no PII in event path** | — | **COMPLIANT** (no hire UI) |
| **era-logistics** | — | no person model | — | — | — | N/A B2B | — | **N/A** |
| **era-wholesale** | — | no person model | — | — | VÖEN via Finance | N/A | — | **N/A** |
| **era-retail-pos** | — | no person model | — | — | — | N/A | — | **N/A** |
| **era-construction** | — | no person model | — | — | VÖEN preview | N/A | — | **N/A** |
| **era-crm** | Lead + `globalPersonId?` | convert → Finance CP auto-create | voen-preview | leads VÖEN persisted | indirect | — | **COMPLIANT** (v3.0) |
| **era-auto-service** | — | no person model | — | — | VÖEN on work orders | N/A | — | **N/A** |

### 3.3 Historical — clinic practitioner (closed W1 + W3)

| Layer | v1 finding (2026-06-16) | R1 status |
|-------|-------------------------|-----------|
| L1 | Plaintext identity on Practitioner | **Closed W1** — MDM-only schema |
| L4 | Edit hydrate gaps | **Closed W1** — transient identifiers + MDM types |
| L5 | Save without MDM | **Closed W1/W3** — strict create; finance_hr POST blocked |
| L6 | DOC_DRIFT on SHIPPED rows | **Closed R1** — COVERAGE reconciled |

### 3.4 PII duplication summary (schema drift)

| App | Models with plaintext identifier + `globalPersonId` | ADR expectation |
|-----|-----------------------------------------------------|-----------------|
| era-clinic | `PatientRef`, `Practitioner` | `globalPersonId` only for identity (Wave 1) |
| era-hotel-pms | ~~`Guest`~~ | **COMPLIANT W4** — identity MDM-only; ops cache retained |

**Target state:** identifiers entered at intake → `linkPersonIdentity` → persist **`globalPersonId`** on satellite; display/edit resolves from MDM (`person-lookup` / ops-profile) or shows masked badge. Finance/bank pattern is the reference for strict tiers; hotel retains documented ops cache.

---

## 4. Domain B — MDM legal entity

| App | Mechanism | Status |
|-----|-----------|--------|
| era-orchestrator | `GlobalLegalEntity` on org register; `/internal/v1/mdm/legal-entities/*` | **COMPLIANT** (HEADLESS API) |
| era-finance-core | `Counterparty` + VÖEN blind index; hub `companies/:voen` read-through | **COMPLIANT** |
| Industry satellites | `platformVoenLookup` / `voen-preview` BFF → orchestrator gateway | **COMPLIANT** (W2) |
| era-crm | Lead VÖEN preview → convert to Finance counterparty | **COMPLIANT** (indirect) |

No schema drift found for legal-entity ownership (Finance + MDM split is respected).

---

## 5. Domain C — Reference data (era-data-hub)

### 5.1 Primary consumers (expected direct hub)

| App | Client | Catalogs | Status |
|-----|--------|----------|--------|
| era-data-hub | SoR | all `/registry/v1/*` | **COMPLIANT** |
| era-finance-core | `DataHubClientService` | FX, calendar, HS, banks, IBAN, VÖEN dir, geo, UoM, tax, CoA | **COMPLIANT** + fallback |
| era-bank-core | `DataHubClient` + on-prem snapshot | FX, calendar, banks, IBAN, CoA subset | **COMPLIANT** |

### 5.2 Industry satellites — platform gateway (target ADR)

**Target rule:** [orchestrator-platform-integration-gateway.md](./adr/orchestrator-platform-integration-gateway.md) — industry calls orchestrator `GET /platform/v1/catalog/*` only (via `@era/satellite-kit`).

| App | FX preview | VÖEN UI | Calendar usage | Status |
|-----|------------|---------|----------------|--------|
| era-logistics | legacy via kit → orch gateway | — | `getCalendarDay` via platform catalog | **COMPLIANT** (W2) |
| era-wholesale | legacy via kit → orch gateway | `platformVoenLookup` | same | **COMPLIANT** (W2) |
| era-hotel-pms | legacy via kit → orch gateway | travel agencies / CP | `getCalendarDaysRange` for auto-BAR | **COMPLIANT** (W2) |
| era-construction | — | `platformVoenLookup` | calendar client | **COMPLIANT** (W2) |
| era-crm | — | `platformVoenLookup` | calendar client | **COMPLIANT** (W2) |
| era-auto-service | — | `platformVoenLookup` | calendar client | **COMPLIANT** (W2) |
| era-clinic | — | N/A | `getCalendarDay` in scheduling | **COMPLIANT** (W2) |
| era-retail-pos | — | — | none detected | **COMPLIANT** |
| era-fnb-pos | — | — | none detected | **COMPLIANT** |

### 5.3 Wave 2 resolution (verified R1)

- **ADR:** industry must not call `/registry/v1`, `ERA_DATA_HUB_*`, or Finance catalog handoffs for sync reads — use platform gateway.
- **Code (R1):** `packages/satellite-kit/src/integration/calendar.client.ts` delegates to `platform-catalog.client.ts`; industry apps use `@era/satellite-kit` handoffs.
- **Audit:** `npm run audit:integration:strict` — **0** DATA_HUB_* / FINANCE_CATALOG issues.

---

## 6. Domain D — Workforce identity / HR provision (v3 **COMPLIANT**)

| Source | Event | Consumers | Local person fields | Status |
|--------|-------|-----------|---------------------|--------|
| **era-orchestrator (CP)** | `SATELLITE_STAFF_PROVISIONED` v2 | era-fnb-pos, era-clinic, era-hotel-pms | `globalPersonId`, `cpEmploymentId` in payload | **COMPLIANT** (Plan C/E) |
| era-finance-core | `WORKFORCE_EMPLOYMENT_HIRED` / `WORKFORCE_ABSENCE_APPROVED` | payroll mirror only | slim Employee + MDM read-through | **COMPLIANT** (Plans A/D) |
| era-fnb-pos | `handleStaffProvisionEvent` | StaffRoster, User | no FIN/passport locally | **COMPLIANT** |
| era-clinic | `handleStaffProvisionEvent` | Practitioner + User | `globalPersonId` only; POST practitioners **403** | **COMPLIANT** (v3 cutover) |
| era-clinic | Admin UI hire | Policy `cp_workforce` → POST blocked; ops PATCH specialty/slots only | **COMPLIANT** (Plan E) |

**Finding (closed v3):** Clean cutover — no `finance_hr` / `local_master` dual path. Master ADR: [cp-core-workforce-hub.md](./adr/cp-core-workforce-hub.md).

---

## 7. Cross-cutting findings

| ID | Severity | Finding |
|----|----------|---------|
| **X-01** | High | ~~Plaintext FIN/passport on `era-clinic`~~ — **closed W1** |
| **X-02** | High | ~~Clinic Practitioner UI + enforcement gaps~~ — **closed W1** |
| **X-03** | Medium | ~~Hotel `Guest` plaintext FIN/passport~~ — **closed W4** ([hotel-guest-pii-ops-cache.md](./adr/hotel-guest-pii-ops-cache.md)) |
| **X-04** | Medium | ~~Pre-W2 calendar/hub drift~~ — **closed W2** (platform catalog gateway) |
| **X-05** | Low | ~~Extend CI with data-model audit~~ — **closed W5** (`run-integration-audits.mjs --strict` in CI) |
| **X-06** | Low | ~~MDM_IDENTITY practitioner row stale~~ — **closed R1** |

---

## 7.1 Findings register (R1 — 2026-06-16)

| ID | Severity | Domain | Layer | App | Status | Wave |
|----|----------|--------|-------|-----|--------|------|
| X-01 | High | A | L1 | era-clinic | **Closed** | W1 |
| X-02 | High | A | L4/L5 | era-clinic | **Closed** | W1/W3 |
| X-03 | Medium | A | L1 | era-hotel-pms | **Closed** | W4 |
| X-04 | Medium | C | L2 | industry ×7 | **Closed** | W2 |
| X-05 | Low | — | CI | all | **Closed** | W5 |
| X-06 | Low | A | L6 | docs | **Closed** | R1 |
| R1-N01 | Low | B | L4 | cross-sat | **Closed** | N01 kit BFF |
| R1-N02 | Info | A | — | orch MDM | **Closed** | P2 portal |
| R1-N03 | Info | — | L6 | era-hotel-pms | **Closed** | Hotel |
| R1-N04 | Info | — | L6 | era-bank-dbo | **Closed** | DBO DELIVERY |

**Next R1:** quarterly or post major delivery wave — see [audit-snapshots/README.md](./audit-snapshots/README.md).

---

## 8. Remediation waves (W1–W5 **SHIPPED** — see §7.1 register)

### Wave 1 — MDM PII contract (clinic + hotel identity models)

**Goal:** Align L1–L5 with ADR «`globalPersonId` only on satellites».

| Task | Apps | Layers |
|------|------|--------|
| W1-01 | era-clinic | Remove plaintext identifier columns from `PatientRef`, `Practitioner` (migration + backfill via MDM) |
| W1-02 | era-clinic | Practitioner UI: edit hydrate, list masked identifier source, strict create |
| W1-03 | era-clinic | Patient flows: stop persisting locals in `patient-identity.ts`; MDM lookup for display |
| W1-04 | era-hotel-pms | **Decision recorded** — [hotel-guest-pii-ops-cache.md](./adr/hotel-guest-pii-ops-cache.md) (single ADR lifecycle with W4-00); Guest schema slim-down deferred to Wave 4 |
| W1-05 | docs | Fix COVERAGE_MATRIX / MDM_IDENTITY_AUDIT / DELIVERY tags to match post-wave truth |

**Exit criteria:** No plaintext FIN/passport on clinic satellite DB; practitioner create requires `globalPersonId` (or POST forbidden when org `hireMode=finance_hr` per Wave 3); UAT-SMOKE UI paths green.

### Wave 2 — Reference data boundary (platform gateway — variant C)

| Task | Apps |
|------|------|
| W2-01 | ADR [orchestrator-platform-integration-gateway.md](./adr/orchestrator-platform-integration-gateway.md) + amend sibling ADRs (**accepted**); implement `CatalogGatewayModule` |
| W2-02 | satellite-kit `platform-catalog.client.ts`; calendar/FX/VÖEN delegates |
| W2-03 | Migrate 7 industry apps; update REFERENCE_DATA_CONSUMER_AUDIT + env docs |

### Wave 3 — Workforce single path (**SHIPPED** → superseded by v3 Plans A–E)

| Task | Apps |
|------|------|
| W3-01 | Legacy W3 policy (`finance_hr`/`local_master`) — **removed** Plan E |
| v3-A–D | CP absence, org, roles/Security Admin, PII tiers — [cp-core-workforce-hub.md](./adr/cp-core-workforce-hub.md) |
| v3-E | Clean cutover runbook, audit invert, Nafta §6 UAT | **COMPLIANT** |

### Wave 4 — Hotel guest PII (**SHIPPED**)

| Task | Apps |
|------|------|
| W4-00 | [hotel-guest-pii-ops-cache.md](./adr/hotel-guest-pii-ops-cache.md) verified vs implementation |
| W4-01 | MDM ops-profile + compliance resolve; DROP `nationalIdFin`, `passportNumber` on `Guest` |
| W4-02 | Import/backfill resolve-only; tourism/migration export resolve at submit |

**Exit criteria:** No plaintext FIN/passport on `Guest`; guest card masked MDM display; `audit-data-model-integration.mjs` — no `PII_DUPLICATE` for hotel.

### Wave 5 — CI + living audits (**SHIPPED**)

| Task | |
|------|---|
| W5-01 | `run-integration-audits.mjs` + baseline JSON + `--strict` CI gate |
| W5-02 | `refresh-integration-audit-docs.mjs` + [INTEGRATION_AUDIT_CI.md](./INTEGRATION_AUDIT_CI.md) |

**Exit criteria:** CI runs unified audit suite; baseline empty; strict mode green.

---

## 9. Automation

<!-- AUDIT:AUTO:issues-count -->
**Automated issues:** 0 (none)
<!-- /AUDIT:AUTO:issues-count -->

<!-- AUDIT:AUTO:automation-date -->
Last refresh: **2026-06-16** via `run-integration-audits.mjs --strict`
<!-- /AUDIT:AUTO:automation-date -->

```bash
# Unified suite (CI uses --strict)
npm run audit:integration:strict

# Individual audits
node scripts/audit-data-model-integration.mjs
node scripts/audit-mdm-identity.mjs
node scripts/audit-reference-data.mjs

# Living doc refresh
node scripts/refresh-integration-audit-docs.mjs --write
```

See [INTEGRATION_AUDIT_CI.md](./INTEGRATION_AUDIT_CI.md).

---

## 10. Changelog

| Date | Change |
|------|--------|
| 2026-06-16 | **R1 full re-audit** — 0 automated issues; domains A–E COMPLIANT; delta [r1-delta-2026-06-16.md](./audit-snapshots/r1-delta-2026-06-16.md) |
| 2026-06-16 | W5 automation refresh — 0 issue(s) |
| 2026-06-16 | Initial layer audit; clinic PII duplication flagged as drift; practitioner DOC_DRIFT; calendar known drift pre-W2 |
| 2026-06-16 | Doc alignment pass: gateway ADR + hotel ops-cache ADR accepted; §2/§8 updated; X-03/X-04 reframed as policy locked / pre-W2 drift |
| 2026-06-16 | W2 implemented: orchestrator catalog gateway; industry via platform-catalog client; X-04 closed |
