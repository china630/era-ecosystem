# Nafta sanatorium — UAT stack & action plan

Living runbook for **real-data pilot** (ElectraWeb hotel + custom clinic + 1 org VÖEN).  
Extends [QUARTET_UAT.md](./QUARTET_UAT.md) with clinic, pharmacy retail, and **per-org docker binding**.

**Finance without 1C:** ops pilot — **hotel folio is source of truth**; Finance collects events but opening balances / GL reconciliation wait for 1C access.

---

## 1. Topology (orchestrator)

| Org | `operatingMode` | VÖEN | Satellites | `ERA_*_ORGANIZATION_ID` |
|-----|-----------------|------|------------|-------------------------|
| Nafta (parent) | `STANDALONE` | client VÖEN | hotel-pms, finance | `ERA_HOTEL_ORGANIZATION_ID` |
| Nafta F&B | `DEPARTMENT` | — (no second VÖEN) | fnb-pos | `ERA_FB_ORGANIZATION_ID` |
| Nafta Clinic | `DEPARTMENT` | — | era-clinic | `ERA_CLINIC_ORGANIZATION_ID` |
| Nafta Pharmacy | `DEPARTMENT` or parent org | — | retail-pos `preset=pharmacy` | `ERA_RETAIL_ORGANIZATION_ID` (optional) |

Parent flags for departments: `revenueRouting=PARENT`, `fiscalRouting=PARENT`.

**Mixed F&B:** in-house → room charge → folio; walk-in → **hotel Front Cash pending queue** when `settlementHub=HOTEL_FRONT_CASH` ([ADR unified-settlement-hub](./adr/unified-settlement-hub.md)); else local pay + KKM ([ADR fb-mixed-settlement-routing](./adr/fb-mixed-settlement-routing.md)).

---

## 2. Docker / env

```bash
cp .env.example .env
# After manual onboarding (§3), set:
ERA_HOTEL_ORGANIZATION_ID=<parent-uuid>
ERA_FB_ORGANIZATION_ID=<fb-department-uuid>
ERA_CLINIC_ORGANIZATION_ID=<clinic-department-uuid>
# Optional pharmacy; fallback for all: ERA_SATELLITE_ORGANIZATION_ID
docker compose up -d --build
```

| Service | Port | Org env |
|---------|------|---------|
| orchestrator web/api | 3000 / 4000 | — |
| finance web/api | 3100 / 4100 | parent org (membership) |
| hotel-pms | 3201 | `ERA_HOTEL_ORGANIZATION_ID` |
| fnb-pos | 3202 | `ERA_FB_ORGANIZATION_ID` |
| clinic | 3203 | `ERA_CLINIC_ORGANIZATION_ID` |
| retail-pos | 3204 | `ERA_RETAIL_ORGANIZATION_ID` or parent |

Shared secrets (must match): `ERA_SSO_SHARED_SECRET`, `SATELLITE_EVENT_SERVICE_TOKEN`, `POS_BRIDGE_SECRET`, `PII_*`.

Quick smoke: `node scripts/quartet-smoke.mjs` · `node era-hotel-pms/scripts/test-pos-bridge.mjs` · `node scripts/nafta-smoke-a1-a5.mjs` (A1 SSO + A5 settlement hub)

**Doc / API / UI gap matrix:** [NAFTA_DOC_API_UI_AUDIT.md](../../docs/NAFTA_DOC_API_UI_AUDIT.md) — use for forgotten UI and doc drift across Nafta satellites.

---

## 3. Onboarding (orchestrator UI — UI-first)

1. **Register** owner at `http://127.0.0.1:3000/register` → **`/organizations`**.
2. **+ Organization** — name + **VÖEN** (10 digits) → **`/workspace`**. Copy parent UUID → `ERA_HOTEL_ORGANIZATION_ID`.
3. **Connect satellites** on `/workspace` (Hotel, Clinic, F&B, Finance). Extend trial: `/super-admin/orgs/{orgId}/subscription`.
4. **Super-admin org hub** — `/super-admin/orgs/{parentOrgId}`:
   - **Create department** (F&B, Clinic) — no second VÖEN; copy UUIDs from list.
   - **Operating mode** — parent stays `STANDALONE`; departments get `DEPARTMENT` + `PARENT` routing automatically on create.
   - **Satellite endpoints** — set `industry_fnb_pos`, `industry_clinic` base URLs (docker hostnames or localhost ports).
