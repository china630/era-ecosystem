# Nafta stack — Doc / API / UI gap audit

Living matrix for **Nafta sanatorium pilot** satellites: find features documented as shipped but missing API or UI, and APIs without operator screens.

**Method:** for each capability, classify three layers:

| Layer | Source of truth |
|-------|-----------------|
| **Doc** | `DELIVERY*.md`, `BACKLOG-PRODUCTION.md`, `UAT-SMOKE.md`, ADR, `nafta/*`, PRD/TZ |
| **API** | Route handlers (`app/api/*`, Nest controllers) |
| **UI** | Pages (`app/**/page.tsx`), modals linked from nav, admin screens |

**Gap types:**

| Tag | Meaning |
|-----|---------|
| **OK** | Doc ≈ API ≈ UI (or API-only by design, documented) |
| **API-only** | Backend exists; FO/ops cannot act without curl/Postman |
| **UI-only** | Screen exists; thin or undocumented |
| **Doc-only** | Documented / planned; no implementation |
| **Doc drift** | Doc says Done; code differs |
| **Partial** | Two of three layers OK; third incomplete |
| **Orphan UI** | Page exists but not in app shell nav |

**Nafta stack scope** ([NAFTA_SANATORIUM_UAT.md](./NAFTA_SANATORIUM_UAT.md)):

| Satellite | Port | Role |
|-----------|------|------|
| era-orchestrator | 3000 / 4000 | Launcher, MDM, billing, events gateway |
| era-finance-core | 3100 / 4100 | GL, AR, invoices, HR (parent org) |
| era-hotel-pms | 3201 | FO, folio, medical ops, distribution |
| era-fnb-pos | 3202 | Restaurant POS, room charge, banquet extras |
| era-clinic | 3203 | Sanatorium clinical, lab, queue |
| era-retail-pos | 3204 | Pharmacy retail (optional department) |

**Last audit:** 2026-06-14 (post code-closure waves A–F)

---

## Executive summary

| Satellite | Doc coverage | API | UI | Top gap pattern |
|-----------|--------------|-----|-----|-----------------|
| **hotel-pms** | ~96% | ~96% | ~94% | bar-rates Excel import; vendor STUB |
| **era-clinic** | ~92% | ~93% | ~90% | HL7 LIS (deferred) |
| **era-fnb-pos** | ~94% | ~94% | ~92% | Real KKM (external) |
| **era-finance-core** | ~88% | ~88% | ~82% | Event monitor (headless by design) |
| **era-orchestrator** | ~94% | ~96% | ~90% | Vendor notify STUB |

**P0 / P1 / P2 closure:** all `N-DUI-*` and `N-DOC-*` **closed**. **Waves A–F code closure** closed fnb pay/shift, channel mappings, reservation page, sanatorium chart, R7 filters, MDM admin write, BAR bootstrap.

---

## Post-run remainder (external / by-design only)

| ID | Area | Status | Notes |
|----|------|--------|-------|
| P3 | Staff provision webhook | By design | orchestrator → satellite |
| P3 | OTA webhook ingest (prod creds) | External | adapter stub OK; live creds needed |
| P3 | Minibar IoT / door lock | External | webhook + HK fallback |
| — | hotel bar-rates adapter | Blocked on Excel | [IMPORT-PRICING-MAP](../era-hotel-pms/doc/nafta/IMPORT-PRICING-MAP.md) needs Nafta export |
| — | hotel H-BL-06 Twilio/SendGrid | Partial (STUB) | platform notify OK |
| — | hotel/clinic e-qaimé / HL7 | External | prod cert / LIS vendor |
| — | fnb real KKM NBC | External | stub fiscal at POS |
| — | finance E8 consumption event | Integration | Finance worker |
| — | 1C / opening balances | Phase 2 Nafta | external ERP |

---

## Closed — waves A–F (2026-06-14)

