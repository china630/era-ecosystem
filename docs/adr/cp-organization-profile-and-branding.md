# ADR: Organization profile & branding (control-plane SoR)

**Status:** Accepted — 2026-10-27 (Wave 1–5 landed: schema/API/UI/Sync/kit + consumer prefer-CP; UAT/SHIPPED open)  
**Scope:** Cross-cutting — orchestrator org card + share to finance and industry satellites for print, PDF, letterhead, receipts.  
**Not in scope (this ADR):** fiscal device credentials, ASAN/HSM, inventory valuation, period lock, billing meters, deep print Studio templates.  
**Related:** [org-operating-mode.md](./org-operating-mode.md) · [tenancy-and-outlet-boundaries.md](./tenancy-and-outlet-boundaries.md) · [extensibility-forms-print-reports.md](./extensibility-forms-print-reports.md) · [clinic-print-forms.md](./clinic-print-forms.md) · [deployment-topology.md](./deployment-topology.md) · [era-data-hub.md](./era-data-hub.md) (VÖEN registry fill) · kit `print-snapshot` (`org.*` keys)

## Context

Every product surface needs the same class of org facts: legal name, VÖEN, address(es), phone(s), email(s), logo, director, bank line. Today those facts are **edited in several places** and drift:

| Surface today | What it stores |
|---------------|----------------|
| Orch `Organization` | `name`, encrypted tax id, `settings` JSON — no first-class letterhead |
| Finance `Organization` | `legalAddress`, `phone`, `directorName`, `logoUrl`, bank accounts |
| Clinic `Tenant` | `printLogoDataUrl`, trilingual print addresses/names/footers, clinical signatures |
| Hotel hotel profile / letterhead | name, printName, address, phone, email, website, logo file |

[extensibility-forms-print-reports.md](./extensibility-forms-print-reports.md) already states: **tenant branding (logo, legal names, footers) is SaaS core.** Kit print snapshots already expect `org.name`, `org.taxId`, `org.legalAddress`, `org.logoUrl`, `org.bankLine`.

Additional product constraints:

1. Some attributes are **multi-valued** (several phones, emails, websites, addresses).
2. A **clinic DEPARTMENT** (or standalone clinic) may have **its own** reception number that must not be the hotel’s letterhead phone.
3. One VÖEN may have **N Outlets** (bar + restaurant) with operational contact overlays — see [tenancy-and-outlet-boundaries.md](./tenancy-and-outlet-boundaries.md).
4. `DEPARTMENT` money routing inherits parent VÖEN/fiscal; branding inheritance must be explicit and overridable per channel.

## Decision

### 1. SoR and UI

- **Source of truth** for legal/commercial org identity and shared branding is the **orchestrator** (`Organization` + related profile tables), edited by **OrgOwner** on a single workspace card (e.g. `/workspace/organization` or org settings).
- Industry satellite `/admin` and Finance org settings **must not** remain parallel permanent editors for the same legal fields after cutover. They may show a read-only mirror and deep-link to the control plane, or apply a synced cache.
- Super-admin may view/support; day-to-day edit is OrgOwner.

### 2. What belongs in the central profile

**A — Shared everywhere (SoR on orch, fan-out to all entitled satellites)**

| Concern | Shape | Notes |
|---------|--------|--------|
| Legal / trade names | `legalName` + optional `nameAz` / `nameRu` / `nameEn`; optional `tradeName` | Trade name for façades; legal name for invoices |
| Tax id | VÖEN (existing cipher + blind index) | Not a staff login key ([org-public-number-and-login-host.md](./org-public-number-and-login-host.md)) |
| Legal form / kind | enum aligned with Finance where needed | Commercial vs budget etc. |
| Contacts | **1:N** `ContactChannel` | See §3 |
| Addresses | **1:N** `OrgAddress` | At least one `LEGAL`; optional `POSTAL` / `SITE` |
| Logos | 1:N assets with role `PRIMARY` / `PRINT` / `MONO` (MVP: PRIMARY required) | Object storage URL — avoid unbounded data-URLs in DB long-term |
| Director | `directorName` (+ optional title) | Acts / invoices |
| Stamp / signature (commercial) | optional URLs | Distinct from clinic lab/doctor print signatures |
| Currency | default `AZN` | Already on org |
| Primary bank line | denormalized `bankLine` **or** pointer to primary bank account | Full bank book stays Finance (§4) |

**B — Shared selectively**

| Concern | Consumers | Notes |
|---------|-----------|--------|
| Full bank account list | Finance (primary); print uses primary only | Types MAIN/SALARY/… stay in Finance |
| Data-hub company registry by VÖEN | Orch onboarding fill | Suggestion only — not live SoR after manual edit |
| Holding display | Workforce / executive | Not outlet receipts |

**C — Not in orch SoR (satellite / outlet / product chrome)**

| Concern | Owner | Why |
|---------|--------|-----|
| Clinic print footers, lab/doctor signatures, `checkupSectionsJson` | Clinic tenant | Clinical blank chrome |
| Hotel property `printName`, bed capacity, ops letterhead overrides beyond org | Hotel profile | Property brand ≠ legal entity |
| Outlet name / address / phone | `Outlet` | Same VÖEN, many POS |
| Fiscal / ASAN / HSM / KKM secrets | Finance / device | Compliance secrets |
| Inventory valuation, period lock, tax regime | Finance settings | Accounting policy |
| Modules, topology, usage meters | Orch billing / placement | Not branding |