5. **Owner read-only view** — `/workspace` card **Departments & env UUIDs** (copy for `.env`).
6. Set `.env` org UUIDs (§2), restart stack.
7. **Automation (optional):** `ORCH_SUPER_ADMIN_TOKEN=… ERA_HOTEL_ORGANIZATION_ID=… node scripts/nafta-onboard-departments.mjs`
8. **SSO smoke:** `SSO_ORG_ID=<parent>` · `node scripts/sso-launch-smoke.mjs`

Legacy curl paths remain valid for CI; prefer UI above for onsite UAT.

---

## 4. Excel import (planned — idempotent)

Buttons on operational screens (next to **+**), gated by `ERA_EXCEL_IMPORT_ENABLED`.

| Screen | Source | Idempotency key |
|--------|--------|-----------------|
| Hotel reservations | ElectraWeb | `electraweb:res:{resNo}` |
| Hotel guests | ElectraWeb | `electraweb:guest:{id}` + MDM FIN |
| Clinic patients / procedures | custom clinic | `nafta-clinic:*` + `hotelResNo` |
| F&B menu | export | outlet + PLU |
| Pharmacy stock | export | SKU + batch |

**Order:** reference data → guests → reservations → patients/procedures → menu/stock.  
**SPA bridge:** no separate Excel — hotel check-in → lifecycle → clinic episode.

---

## 5. UAT tracks (ops-first, no 1C)

| # | Flow | Pass |
|---|------|------|
| A1 | Orch register + module tiles | SSO opens hotel, fb, clinic |
| A2 | ElectraWeb import — rooms, guests, in-house reservations | room plan + in-house list |
| A3 | Check-in → clinic episode | episode OPEN; procedures only after **complete checkup** (`AFTER_CHECKUP`) |
| A4 | Clinic procedure IN_HOUSE → folio charge | nurse QR → complete → `MEDICAL` folio; over-quota `CHARGE_FOLIO` |
| A5 | F&B walk-in → reception | `Send to reception` → `/front-cash/pending` → pay + mock KKM → ticket CLOSED |
| A5b | Clinic walk-in visit | pending → Front Cash pay → visit settled + finance event after callback |
| A6 | F&B in-house room charge | folio line, pay blocked at FB |
| A7 | Check-out / folio total | single settlement point; NA **blocks** on open pending when `pendingSettlementNaPolicy=BLOCK` |
| B1 | Finance events received | journals exist, **no 1C match required** |
| B2 | Night audit event | optional until folio stable |

**Not in Phase 1:** opening balances from 1C, historical folio replay, GL reconciliation.

---

## 6. Legacy sources

| System | Role |
|--------|------|
| ElectraWeb | hotel PMS export (chunked ~1000 rows — merge before import) |
| WebOnly clinic | merged `Randevular.merged.xlsx` + guest registry; linked to hotel guest via passport |
| Custom clinic CSV/XLS | procedures, rooms, practitioners (`Downloads/WO`) |
| Hotel SPA | replaced by ERA check-in lifecycle after import |

### 6.1 Nafta Elektraweb merge inventory (2026-06)

