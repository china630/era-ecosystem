# Front Office — traceability (ElectraWeb FO spec)

> **Source spec:** absorbed from legacy `Electraweb/front office.md` (2026-06-04) — see [reference/ELECTRAWEB-SOURCE-INDEX.md](reference/ELECTRAWEB-SOURCE-INDEX.md)  
> **Last reviewed:** 2026-06-04 (Guest CRM)  
> **Legend:** **Done** = demo-ready per spec intent · **Partial** = UI/API exists, CSV/screens not fully matched · **Planned** = backlog

**Related:** [FRONT-OFFICE-ELECTRAWEB.md](./FRONT-OFFICE-ELECTRAWEB.md) · [GUEST-CRM-ELECTRAWEB.md](./GUEST-CRM-ELECTRAWEB.md) · [ELEKTRAWEB-PARITY.md](./ELEKTRAWEB-PARITY.md) · [UAT-SMOKE.md](./UAT-SMOKE.md) §14–16

---

## Summary

| Area | Done | Partial | Planned |
|------|------|---------|---------|
| Global header (satellites) | 1 | 0 | 0 |
| Left FO menu | 8 | 0 | 0 |
| Chessboard `/` | 9 | 0 | 0 |
| Reservation card | 10 | 0 | 0 |
| Room plan | 6 | 0 | 0 |
| In-house + guest card | 11 | 1 | 0 |
| **Total line items** | **45** | **1** | **0** |

**Product verdict:** FO **CSV parity** including Guest CRM P0+P1 and Reservation Details. **G6/G7 Done**; omnichannel STUB Partial. **R7 Done** (Wave D). Medical/finance via satellite deep links only.

---

## 1. Global header (all industry satellites)

| # | Spec (`front office.md` L121–127) | Status | Implementation |
|---|-----------------------------------|--------|----------------|
| H1 | Right→left: Profile → Company → Bell → Locale | **Done** | `EraAppHeader` (D1) |
| H2 | Same on all satellites | **Done** | Wave A/B + D1 |

---

## 2. Left menu

| # | Spec item | Status | Route / notes |
|---|-----------|--------|---------------|
| M1–M9 | FO menu items | **Done** | See D1–D3 |

---

## 3. Chessboard `/` (L12–25)

| # | Spec item | Status | Notes |
|---|-----------|--------|-------|
| R1–R4, R6, R8–R9 | Rack UX | **Done** | D1–D3 |
| R5 | Цвет номера по HK | **Done** | `rackNumberTextClass` + `RACK_NUMBER_BY_HK` (Wave G) |
| R7 | Расширить фильтры | **Done** | Agency, source, pay, floor, multi room type, date/res/HK, inspected/OOO toggles (Wave D) |

---

## 4. Reservation card (L27–57, CSV)

| # | Spec block | Status | Notes |
|---|------------|--------|-------|
| C1–C10 | Full card CSV | **Done** | Wave E: left panel fields, room icons, attach, lightning, guests cols, pricing grid, folio 1st/2nd + cols, notes |

---

## 5. Room plan (L59–68)

| # | Spec item | Status | Notes |
|---|-----------|--------|-------|
| P1–P6 | Plan parity | **Done** | P4 aligned via `rackNumberTextClass` on room labels (Wave G) |

---

## 6. In-house (L71–72)

| # | Spec item | Status | Notes |
|---|-----------|--------|-------|
| I1–I2 | In-house | **Done** | D2 |

---

## 7. Guest card (L74–118, CSV)

| # | Spec block | Status | Notes |
|---|------------|--------|-------|
| G1, G4 | Stats + left identity | **Done** | |
| G2 | Toolbar | **Done** | Lock, menu, attach stub, copy, print (Wave F) |
| G3 | ID Reader | **Done** | Mock JSON paste modal (Wave F); no TWAIN |
| G5 | Identity grids | **Done** | Full document columns (Wave F) |
| G6 | CRM dashboard | **Done** | Config grid [`guest-crm-config.ts`](../src/lib/guest-crm-config.ts); P2/P3 disabled; clinic/finance satellites |
| G7 | Reservation details | **Done** | Deep links + family/accompanying/booker/analytics; Res-H4 deferred buttons disabled |
| G8 | Details tab | **Done** | marriageDate, bonus %, verification, accounting stub (Wave F) |
| G9 | Loyalty | **Done** | Cards + points history API/grid (Wave F) |
| G10 | Time share | **Done** | Quotation/Agreement/Cancel/All tabs (Wave F) |

---

## 8. Planned backlog (deferred)

| ID | Item | Status after E–G |
|----|------|------------------|
| B1 | Passport hardware scanner | **Done (mock)** | JSON ID reader modal |
| B2 | CRM 50+ buttons | **Done (P0–P1)** | P2/P3 visible-disabled per [GUEST-CRM-ELECTRAWEB.md](./GUEST-CRM-ELECTRAWEB.md) |
| B9 | CRM omnichannel | **Done (platform notify)** + **Partial (vendor STUB)** | WhatsApp/email/SMS via `trySendPlatformNotification`; Twilio/SendGrid not wired |
| B3–B8 | Reservation/guest/rack tails | **Done** | Waves E–G |

---

## 9. How to update this table

1. Change code → update row status here in same PR.
2. UAT: [UAT-SMOKE.md](./UAT-SMOKE.md) §14–15.
3. i18n: `apply-wave-e-res-card-i18n.mjs` · `apply-wave-f-guest-i18n.mjs` · `apply-guest-crm-i18n.mjs`.
4. Migrate: `npx prisma migrate deploy` (includes `20260604120000_guest_crm`).
