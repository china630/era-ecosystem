# ADR: CRM lead party model, Finance convert handoff, and prospect import

**Status:** Accepted — **SHIPPED v3.0** (2026-07-02)  
**Date:** 2026-07-02  
**Owners:** era-crm · era-finance-core · `@era/contracts`

## Context

ERA CRM Field (v1.0–v2.0) ships a **flat** `Lead` (`title`, `contactRef`, `channel`) with a VÖEN lookup widget that is **not persisted**. Convert dispatches `SATELLITE_CRM_LEAD_CONVERTED` without party identifiers; Finance `handleCrmLead` only creates a draft invoice when `counterpartyId` is already known.

Product need (dogfood + SMB AZ):

- Track **individuals and legal entities** in one pipeline (partners, customers, integrators).
- Persist **VÖEN / company name** on the lead; enforce VÖEN from **QUALIFIED** onward for `LEGAL_ENTITY`.
- Optional **FIN** for individuals via MDM lookup (same pattern as clinic/hotel).
- **Auto-create Finance counterparty** on convert when `counterpartyId` is absent.
- **Bulk import** from enriched e-taxes / donor CSVs (`data/legal-entities/`) including **activity sector**.
- Minimal UI: **create-lead form** on `/leads` (currently missing).

Boundaries already accepted:

- [mdm-legal-entity-vs-finance-counterparty-registry.md](./mdm-legal-entity-vs-finance-counterparty-registry.md) — VÖEN legal truth in MDM/Finance, not duplicated PII in satellites.
- [satellite-finance-bridge-pattern.md](./satellite-finance-bridge-pattern.md) — CRM convert is **event-only** handoff (not a GL bridge).
- [era-mdm-natural-person-identity.md](./era-mdm-natural-person-identity.md) — FIN links to `globalPersonId`; satellite stores ref only.

## Decision

### 1. Party model on `Lead` (era-crm DB)

Add operational fields on `Lead` (not a second counterparty MDM):

| Field | Type | Rules |
|-------|------|--------|
| `partyKind` | `INDIVIDUAL` \| `LEGAL_ENTITY` | Required on create (default `LEGAL_ENTITY` when VÖEN present in import/UI). |
| `taxId` | string (10 digits) | Required when `partyKind=LEGAL_ENTITY` and `stage ∈ {QUALIFIED, PROPOSAL, WON}`. Validated AZ VÖEN. |
| `companyName` | string? | Required when `partyKind=LEGAL_ENTITY` and stage ≥ QUALIFIED (from user or e-taxes `tax_name`). |
| `contactPhone` | string? | Required when `partyKind=INDIVIDUAL` (E.164 `+994…`). Maps to `contactRef` if channel is phone/WA. |
| `contactEmail` | string? | Optional. |
| `globalPersonId` | string? | Set after MDM `linkPersonIdentity` when FIN provided (individuals). **No plaintext FIN** on `Lead`. |
| `activitySector` | string? | Free text or normalized code from import (`donor_sectors` pipe-list → primary sector). |
| `prospectType` | `CUSTOMER` \| `PARTNER` \| `OTHER` | Default `CUSTOMER`; founder/partner dogfood uses `PARTNER`. |
| `importBatchId` | string? | Audit for bulk import job. |
| `sourceRef` | string? | External key (e.g. `voen:1234567890`, `donor:hotel-42`). |

Keep `contactRef` for channel address (WA number, IG handle). On create, sync `contactRef` from `contactPhone` when channel is `whatsapp` \| `phone`.

**Stage gate (API validation):**

- `NEW` / `CONTACTED`: `partyKind` required; VÖEN optional.
- `QUALIFIED+` + `LEGAL_ENTITY`: `taxId` + `companyName` required.
- `QUALIFIED+` + `INDIVIDUAL`: `contactPhone` required; FIN optional until WON if no invoice amount.

### 2. Event contract extension (`@era/contracts`)

Extend `SATELLITE_CRM_LEAD_CONVERTED` payload (backward compatible — new fields optional):