| Dataset | Merged file | Unique keys | Notes |
|---------|-------------|-------------|-------|
| Guest Cards | `Guest Cards.merged.2026-06-13.*.xlsx` | 7 383 `Guest Id` | `Repeat Count` for loyalty seed |
| FOCP reservations | `Front Office Control Panel.merged.2026-06-15.*.xlsx` | 1 346 `Res Id` | T-room = deferred corp. checkout — [ADR](./adr/hotel-deferred-corporate-checkout.md) |
| Folio Transactions 2026 | `Folio 01 jan - 14 jun 2026/Folio Transactions.merged.xlsx` | 27 721 `Id` | 2026-01-01 … 2026-06-14 |
| Folio Transactions 2025 | `Folio 2025/Folio Transactions.merged.2025.xlsx` | 14 260 `Id` | **97% POS ledger (`999 FB`)** — not used for stay migration |
| WebOnly Randevular | `WO RV/Randevular.merged.xlsx` | 31 787 appts | 2026-02-17 … 2026-06-13; `merge-randevular.js` |

Pre-merge: `era-hotel-pms/scripts/merge-*.js` — see [ELEKTRAWEB-IMPORT.md](../era-hotel-pms/doc/ELEKTRAWEB-IMPORT.md) §15.

### 6.2 Migration cutover — point zero 31.12.2025, scope 2026+

**Decision (Nafta):** Elektraweb was not used consistently in 2025 (folio is POS-heavy, reservations may be purged). **Do not replay 2024–2025 operational history** in ERA. Treat **2026-01-01** as the migration window; **31.12.2025** (or first business day 2026) as **point zero** for open balances.

| Layer | Import into ERA | Source at cutover |
|-------|-----------------|-------------------|
| Master data | Full | Rooms, rates, agencies, revenue codes (EW exports) |
| Guest registry | Full | Guest Cards merged (**7 383**) + MDM passport link |
| Reservations | **2026+ only** (+ in-house/future at cutover) | FOCP merged; filter `Arrival >= 2026-01-01` or active statuses |
| Folio charges | **Open / in-house at cutover** + optional 2026 YTD for reconciliation | Folio Transactions merged 2026; **not** 2025 archive |
| Clinic | Randevular 2026 + WebOnly guests | Already collected |
| Loyalty `visitCount` | Seed from Guest Cards `Repeat Count` | Do not recompute from 2025 folio |

**Point-zero reports to pull from Elektraweb (if available):**

1. **Agency / city ledger statement** as of 31.12.2025 — opening AR for B2B (optional Phase 1; Finance when 1C ready).
2. **FOCP** — in-house + future reservations on cutover date (not full historical CheckOut dump unless needed for 2026 overlap).
3. **Folio / ProFolio** — **open folio lines only** on cutover date (in-house guests + unsettled `T` corporate rows per [deferred-checkout ADR](./adr/hotel-deferred-corporate-checkout.md)).
4. **Guest Cards** — snapshot on cutover date (refresh merged file once before go-live).

**Explicitly out of scope:** 2025 folio replay, 2024 folio, historical CheckOut reservation archive, GL opening balances without 1C.

After go-live, ERA is source of truth; Elektraweb read-only until decommission.

**Dual-run (optional, ≤ ~2 weeks before hour X):** after Excel bootstrap, keep FO on Elektraweb while mirroring guests / reservations / open folio into ERA via browser extension so clinic can run on ERA. Runbook: [ELEKTRAWEB-LIVE-BRIDGE.md](../era-hotel-pms/doc/ELEKTRAWEB-LIVE-BRIDGE.md) · [ADR](./adr/hotel-elektraweb-live-bridge.md). During dual-run do not dual-write stays in ERA FO or night-audit-post mirrored medical folios.

Product traceability: [era-hotel-pms/doc/nafta/README.md](../era-hotel-pms/doc/nafta/README.md)

---

## 6. Workforce v3 track (Plan E)

End-to-end CP Workforce hub — run after `node tools/bootstrap-local.mjs --workforce-seed` or `node scripts/nafta-onboard-departments.mjs`.

