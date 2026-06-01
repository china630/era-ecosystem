# Hotel PMS — production backlog

Source: [DELIVERY.md](./DELIVERY.md), [clone-spec/14-phase2-roadmap.md](./clone-spec/14-phase2-roadmap.md), Nafta manifest.  
Finance boundary: [../../docs/HOSPITALITY_FINANCE_BOUNDARY.md](../../docs/HOSPITALITY_FINANCE_BOUNDARY.md)

## Done (Nafta Waves 1–5)

- PMS core, folio, night audit, RBAC, HK, channel, medical, room plan
- ERP bridge, fiscal docs, agency ledger **operational**, invoice center **operational**
- GL revenue mapping → Finance NAS journal
- Contract pricing, banquets, transfers, sanatorium packages, procedures
- POS bridge for fb-pos, stock MVP (local)
- Finance deep links on invoices / agency CL / stock (when `NEXT_PUBLIC_FINANCE_WEB_URL` set)

## P0 — Nafta demo polish

| ID | Task | Notes |
|----|------|-------|
| H-P0-1 | Wire `SATELLITE_HOTEL_INVOICE_ISSUED` in Finance dispatch | Draft sales invoice from folio issue — **done** |
| H-P0-2 | City ledger snapshot event → Finance reconciliation | Complement agency CL deep link — **done** (dispatch meta) |
| H-P0-3 | On-site UAT checklist 13 with Nafta | Gate sign-off |
| H-P0-4 | Hospitality launcher tile group (orchestrator) | hotel + fb + finance shortcuts — **done** |

## P1 — Shipped in v1.1 / v2.0 (local MVP)

| ID | Task | Status |
|----|------|--------|
| H-P1-1 | PMS-04 Room plan drag-resize | **done** (v1.1) |
| H-P1-2 | HK mobile PWA `/hk/mobile` | **done** (v1.1) |
| H-P1-3 | B2C booking engine | **done** (v2.0 MVP — `/b2c`, public rates API) |
| H-P1-4 | Door locks integration | **done** (v2.0 — adapter + check-in unlock) |
| H-P1-5 | Auto email reports (WA0345+) | **done** (v1.1 cron) |
| H-P1-6 | NBC/Cybernet KKM adapter | **done** (v2.0 stub; prod certs below) |
| H-P1-7 | Full PO / fixed assets / DMENU | **out of scope** — Finance |

### NBC / fiscal production (pre-GA)

| Env | Purpose |
|-----|---------|
| `ERA_FISCAL_PROVIDER` | `mock` (default local) · `nbc` · `cybernet` |
| `ERA_NBC_KKM_CERT_PATH` | Production PKCS#12 path (backlog until cert issued) |
| `ERA_NBC_KKM_ENDPOINT` | Vendor API base URL |

Local UAT uses **mock**. Production cutover requires certified adapter (not blocking GA).

### OTA (pre-GA stub)

| Env | Purpose |
|-----|---------|
| `ERA_OTA_MODE` | `stub` (default) |
| `ERA_OTA_WEBHOOK_SECRET` | Optional HMAC header `x-era-ota-secret` |
| `POST /api/integrations/ota/:channel` | Webhook ingest MVP |

## P2 — Elektraweb parity

### Shipped Wave B (2026-06-01)

- Reservation Card pricing/charge-all, FO reports, HK/distribution/SPA MVP screens
- See [ELEKTRAWEB-PARITY.md](./ELEKTRAWEB-PARITY.md)

### Remaining (Wave C+)

- OTA live connectors (Booking.com, etc.)
- e-qaimə production adapter
- ~1243 screen manifest — optional merge from NotebookLM
- OpenAPI ERP hardening (already stubbed — mark DELIVERY stale `[ ]` as done)

## Finance boundary (do not duplicate in hotel)

| Domain | Action |
|--------|--------|
| Sales invoices | Keep operational list; accounting in Finance |
| Agency GL / aging | Keep city ledger snapshot; reconciliation in Finance |
| Purchases | Remove from hotel scope; link only |
| Warehouse | Local consumption MVP only; master stock in Finance |

## Doc hygiene

- [ ] Mark DELIVERY «OpenAPI ERP» and «Phase 2 modules» checkboxes — review vs current state
- [x] Wave 5 stages 22–24 documented in DELIVERY