```ts
payload: {
  leadId: string;
  counterpartyId?: string;
  partyKind: "INDIVIDUAL" | "LEGAL_ENTITY";
  taxId?: string;           // LEGAL_ENTITY
  companyName?: string;
  contactPhone?: string;
  contactEmail?: string;
  globalPersonId?: string;
  activitySector?: string;
  prospectType?: "CUSTOMER" | "PARTNER" | "OTHER";
  channel: ...;
  estimatedAmount?: number;
  currency?: "AZN";
}
```

Versioning: consumers use Zod `.passthrough()` / optional fields; old events without `partyKind` treated as `LEGAL_ENTITY` if `taxId` present, else `INDIVIDUAL`.

### 3. Finance auto-create on convert

In `handleCrmLead` (era-finance-core):

1. If `counterpartyId` provided → use existing `resolveCounterpartyId`.
2. Else if `partyKind=LEGAL_ENTITY` and `taxId` → **find-or-create** org-scoped `Counterparty` (`kind=LEGAL_ENTITY`, `taxId`, `name=companyName`), idempotent by `taxId` blind index per org.
3. Else if `partyKind=INDIVIDUAL` → find-or-create by `contactPhone` / `globalPersonId` (`kind=INDIVIDUAL`).
4. Then existing draft invoice path when `estimatedAmount > 0`.

CRM satellite **does not** write Finance DB directly.

**Orchestrator `Partner` record** (referral QR, commissions) remains **out of scope** for v3.0 convert — optional v3.1 hook: when `prospectType=PARTNER` and feature flag, dispatch secondary internal job or document manual super-admin step.

### 4. MDM usage

| Action | API | Storage on Lead |
|--------|-----|-----------------|
| VÖEN verify / name resolve | existing `lookupLegalEntityByVoen` / voen-preview | `taxId`, `companyName` |
| FIN verify (individual) | `internal/v1/mdm/person-lookup` (satellite-kit) | `globalPersonId` only |

Do not store FIN/passport plaintext on `Lead` per [era-common-laws](../../.cursor/rules/era-common-laws.mdc).

### 5. Prospect import (CSV / Excel)

**Scope v3.0:** admin/ops import on satellite — `POST /api/leads/import` (multipart CSV/XLSX).

**Canonical column mapping** (from `data/legal-entities/azerbaijan-legal-entities.csv` and siblings):

| Source column | Lead field | Notes |
|---------------|------------|-------|
| `voen` | `taxId` | Skip row if invalid; forces `partyKind=LEGAL_ENTITY`. |
| `tax_name` (fallback `donor_names` first segment) | `companyName`, `title` | |
| `donor_phones` (first `|`) | `contactPhone`, `contactRef` | |
| `donor_emails` (first) | `contactEmail` | |
| `donor_sectors` (first segment) | `activitySector` | hotels, construction-companies, legal, … |
| `tax_legal_address` | new `addressLabel` on Lead (optional) | |
| `match_status` | import report only | `no_tax_match` → allow import as LEGAL_ENTITY if `donor_voens` / manual VÖEN; flag `needsVoenReview`. |
| `donor_ids` | `sourceRef` | |

**Dedup on import:** same `taxId` OR same normalized `contactPhone` within tenant → update existing lead (stage unchanged) unless `importMode=create-only`. Report: created / updated / skipped / errors.

**Not in v3.0:** scheduled sync from `data/` folder; import is **upload** only. Reference dataset path documented in [data/legal-entities/README.md](../../data/legal-entities/README.md).

### 6. UI minimum (v3.0)

- `/leads`: **Create lead** modal — `partyKind`, phones, VÖEN field (reuse `VoenLookupField`), `prospectType`, `activitySector`, estimated amount.
- `/leads/[id]` (new): read-only **lead card** with party block + stage actions (M12 — see PRD §9).
- `/admin/import` or SatAdmin section: upload CSV/XLSX, preview 20 rows, confirm.

### 7. Explicit non-goals (v3.0)

