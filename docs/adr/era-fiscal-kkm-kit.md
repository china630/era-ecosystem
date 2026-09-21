# ADR: Shared fiscal KKM kit (`@era/fiscal`) — devices, defaults, org credentials

**Status:** Accepted  
**Date:** 2026-09-20  
**Extends:** [sanatorium-vnext.md](./sanatorium-vnext.md) SV7 / SV14 · [org-operating-mode.md](./org-operating-mode.md) · [unified-settlement-hub.md](./unified-settlement-hub.md) · [saas-request-tenant-and-vendor-bridges.md](./saas-request-tenant-and-vendor-bridges.md) · [tenancy-and-outlet-boundaries.md](./tenancy-and-outlet-boundaries.md) · [era-kafe-edition.md](./era-kafe-edition.md) · [era-commercial-catalog.md](./era-commercial-catalog.md)  
**Does not replace:** [hotel-eqaime-readonly-boundary.md](./hotel-eqaime-readonly-boundary.md) (B2B e-qaimə ≠ guest KKM receipt)

## Context

Azerbaijan B2C cash/card payments require an online fiscal cash register (KKM) with a customer QR. ERA has many B2C pay points (hotel Front Cash, F&B, retail, clinic cashier, auto, wholesale walk-in). An org typically has **N fiscal KKMs and N bank POS terminals**, not one device.

Product intent of `@era/fiscal`:

> Connecting a vendor once makes cash-register (and guest bank POS) integration work on **every** satellite **without satellite code changes**. Vendor SDKs, if any, live **only** inside kit drivers.

Satellites call a stable contract at the moment money is taken from the end consumer. They must not embed Omnitech / Cybernet / NBC clients.

**Today (gap vs intent):**

| Layer | Current state |
|-------|----------------|
| Package | `packages/era-fiscal` + `fiscalizeForSatellite` in `@era/satellite-kit` |
| Contract | `fiscalize({ documentRef, amount, paymentMethod, registerRef?, outletCode? })` → `{ receiptId, qrPayload, driver }` |
| Drivers | `mock` (default); `nbc` HTTP if `ERA_FISCAL_NBC_URL` else stub; `cybernet` stub |
| Provider select | Process env `ERA_FISCAL_PROVIDER` / `KKM_DRIVER` |
| Platform | Only `Organization.fiscalRouting` = `OWN \| PARENT` |
| Hotel backlog leftovers | `ERA_NBC_KKM_ENDPOINT`, `ERA_NBC_KKM_CERT_PATH` — **not wired**; same device class as live `ERA_FISCAL_NBC_*` |
| Honesty | Live certified KKM is STUB / VENDOR. Catalog “M9 DONE” = unified mock path |

NBC and Cybernet are **provider slots** for online KKM, not a second hardware category. PKCS#12 on disk is the same anti-pattern rejected for hotel e-qaimə. Finance `CashDesk` / MKO-MXO is accounting, not this kit.

First production driver expected inside the kit: **Omnitech**.

## Decision

### 1. Single kit, satellites stay vendor-blind

All B2C pay paths call `@era/fiscal` (directly or via `fiscalizeForSatellite`). Adding a vendor is a **new driver + per-device credential schema** in the kit plus a **platform device row**. No per-satellite fiscal adapters and no Omnitech imports in hotel / F&B / clinic.

`fiscalizeForSatellite` remains the routing gate: `shouldFiscalizeOnParent` → skip (`parent_fiscal`). Settlement hub / room charge / city ledger ADRs are unchanged.

Clinic cashier today calls `fiscalize()` without the routing wrapper — it **must** use the same helper so DEPARTMENT + PARENT does not double-fiscalize.

Kafe edition ([era-kafe-edition.md](./era-kafe-edition.md) §12) **must not** `if (kafe) skip kit`. V1 storefront does not sell KKM hardware and does not promise certified fiscal in the 29 AZN Gate. Empty device catalog = record cash vs card as facts. When the owner adds devices, the same pay UI calls `listDevices` / `sale`. No second F&B build.

### 2. Full cash-register + bank-POS contract

Amount-only `fiscalize` is not the canonical API. The driver interface is the **device protocol**; satellites pass a basket, tenders, and **device ids**.

| Operation | Purpose |
|-----------|---------|
| `listDevices` | Active devices for this org + outlet + register + `kind` |
| `openShift` / `xReport` / `zReport` | Fiscal **device** shift (map 1:1 to satellite POS `CashShift` / `Shift` where the device requires it) |
| `sale` | Receipt with **line items** (sku/name, qty, unit, VAT, discount), tenders, `documentRef`, `fiscalDeviceId`, optional `bankTerminalId` |
| `refund` / `void` | Linked to original `receiptId` / `documentRef` |
| `bankAuthorize` / `capture` / `reverse` | Guest acquiring on the selected `BANK_POS` (not ERA platform acquiring 1.5%) |
| `status` / `lastReceipt` | Health, QR, reprint metadata |