| Wave | Resolution |
|------|------------|
| A | fnb CARD pay + shift UI + meal entitlements badge |
| B | hotel channel mappings UI + `/reservations/[id]` page |
| C | clinic sanatorium treatment chart + schedule API |
| D | hotel R7 OOO/INSPECTED filters; contract-pricing API 410 |
| E | orchestrator MDM admin write (`/super-admin/mdm/persons`); Finance holding UI verified |
| F | hotel `bar-bootstrap` fileless import adapter |

---

## Closed — P0 (was UAT demo blockers)

| ID | Resolution |
|----|------------|
| N-DUI-01 | fnb `/orders` in-house guest search + link |
| N-DUI-02 | clinic `/visits/[id]` Complete visit button |
| N-DUI-03 | clinic nav → `/reception/queue` |
| N-DUI-04 | hotel `/migration` prefill + submit actions |
| N-DUI-05 | orch `/super-admin/orgs/[orgId]` hub + workspace departments card |

---

## Closed — P1 (was Done in BACKLOG, missing ops UI)

| ID | Resolution |
|----|------------|
| N-DUI-10–22 | Reservation card panels, channel/yield/audit, fnb floor/daily menu, clinic LIS/queue, finance HR provisioning |

---

## Closed — P2 (was doc ↔ code)

| ID | Resolution |
|----|------------|
| N-DOC-01–05 | City ledger snapshot, label alignment, inpatient UI, boundary doc |

---

## era-hotel-pms (updated highlights)

| Feature | Doc | API | UI | Gap |
|---------|-----|-----|-----|-----|
| Channel mappings | H-BL-25 | yes | `/channel` | **OK** |
| Reservation deep link | FO | yes | `/reservations/[id]` | **OK** |
| BAR bootstrap | IMPORT-PRICING-MAP | yes | import wizard step 21a | **OK** |
| R7 rack filters | FO spec | yes | `/` aside | **OK** |
| Import bar-rates | IMPORT-PRICING-MAP | partial | wizard | **Blocked (Excel)** |
| Omnichannel | H-BL-06 | STUB vendor | send pages | **Partial (STUB)** |
| e-qaimé | H-BL-24 | stub | folio read-only | **Stub** |

---

## era-clinic (updated highlights)

| Feature | Doc | API | UI | Gap |
|---------|-----|-----|-----|-----|
| Sanatorium chart | K5 | yes | `/sanatorium` treatment chart | **OK** |
| Reception queue / LIS / inpatient | W3/M11/M13 | yes | nav + pages | **OK** |

---

## era-fnb-pos (updated highlights)

| Feature | Doc | API | UI | Gap |
|---------|-----|-----|-----|-----|
| CARD pay | F-P1-3 | yes | `/orders` | **OK** |
| Shift UI | FB-06 | yes | `/orders` PosShiftPanel | **OK** |
| Meal entitlements hint | H-BL-04 | yes | `/orders` badge | **OK** |
| In-house guest link | FB-04 | yes | `/orders` | **OK** |

---

## era-finance-core (updated highlights)

| Feature | Doc | API | UI | Gap |
|---------|-----|-----|-----|-----|
| Holding UI | LOCAL_UAT | yes | `/companies`, `/holding` | **OK** |
| City ledger snapshot | Boundary | event + DB | counterparty modal | **OK** |
| e-qaimé | ADR stub | stub | invoice modal | **Stub** |

---

## era-orchestrator (updated highlights)

| Feature | Doc | API | UI | Gap |
|---------|-----|-----|-----|-----|
| MDM admin write | DELIVERY | `v1/admin/mdm/persons/*` | `/super-admin/mdm/persons` | **OK** |
| Department orgs | NAFTA §3 | yes | super-admin org hub | **OK** |

---

## Module maps

| Satellite | Map |
|-----------|-----|
| hotel-pms | `era-hotel-pms/.cursor/rules/era-hotel-pms-module-map.mdc` |
| fnb-pos | `era-fnb-pos/.cursor/rules/era-fnb-pos-module-map.mdc` |
| clinic | `era-clinic/.cursor/rules/era-clinic-module-map.mdc` |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-14 | Initial Nafta stack audit |
| 2026-06-14 | Post P0+P1+P2 closure |
| 2026-06-14 | Post waves A–F code closure |
