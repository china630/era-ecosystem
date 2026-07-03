# ERA CRM Field — Technical specification (TZ)

Product requirements: [PRD.md](./PRD.md). Delivery tracker: [doc/DELIVERY-CRM.md](./doc/DELIVERY-CRM.md).

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Next.js 15, Prisma 6, PostgreSQL `era_crm` |
| Port | 3303 · Host `crm.era-365.online` |
| Entitlement | `industry_crm_field` (or early-access module key) |
| Packages | `@era/contracts`, `@era/satellite-kit` |

## Data model (CRM-1 target)

```text
Tenant → Lead → Visit → LeadStageHistory
ChannelThread (stub, Phase 2)
```

## API surface (planned)

| Method | Path | PRD |
|--------|------|-----|
| GET/POST | `/api/leads` | CRM-01 |
| POST | `/api/leads/:id/visits` | CRM-02 |
| POST | `/api/leads/:id/convert` | CRM-03 → `SATELLITE_CRM_LEAD_CONVERTED` |
| POST | `/api/events/dispatch` | platform |

## Finance boundary

**No GL in CRM.** Conversion creates counterparty opportunity handoff in Finance via event only — see [doc/clone-spec/01-finance-boundary.md](./doc/clone-spec/01-finance-boundary.md).

## Product APIs (v1.0)

| Method | Path | Model |
|--------|------|-------|
| GET/POST | `/api/visits` | `Visit.latitude`, `Visit.longitude`, `addressLabel` |
| PATCH | `/api/leads/:id/follow-up` | `Lead.nextContactAt` → `trySendPlatformNotification` (M8) |

## Environment

Same satellite env block as other industry apps — [.env.example](./.env.example).

---

## Planned — v3.0 (party model + import)

ADR: [docs/adr/crm-lead-party-model-and-prospect-import.md](../docs/adr/crm-lead-party-model-and-prospect-import.md) · PRD: [PRD.md §9](./PRD.md#9-roadmap--v30-party-model-partners-import)

### Data model (target)

```text
Lead
  partyKind: INDIVIDUAL | LEGAL_ENTITY
  taxId?, companyName?, contactPhone?, contactEmail?
  globalPersonId?          # MDM ref only — no FIN plaintext
  activitySector?, prospectType: CUSTOMER | PARTNER | OTHER
  addressLabel?, sourceRef?, importBatchId?
  … existing stage, channel, owner, score, nextContactAt
```

### API surface (planned)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/leads` | Extended body; stage gates on PATCH stage |
| PATCH | `/api/leads/:id` | Update party fields |
| GET | `/api/leads/:id` | Lead card |
| POST | `/api/leads/import` | multipart CSV/XLSX; `?mode=upsert\|create-only` |
| GET | `/api/leads/import/:batchId` | Import job result |
| POST | `/api/leads/:id/convert` | Dispatches extended `SATELLITE_CRM_LEAD_CONVERTED` |
| POST | `/api/mdm/person-lookup` | FIN → `globalPersonId` (individuals) |

### Validation rules

| Stage | LEGAL_ENTITY | INDIVIDUAL |
|-------|--------------|------------|
| NEW / CONTACTED | `partyKind` required | `partyKind` required |
| QUALIFIED+ | `taxId` + `companyName` required | `contactPhone` required |

### Event payload (contracts)

Extend `satelliteCrmLeadConvertedSchema` in `@era/contracts` with `partyKind`, `taxId`, `companyName`, `contactPhone`, `contactEmail`, `globalPersonId`, `activitySector`, `prospectType` (all optional in schema for backward compat; required at CRM dispatch when party block complete).

### Finance consumer

`handleCrmLead` → find-or-create `Counterparty` by `taxId` or phone/`globalPersonId` when `counterpartyId` absent.