| Step | Action | Pass |
|------|--------|------|
| W1 | Orch `/workspace/workforce/security` — role matrix seeded (Therapist → clinic DOCTOR) | Matrix visible |
| W2 | Hire via MDM FIN — Med Block — Therapist | Employment ACTIVE; masked name in list |
| W3 | Clinic login as doctor | Reception/doctor routes OK |
| W4 | Submit + approve vacation in CP `/workspace/workforce/absences` | Approved; no Finance CRUD |
| W5 | (If `hr_full`) Finance timesheet sync absences | Locked M/X on draft timesheet |
| W6 | Terminate employment in CP | Clinic login disabled |
| W7 | `node scripts/audit-data-model-integration.mjs` + `node scripts/v3-workforce-smoke.mjs` | 0 audit issues; smoke green |

Without Finance: W1–W4, W6–W7 only.

ADR: [cp-core-workforce-hub.md](./adr/cp-core-workforce-hub.md) · Runbook: [v3-workforce-cutover.md](./runbooks/v3-workforce-cutover.md)

## 6.1 Workforce absences (CP-only path)

When Finance is **not** connected or `hr_full` is off:

1. Orchestrator login as OWNER → `/workspace/workforce/employments` → hire via MDM `globalPersonId`.
2. `/workspace/workforce/absences/new` → VACATION → submit → approve.
3. No Finance API calls required; payroll mirror skipped until `financeEmployeeId` + `hr_full`.

When Finance **is** active: set `financeEmployeeId` on employment (or link via future Plan C provisioning) → approve on CP → Finance `/payroll` shows mirror → `syncAbsences` on draft timesheet.

ADR: [cp-workforce-absence-split.md](./adr/cp-workforce-absence-split.md)

## 6.2 Workforce org structure (CP path)

1. Run `node scripts/nafta-onboard-departments.mjs` (or manual bootstrap) → workforce scope + tree: Sanatorium → Med Block / Administration / F&B.
2. `/workspace/workforce/positions` → create position with slots in Med Block.
3. `/workspace/workforce/employments` → hire with `globalPersonId` + org unit + position; 3rd hire rejected when slots full.
4. (Optional Finance) `/hr/structure` shows mirrored departments; no create/edit — banner links to Workspace.

ADR: [cp-workforce-org-units.md](./adr/cp-workforce-org-units.md)

## 6.3 Workforce roles + Security Admin (CP path)

1. `nafta-onboard-departments.mjs` seeds positions (Therapist, Waiter, Reception) + role matrix templates.
2. `/workspace/workforce/security` — verify matrix; adjust role dropdowns if needed.
3. `/workspace/workforce/employments` — hire with satellite checkboxes (clinic for Med Block therapist).
4. Clinic login → doctor routes; optional manual grant CLINIC_ADMIN + revoke in Security Admin.
5. Terminate employment → satellite login disabled.

ADR: [cp-workforce-role-templates-and-security-admin.md](./adr/cp-workforce-role-templates-and-security-admin.md)

---

## 7. Workforce without Finance (Plan F — 1C export)

Nafta parent org: **`platform_workforce` + industry modules**; **`hr_full` off** by default.

| Step | Action | Pass |
|------|--------|------|
| F1 | Enable `platform_workforce`; bootstrap workforce scope | `/workspace` shows Workforce Hub tile |
| F2 | CP hire + absence (§6 W1–W4) | No Finance container required |
| F3 | `/workspace/workforce/export` → download roster + absences CSV | Files open in Excel; no FIN column |
| F4 | Monthly: operator imports CSV into 1C (manual procedure) | Documented in runbook |
| F5 | `node scripts/v3-workforce-f-smoke.mjs` | Static checks green |

ADR: [workforce-external-payroll-and-1c-export.md](./adr/workforce-external-payroll-and-1c-export.md)

---

## 8. Related docs

- [QUARTET_UAT.md](./QUARTET_UAT.md) — base quartet smoke
- [INTEGRATION_SSO_EVENTS.md](./INTEGRATION_SSO_EVENTS.md)
- [tenancy-and-outlet-boundaries.md](./adr/tenancy-and-outlet-boundaries.md)
- [fb-mixed-settlement-routing.md](./adr/fb-mixed-settlement-routing.md)
- [unified-settlement-hub.md](./adr/unified-settlement-hub.md)