- Full Bitrix Open Channels (2-way inbox) → see **§8 Bitrix backlog** (v3.1+).
- Duplicate merge UI across leads → **§8** (v3.1; import dedup only in v3.0).
- Marketing WA broadcasts → **§8 Never** (compliance).
- Finance `/crm/counterparties` screen parity in satellite → boundary unchanged.

---

## §8. Bitrix24 benchmark backlog (deferred)

**Reference:** [era-crm PRD §2](../../era-crm/PRD.md) — Bitrix24 (leads + Open Channels), Kommo, Respond.io, HubSpot lite.

ERA CRM Field is **not** a Bitrix clone. v3.0 closes AZ party model + import + Finance handoff. Items below are **documented for later waves** so comparison notes are not lost in chat.

### 8.1. Positioning vs Bitrix24

| Layer | Bitrix24 | ERA CRM Field (target) |
|-------|----------|------------------------|
| Pre-sale funnel | Leads + deals pipelines | **Leads** → convert (v3.0 party model) |
| Legal / tax master | CRM company card (duplicate risk) | **Finance** counterparty + MDM VÖEN |
| Invoicing / GL | CRM quotes (lite) or ERP plugin | **Finance** only after convert |
| Open Channels | Native 2-way WA/TG/IG/email | Orch WABA hooks (v2.0) + inbox **stub**; full inbox later |
| Automation | Visual robot designer | Simple `PipelineRule` (v1.1); designer **never** in scope |
| Marketing | Segments, mass WA/email | **Out of scope** (AZ compliance) |

### 8.2. Already at Bitrix-lite level (v1.0–v2.0, no further ADR)

| Bitrix capability | ERA module | Status |
|-------------------|------------|--------|
| Pipeline stages | M1 | DONE |
| Manager assignment | C2 assign | DONE |
| Field visits | M4 | DONE |
| Follow-up / tasks lite | M8 | DONE |
| Stage automation (simple) | M10 | DONE |
| WA on stage change | M7 | DONE (v2.0) |
| Lead scoring stub | M9 | MVP |

### 8.3. Deferred product backlog (by wave)

| ID | Bitrix analogue | Capability | Target | Owner | Notes |
|----|-----------------|------------|--------|-------|-------|
| **M17** | Open Channels | **Unified inbox 2-way** — WA/TG/IG thread in CRM UI, message history, templates | **v3.1** | SATELLITE + Orch WABA | Extends M3 stub; Respond.io pattern |
| **M18** | Timeline | **Rich activity feed** — notes, attachments, calls logged, emails meta, meetings | **v3.1** | SATELLITE | Extends M2; visits + `LeadStageHistory` remain |
| **M19** | Duplicate control | **Lead merge UI** — manual merge two leads, re-link visits/inbox | **v3.1** | SATELLITE | Import dedup (v3.0) is automatic only |
| **M20** | Partner portal hook | **Orchestrator `Partner`** auto-create when `prospectType=PARTNER` + WON | **v3.1** | orchestrator + crm event | Referral QR still Orch super-admin |
| **M21** | Import wizard | **Custom column mapper** for CSV/XLSX (not fixed e-taxes template) | **v3.1** | SATELLITE | After M14 fixed template ships |
| **M22** | CRM analytics | **Funnel KPI dashboard** — conversion by stage, owner, sector, partner vs customer | **v4.0** | SATELLITE | OpsUI + SatAdmin |
| **M23** | Contact / Company / Deal | **Split entity model** — `Contact` + `Company` linked to `Lead`/`Deal`; optional second pipeline for deals | **v4.0** | SATELLITE | Major schema; avoid before v3.0 dogfood stable |
| **M24** | User fields | **Custom fields** on lead (JSON schema per tenant, SatAdmin config) | **v4.0** | SATELLITE | Bitrix UF_* lite |
| **M25** | Commercial proposal | **Quote / line items** on lead — SKU qty, discount; convert → Finance draft invoice lines | **v4.0** | SATELLITE + FINANCE | Not full CPQ |
| **M26** | Calendar | **Meeting scheduler** — sync with platform booking; activity on timeline | **v4.0** | SATELLITE + CP-B3 | Reuse `createBookingAppointment` |
| **M27** | Telephony | **Click-to-call** + call log on timeline | **v4.0+** | SATELLITE + vendor | Provider TBD (AZ carriers) |
| **M28** | Email | **Email channel** in inbox + outbound from lead card | **v4.0+** | SATELLITE + Orch notify | Transactional first |
| **M29** | Mobile | **Field sales PWA / native** — offline visit check-in, quick lead create | **v5.0+** | SATELLITE | Bitrix mobile parity not goal |
| **M30** | Access | **Field-level permissions** on lead attributes | **v5.0+** | SATELLITE | Role-based sufficient until then |

