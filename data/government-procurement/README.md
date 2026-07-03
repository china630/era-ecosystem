# Government procurement (etender.gov.az)

## Suppliers (contracts)

Unique **suppliers** from signed contracts, deduplicated by **VOEN** (Vergi Ödəyicisinin Eyniləşdirmə Nömrəsi — tax ID, not “military”).

| File | Description |
|------|-------------|
| `azerbaijan-etender-suppliers.csv` | Deduped suppliers with contract stats |
| `azerbaijan-etender-contracts-sample.json` | First contracts API page (debug) |

Source: `GET https://etender.gov.az/api/contracts`

```bash
npm run scrape:etender-suppliers
ETENDER_MAX_PAGES=5 npm run scrape:etender-suppliers   # smoke
```

## Buyers (competitions)

Unique **government buyers** from [competitions](https://etender.gov.az/main/competitions), deduplicated by **VOEN**.

List API: `GET /api/events?EventType=2&EventStatus=…` (name only).  
Detail: `GET /api/events/{eventId}` → `organizationVoen`, `organizationName`, `address`.

| File | Description |
|------|-------------|
| `azerbaijan-etender-buyers.csv` | Deduped buyers (VOEN + name + address) |
| `.etender-buyers-checkpoint.json` | Resume state (auto-deleted on success) |

```bash
# Full crawl (~45k competitions → far fewer unique VOENs; resumes from checkpoint)
npm run scrape:etender-buyers

# Smoke (first 3 list pages total)
ETENDER_BUYER_MAX_PAGES=3 npm run scrape:etender-buyers
```

## Merge into legal entities

```bash
npm run merge:voen-donors
```
