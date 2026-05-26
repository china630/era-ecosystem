# ERA CRM Field — Technical specification (TZ)

Product requirements: [PRD.md](./PRD.md). Delivery tracker: [doc/DELIVERY-CRM.md](./doc/DELIVERY-CRM.md).

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Next.js 15, Prisma 6, PostgreSQL `era_crm_field` |
| Port | 3303 · Host `crm.era.az` |
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

## W1-E — Enrichment

| Method | Path | Model |
|--------|------|-------|
| GET/POST | `/api/visits` | `Visit.latitude`, `Visit.longitude`, `addressLabel` |
| PATCH | `/api/leads/:id/follow-up` | `Lead.nextContactAt` → `trySendPlatformNotification` (M8) |

## Environment

Same satellite env block as other industry apps — [.env.example](./.env.example).