**Idempotency:** `sale` / `refund` keyed by `documentRef` + `fiscalDeviceId` (and org). Pay retry must not print a second legal receipt.

Mixed tender: `bankAuthorize` on the chosen bank terminal, then `sale` on the chosen KKM with CARD (and/or CASH) tenders.

`NbcFiscalDriverHttp` is a **transport** (POST to a local agent), not the contract. `mock` implements the full interface for UAT.

Satellite X/Z in UI stays an ops report. If the device needs a fiscal Z, close-shift calls kit `zReport` — still no vendor code in the satellite.

### 3. N devices per org; kit lists them; cashier can choose; defaults are required

Hierarchy (retail already has Tenant → Outlet → Register → Shift):

```
Organization
  └─ Outlet
       └─ Workstation / Register
            ├─ FiscalDevice[]   kind = FISCAL_KKM
            └─ BankTerminal[]   kind = BANK_POS
```

KKM and bank POS are **different hardware**. One sale often uses **both**.

Several devices of the **same** vendor (two Omnitech tills) and **mixed** vendors on one org (Cybernet + Omnitech) are normal.

Device row (platform SoR, Sync by `organizationId`):

| Field | Meaning |
|-------|---------|
| `id` | UUID used in `sale` and idempotency |
| `kind` | `FISCAL_KKM` \| `BANK_POS` |
| `providerId` | `omnitech` \| `cybernet` \| `nbc` \| `mock` \| … (kit driver) |
| `label` | Cashier-facing name |
| `outletId` / `registerId` | Usual location (list filter) |
| `serial` / KIZ / TID / MID | Vendor / bank identity |
| `endpoint` + secrets | **This device’s** vault (not process env) |
| `status` | `active` \| `retired` |
| Default flags | See §4 |

There is **no** 1:1 org `providerId`. NBC `ENDPOINT` / PKCS#12 / `ERA_FISCAL_NBC_*` migrate onto **that device row**.

Pay UI: `CatalogField` + `ENTITY_REF` or `CLOSED_SMALL` for device pick — not free text.

| Situation | Behaviour |
|-----------|-----------|
| Exactly one active device of that `kind` in scope | Auto-select (default) |
| Several | Use default cascade (§4); if none, **require** a pick — do not silently take list[0] |
| Open shift already bound | Pay without re-asking; changing device is an explicit action |
| `fiscalRouting=PARENT` | Local KKM list empty / skip; parent prints |
| Live mode, no active KKM, cash pay | Block (except `mode=stub` / empty-catalog fact recording) |

Finance `CashDesk` is not these rows.

### 4. Default selection cascade

Cashier **may** override per sale. They **must not** be forced to pick every receipt.

First non-empty wins:

1. Explicit ids on this `sale`
2. Binding on the **open POS shift**
3. Register / workstation `defaultFiscalDeviceId` / `defaultBankTerminalId`
4. Outlet default, then org default, per `kind`
5. Single active device in scope

SatAdmin / owner sets register and outlet defaults. Not env. Shift binding is chosen at open-shift (pre-filled from register default).

### 5. Credentials on the org (platform), not process env

Same split as Elektraweb policy ([saas-request-tenant-and-vendor-bridges.md](./saas-request-tenant-and-vendor-bridges.md)): Super-Admin / SatAdmin on **that org**, Sync keyed by `organizationId`. Kit resolves devices for **this request’s** org. SHARED must not use `ERA_FISCAL_PROVIDER` for ops.

**May stay off the org card:** `DATABASE_URL`, JWT secrets, optional install-wide “fiscal live allowed” kill switch, physical presence of a Windows agent next to USB/COM. The org still stores **how** ERA talks to that agent (URL, token) **per device**.

### 6. Who calls the kit

| Call `sale` (and bank ops when card) | Do not fiscalize |
|--------------------------------------|------------------|
| Hotel Front Cash / folio guest cash-card | Room charge; fiscal at checkout / hub |
| F&B ticket pay when `shouldFiscalizeAtPos` | Room charge / deferred hub |
| Retail own-fiscal pay | Folio when revenue routed to parent |
| Clinic walk-in when fiscal OWN | IN_HOUSE folio charge |
| Auto / wholesale **B2C** cash-card | B2B / city ledger / e-qaimə |

Logistics / construction / CRM: no KKM unless a B2C desk appears — then the **same** kit.

### 7. Commercial: kit is free; ERA POS count is a capacity meter

`@era/fiscal` is **not** a `pricing_modules` SKU. Connecting Omnitech is not billed. ERA does not sell KKM or bank hardware.

**Billed (catalog policy):** ERA **stations** (till / shift), via `CAPACITY_DRIVERS`:

| Gate | Included | Overage |
|------|----------|---------|
| `industry_fnb_pos` | 1 × `pos` in Gate 29 AZN | +19 AZN / extra `pos` |
| `industry_retail` | 1 × `register` | +19 AZN / extra register |

`max(0, billableStations − includedInGate) × 19`. Kafe: second **outlet with a till** = second station. Waiter phones, KDS, a second KKM on the **same** ERA register, and a second bank dongle on that register are **not** extra `pos`.

**Honesty:** this overage is **list-price policy** on the storefront snapshot. `QuotaGuard` does not meter `pos` yet ([era-commercial-catalog.md](./era-commercial-catalog.md) follow-up). Do not claim CBS lines exist.

Platform meter **acquiring 1.5%** is ERA’s subscription collection rail, not guest `BANK_POS`.

No new SKU is required to “turn the kit on” for Kafe or hotel.

### 8. First vendor: Omnitech (kit only)

1. Widen interface + mock + satellites pass **lines** and **device ids** (defaults applied in kit).
2. Platform device catalog + vault + Sync + SatAdmin form (`CatalogField` for `providerId` / device pick).
3. `OmnitechFiscalDriver` — SDK private to that module.
4. NBC / Cybernet as further drivers on the same device rows; delete hotel backlog env names.

## Consequences

- **+** One recertification surface; all satellites pick up vendors.
- **+** SHARED: each org’s keys stay on that org; N devices per org.
- **+** Kafe can attach hardware later without a fork.
- **−** First wave is larger than “HTTP to Omnitech”: contract, device SoR, defaults, line items on every pay path.
- **−** USB still needs a local agent; ERA Node does not speak COM in the satellite.
- **−** POS overage billing is still unimplemented in QuotaGuard.

## Out of scope (this ADR)

- Finance GL / cash orders
- e-qaimə / Asan İmza
- Claiming GA / certified KKM in editions yaml
- Implementing the `pos` capacity invoice line (separate catalog follow-up)
- Selling physical KKM or bank terminals

## Delivery waves

Suggested engineering order. Honesty: live vendor stays STUB until field device + tax registration.

| Wave | Scope | Done when |
|------|--------|-----------|
| **F0 — Contract** | Widen `@era/fiscal`: devices, `listDevices`, `sale` with lines + device ids, refund/void, shift ops, bank authorize stubs, default cascade in kit, idempotency. Mock implements all. | Unit tests; no satellite UI required |
| **F1 — Call sites** | Hotel, F&B, retail, clinic, auto, wholesale pay paths pass basket + ids; clinic uses `fiscalizeForSatellite`. Empty catalog → fact-only pay (Kafe). | Pay still green on `mock` |
| **F2 — Platform SoR** | Orch device catalog + vault (N KKM + N bank POS / org); Sync by `organizationId`; SatAdmin / Super-Admin CRUD; migrate `ERA_FISCAL_*` / `ERA_NBC_KKM_*` conceptually off env. | SHARED: two orgs, isolated devices |
| **F3 — Cashier UX** | Device select + defaults (register / shift / org); CatalogField; open-shift bind. | UAT-SMOKE UI, not curl-only |
| **F4 — Omnitech** | Driver in kit only; agent/HTTP mapping of full contract. | Lab device or vendor sandbox; still VENDOR until field cert |
| **F5 — NBC / Cybernet** | Same device rows; retire hotel backlog env. | Optional; same honesty |
| **F6 — POS meter (optional, billing)** | Count ERA stations (outlets/registers with a till), QuotaGuard / invoice overage +19. **Not** count KKM rows. | Catalog follow-up; not required to ship the kit |

Acceptance: do not mark live KKM Scaffold ✅ from mock receipts. COVERAGE: OpsUI pay SHIPPED with mock; vendor row STUB until hardware UAT.

## Related code (as of 2026-09-20)

- `packages/era-fiscal`
- `packages/satellite-kit/src/integration/satellite-fiscal.ts`
- Hotel: `settlement-hub.service.ts`, folio settle
- F&B: `app/api/tickets/[id]/pay/route.ts`
- Retail: `app/api/receipts/[id]/pay/route.ts` · `Register` model
- Clinic: `cashier-settle.service.ts`
- Capacity: `CAPACITY_DRIVERS` in `pricing-catalog-canon.ts`
- Orch: `FiscalHardwareDevice` + Super-Admin org hub card + Sync decrypts secrets onto satellite in-memory directory
- Meter: `POS_STATION_MONTHLY` is a **gauge** (delta vs already billed this Baku month). Hotel room overage stays `industry_hotel_pms` rooms — do not report FO cash shifts as POS stations.
- Empty catalog + `organizationId` → `recorded_no_device` (no env mock receipt). `ERA_FISCAL_LIVE=true` → `LIVE_DEVICE_REQUIRED`.