### 8.4. Explicit never-copy (permanent out of scope)

Documented in PRD §1.4; repeated here so ADR is self-contained:

| Bitrix feature | ERA decision | Reason |
|----------------|--------------|--------|
| Automation **constructor** (robots, BP designer) | **Never** | Complexity; M10 rules enough for SMB |
| **Mass marketing** WA / email campaigns | **Never** | Compliance + separate product risk |
| Full **helpdesk / tickets** | **Never** | Different product |
| **Integrations marketplace** (1000 apps) | **Never** in satellite | Orchestrator events + Finance APIs |
| Duplicate **Finance counterparty** screens in CRM | **Never** | [01-finance-boundary](../../era-crm/doc/clone-spec/01-finance-boundary.md) |
| Bitrix **billing / portal** for CRM seats | **Never** | Orchestrator entitlements |

### 8.5. COVERAGE_MATRIX placeholders (create on ship per wave)

| ID | Capability | Target wave |
|----|------------|-------------|
| CRM-INBOX-02 | Inbox 2-way Open Channels | v3.1 (M17) |
| CRM-TIME-01 | Rich activity timeline | v3.1 (M18) |
| CRM-DEDUP-01 | Lead merge UI | v3.1 (M19) |
| CRM-KPI-01 | Funnel analytics dashboard | v4.0 (M22) |
| CRM-ENTITY-01 | Contact + Company split | v4.0 (M23) |
| CRM-QUOTE-01 | Quote line items → Finance | v4.0 (M25) |

Rows stay **unlisted** in `COVERAGE_MATRIX.md` until implementation starts — track here only.

### 8.6. Dependency order (after v3.0 ships)

```text
v3.0  M11–M16  party + import + Finance CP
  └─► v3.1  M17–M21  inbox, timeline, merge, Partner hook, import mapper
        └─► v4.0  M22–M28  analytics, entity split, custom fields, quotes, calendar, comms
              └─► v5.0+  M29–M30  mobile, field ACL
```

**Do not** start M23 (entity split) before v3.0 partner dogfood validates flat `Lead` + `prospectType`.

---

## Consequences

| Positive | Negative / mitigation |
|----------|------------------------|
| Convert E2E without manual Finance CP create | Event schema change — coordinate Finance + contracts deploy |
| Partner/customer dogfood in one app | More validation on stage transitions |
| Reuse e-taxes enrichment investment | Import quality depends on `match_status`; UI must surface review queue |
| Honest COVERAGE_MATRIX rows post-ship | v3.0 not SHIPPED until UI import + create form + UAT |

## Implementation order

1. Prisma migration + `POST/PATCH /api/leads` validation gates.
2. `@era/contracts` payload + Finance `handleCrmLead` find-or-create.
3. Create-lead UI + lead detail page.
4. Import API + admin UI.
5. DELIVERY `[ ]` → `[x]`, COVERAGE_MATRIX rows, UAT-SMOKE UI paths.

## Related

- [era-crm PRD §9](../../era-crm/PRD.md) — product modules M11–M16 (v3.0); §9.8 Bitrix backlog (M17+)
- [era-crm TZ § Planned v3.0](../../era-crm/TZ.md)
- [INTEGRATION_SSO_EVENTS.md](../INTEGRATION_SSO_EVENTS.md) — event table (amend on ship)
- [DATA_MODEL_INTEGRATION_AUDIT.md](../DATA_MODEL_INTEGRATION_AUDIT.md) § era-crm row (amend on ship)