### 3. Multi-valued contacts and addresses

Do **not** ship scalar `phone` / `phone2` / `clinicPhone` forever. Canonical shape:

```
ContactChannel {
  kind: PHONE | MOBILE | FAX | EMAIL | WEBSITE | WHATSAPP | TELEGRAM | …
  value: string                 // +994… / email / URL
  label?: string                // "reception", "billing", "emergency"
  purpose: GENERAL | LEGAL | BILLING | BOOKING | EMERGENCY | PRINT | …
  isPrimary: boolean            // ≤1 primary per (scope, kind) or per (scope, kind, purpose) — product rule in impl
  sortOrder: number
  locales?: { az?, ru?, en? }   // optional caption on blanks
}

OrgAddress {
  kind: LEGAL | POSTAL | SITE | BRANCH
  // structured and/or free lines + i18n az/ru/en
  isPrimary: boolean
  sortOrder: number
}
```

Backward-compatible **flat projection** for existing print keys:

- `org.phone` ← primary `PHONE` (purpose PRINT or GENERAL)
- `org.email` ← primary `EMAIL`
- `org.legalAddress` ← primary `LEGAL` address (locale-aware when print lang set)
- `org.logoUrl` ← `PRIMARY` logo
- `org.bankLine` ← primary bank summary

Consumers that need the full set read `org.contacts[]` / `org.addresses[]`.

### 4. Scopes and inheritance (clinic’s own number)

| Scope | Stores | Example |
|-------|--------|---------|
| `Organization` STANDALONE | Full legal SoR | Nafta LLC |
| `Organization` DEPARTMENT | Own contacts/addresses/tradeName; **inherits** unset legalName/taxId/logo/bank/legal address from `parentOrgId` | Clinic under hotel — **own reception phone** |
| `Outlet` / property site | Operational channels for that POS only | Bar vs restaurant |
| Product print chrome | Clinic footers/signatures | Not org phones |

**Resolve order** for a clinic print header phone:

1. Channels on the **clinic `organizationId`** (DEPARTMENT or STANDALONE).
2. Else inherit from **parent** STANDALONE (if DEPARTMENT and channel not set).
3. Outlet channels only when the document is outlet-scoped.
4. Clinic print footers/signatures layered on top — they do not replace org contacts.

Unchecking “use parent phone” is simply: create/own a primary PHONE on the DEPARTMENT org. Do **not** copy the clinic number into the hotel tenant row.

Money/fiscal routing remains [org-operating-mode.md](./org-operating-mode.md); this ADR does not change `fiscalRouting` / `revenueRouting`.

### 5. Distribution to satellites

1. Contract in `@era/contracts` (Zod): `organizationProfileSnapshotSchema` (+ flat `org.*` helpers).
2. Orch API: OrgOwner CRUD; internal/read for satellites (Bearer service token or existing Sync path).
3. Prefer inclusion in **runtime-config / Sync** slice `orgProfile` with `updatedAt` / `etag` so SHARED and DEDICATED both refresh without a special snowflake.
4. Satellites **cache** the snapshot locally for offline / tight print loops; stale cache is acceptable within Sync TTL; mutations only on orch.
5. Finance invoice print and kit `PrintSnapshot` bind to the same keys.

### 6. Cutover from today’s editors

| Current editor | After cutover |
|----------------|---------------|
| Finance legalAddress / phone / directorName / logoUrl | Mirror from CP profile (write path deprecated or proxies to orch) |
| Finance bank accounts | Remain Finance SoR; primary feeds `org.bankLine` upstream or dual-write during transition |
| Clinic print address/phone/logo | Prefer CP contacts + logo; keep footers/signatures local |
| Hotel letterhead | Prefer CP; keep property-only fields local |

Migration: one-time backfill orch profile from Finance (prefer) then hotel/clinic where Finance empty. Document in the implementation plan; no emergency wipe of satellite columns until readers switched.

### 7. Acceptance / honesty

- New capability id (suggested): **CP-ORG-PROFILE-01** — Doc + API + OrgOwner UI; satellites consume as API/HEADLESS until each print path is rewired.
- SHIPPED for OrgOwner card only when UAT-SMOKE UI path exists; satellite consumers may stay API until their print UAT.
- Edition / sell claims unchanged until Product-Readiness says otherwise (`platform.yaml` stays honest).

## Consequences

- One OrgOwner place to fix logo/address/phones for the legal entity.
- DEPARTMENT clinic can keep a distinct phone without polluting hotel letterhead.
- Multi-contact model avoids scalar explosion and matches real Nafta ops.
- Temporary dual-write / dual-read during cutover is expected; permanent dual **edit** is not.
- Object storage quota (`storageUsedBytes`) already exists on orch — logo uploads should use it.
- Data-hub VÖEN lookup remains onboarding assist only.

## Non-goals

- Replacing clinic clinical print chrome with a universal template Studio.
- Moving Outlet master data into orch.
- Making VÖEN the staff login key.
- Auto-overwriting manual profile from e-taxes on every Sync.
