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
| H-P0-1 | Wire `SATELLITE_HOTEL_INVOICE_ISSUED` in Finance dispatch | Draft sales invoice from folio issue |
| H-P0-2 | City ledger snapshot event → Finance reconciliation | Complement agency CL deep link |
| H-P0-3 | On-site UAT checklist 13 with Nafta | Gate sign-off |
| H-P0-4 | Hospitality launcher tile group (orchestrator) | hotel + fb + finance shortcuts |

## P1 — Deferred MVP items (DELIVERY unchecked)

| ID | Task | DELIVERY ref |
|----|------|--------------|
| H-P1-1 | PMS-04 Room plan drag-resize | Stage 16+ |
| H-P1-2 | HK mobile PWA `/hk/mobile` | Stage 16+ |
| H-P1-3 | B2C booking engine | Deferred post-MVP |
| H-P1-4 | Door locks integration | Stage 16+ |
| H-P1-5 | Auto email reports (WA0345+) | Stage 16+ |
| H-P1-6 | Real NBC/Cybernet KKM | Stage 13 deferred |
| H-P1-7 | Full PO / fixed assets / DMENU | Stage 15 — **Finance owns PO** |

## P2 — Elektraweb parity (Wave 6+)

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
