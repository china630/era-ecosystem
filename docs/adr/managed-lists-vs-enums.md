# ADR: Managed lists vs Prisma enums (tenant / platform catalogs)

**Status:** Accepted  
**Date:** 2026-08-04  
**Scope:** Cross-cutting — all cores and industry satellites. Pre-production migration of business taxonomies out of PostgreSQL / Prisma enums into admin-managed catalogs.

## Context

The monorepo has on the order of **~315 Prisma enums**. Many are correct (lifecycle statuses, integration protocols, AuthZ). Many others encode **business pick-lists** (market, segment, payment tenders, note types, lead channels, payroll component codes, cash-order subtypes) that operators expect to extend, rename, disable, and sort without a schema migration.

Symptoms today:

- Hotel `Reservation.market` / `segment` are free `String?` with **hardcoded UI options** (“master data later”).
- Guest `vipType`, `loyaltyTier`, `visaType`, `maritalStatus` are free text with no picker.
- Cross-satellite **payment methods** diverge (hotel Prisma enum vs clinic hardcoded `TRANSFER` vs F&B/retail Zod).
- Finance already has CRUD models (`TaxRate`, `UnitOfMeasure`, `PayrollComponent`) but **`PayrollComponent.code` is still a Prisma enum**, blocking custom earnings.
- Platform catalogs (`CounterpartyLegalForm`, UoM/tax kinds) are **duplicated with divergent value sets** between finance-core and data-hub.
- **UI control debt:** many catalog-shaped fields render as plain text (or have no control), while others are already `Select` but backed by hardcoded arrays — catalog SoR alone does not fix ops UX.

Related SoR for *global* read-only catalogs remains [reference-data-ecosystem.md](./reference-data-ecosystem.md). This ADR covers **operational / tenant / hybrid seedable lists** and the **required UI control type** for each, not FX/calendar/VÖEN ingest.

## Decision

### Three tiers (do not collapse)

| Tier | Owner surface | Storage | Examples |
|------|---------------|---------|----------|
| **T1 Tenant catalog** | SatAdmin (or Finance admin for finance-owned) | Local satellite / finance table; `code` immutable; `active` retire | Hotel market/segment, note types, CRM channels, clinic body parts, PKO/RKO subtypes |
| **T2 Platform catalog** | SuperAdmin (hub / MDM / orch seed) | Data-hub or MDM / orch registry; satellites consume via Platform Gateway or MDM | Legal form, blood group, marital status, statistical categories, identifier types, absence kinds (seed) |
| **T3 Code enum** | Engineers only | Prisma enum or Zod + DB CHECK | `ReservationStatus`, `InvoiceStatus`, `PaymentRail`, `LabResultFlag`, `OrgOperatingMode` |

**Rule:** “Move to admin” means T1 or T2 — **not** “delete every enum”. Lifecycle and protocol values stay T3.

### Target row shape (canonical)

Prefer one pattern per deployment DB (adapt names to existing master-data style, e.g. hotel `BookingSource`):

```text
LookupValue / *CatalogItem
  id
  code          // immutable natural key (UPPER_SNAKE or slug)
  systemKey?    // optional stable key for posting / reports when code is tenant-local
  nameAz, nameRu, nameEn
  sortOrder
  active        // retire — never hard delete if referenced (see hotel-master-data-retire-policy)
  meta Json?    // e.g. tender → fiscal mapping, GL hint
  organizationId? // null = platform seed copy; set = tenant row
```

FK strategy:

1. Prefer **FK to catalog row id** for new fields.
2. Allowed transitional: store `code` string + validate against active catalog (matches `Room.bedTypeCode` / `viewCode` pattern).
3. Prisma enum → `String` (or FK) in the same migration wave that seeds rows from former enum values. **No dual-write legacy forever** — pre-prod allows cutover.

### Cross-satellite shared catalogs

| Catalog | SoR | Consumption |
|---------|-----|-------------|
| **Tender / payment method** | Prefer org-level definition in finance or orch “org prefs”; satellites consume subset | Hotel FO, clinic cashier, F&B, retail, wholesale |
| **Legal form, UoM kind, tax kind** | `era-data-hub` (align finance enums to hub) | Finance + gateway |
| **Blood / marital / person segment / statistical** | MDM | Hotel guest cache, clinic patient, HR profiles |
| **Workforce absence kinds** | Orchestrator workforce seed (T2) + org disable list | Orch UI; finance timesheet types align by `systemKey` |

**Tender types (Phase 0 / A0):** `@era/contracts` `tender` module — `TenderRow`, `TenderOrgEnablement`, `TENDER_SEED_ROWS`. HTTP enablement API is Phase 4.

### T1 Lookup row pattern (canonical)

Align new SatAdmin catalogs with existing hotel master rows (`BookingSource`, `RoomView`, `BedType`):

| Column | Rule |
|--------|------|
| `code` | Immutable natural key after create |
| `name` / `nameAz`+`nameRu`+`nameEn` | Editable labels (i18n) |
| `active` | Retire flag — never hard-delete if referenced ([hotel-master-data-retire-policy.md](./hotel-master-data-retire-policy.md)) |
| `sortOrder` | Picker order |
| `systemKey` | Optional; seed rows keep stable posting/report key |

Industry satellites **must not** invent parallel global ingest — see [orchestrator-platform-integration-gateway.md](./orchestrator-platform-integration-gateway.md).

### Explicitly out of scope (stay T3)

- All `*Status` workflow enums (reservation, folio, invoice, loan, trip, lab order, …).
- AuthZ: `UserRole`, `PermissionCategory`, `HoldingAccessRole` (RBAC table migration is a separate track).
- Integration protocols: `PaymentRail`, `SignatureProvider`, `SettlementSourceSystem`, LIS formats, notification channels as transport.
- Accounting invariants: `AccountType`, `TradeContext`, `LedgerType`, depreciation *method* algorithms, `LabResultFlag`.
- Product config flags: `BillingTarget`, `OrgOperatingMode`, `OrgRouting`, `ProgramSchedulingMode`.

Construction and other apps that already use `String` + Zod for statuses: **do not introduce new PG enums** for those lifecycles.

---

## Ownership matrix

**Admin owner legend**

| Owner | Meaning |
|-------|---------|
| **SatAdmin** | Satellite `/admin/*` (Hotel_Admin, CLINIC_ADMIN, CRM admin, …) |
| **Finance** | Finance-core org admin / accounting settings |
| **SuperAdmin** | Orchestrator `/super-admin/*` or platform seed in data-hub/MDM (not tenant-editable values, only enable/disable where noted) |
| **OpsUI** | Day-to-day picker only — not catalog CRUD |

### Wave A — tenant / ops catalogs (high ROI)

| Field (current) | App | Target model | Admin owner | Notes |
|-----------------|-----|--------------|-------------|-------|
| `Reservation.market` | hotel | `Market` (or `LookupValue` kind=`MARKET`) | SatAdmin | Replace hardcoded FO options |
| `Reservation.segment` | hotel | `Segment` | SatAdmin | Same |
| `Guest.vipType` / `Reservation.vipType` | hotel | `VipType` | SatAdmin | |
| `Guest.loyaltyTier` | hotel | `LoyaltyTier` | SatAdmin | Optional meta: bonus % |
| `Guest.visaType` | hotel | `VisaType` | SatAdmin | Seed common AZ/Schengen; tenant extend |
| `PaymentMethod` enum + clinic/fnb/retail tender consts | hotel, clinic, fnb, retail, wholesale | `Tender` / `PaymentMethodCatalog` + org enablement | **Finance** (org SoR) + SatAdmin enable subset | Cross-satellite; satellite stores code FK/string |
| `ReservationNoteType` | hotel | `ReservationNoteType` catalog | SatAdmin | Retire Prisma enum |
| `ConciergeProductCategory` | hotel | category on product or `ConciergeCategory` | SatAdmin | |
| `EventOrderLineKind` | hotel | `EventOrderLineKind` catalog | SatAdmin | |
| `BodyPart` | clinic | `BodyPart` catalog | SatAdmin | Seed HEAD…FULL_BODY |
| Clinic cashier payment methods | clinic | same `Tender` | Finance + SatAdmin | Align with hotel |
| `LeadChannel` | crm | `LeadChannel` catalog | SatAdmin | |
| `ProspectType` | crm | `ProspectType` catalog | SatAdmin | |
| `Lead.activitySector` | crm | `ActivitySector` catalog | SatAdmin | Free text → picker |
| `LeadStage` | crm | Pipeline stage rows (`PipelineRule` / stage table) | SatAdmin | Drop Prisma enum when pipeline is SoR |
| `PayrollComponentCode` | finance | `PayrollComponent.code` → `String` + seed | Finance | Model exists; unlock custom codes |
| `CashOrderPkoSubtype` / `CashOrderRkoSubtype` | finance | `CashOrderSubtype` catalog | Finance | Seed AZ defaults |
| `ContractType` | finance | `ContractType` catalog | Finance | |
| `EmployeeDocumentKind` | finance | `EmployeeDocumentKind` catalog | Finance | |
| Procurement protocol type (UI) | finance | `ProcurementProtocolType` | Finance | Today hardcoded |
| Cash deposit source (UI) | finance | catalog or meta on cash subtype | Finance | KASSA / FOUNDER → seed |
| VAT rate picks in product/invoice modals | finance | existing `TaxRate` only | Finance | Remove hardcoded `[-1,0,2,8,18]` |

### Wave B — platform hybrid catalogs (seed + SuperAdmin)

| Field (current) | App / plane | Target model | Admin owner | Notes |
|-----------------|-------------|--------------|-------------|-------|
| `CounterpartyLegalForm` (finance ≠ data-hub sets) | finance + data-hub | Hub `legal-forms` registry; finance FK/code | SuperAdmin | Unify value sets |
| `UnitOfMeasureKind` / `TaxRateKind` | finance + data-hub | Hub kinds; local UoM/TaxRate rows stay tenant/global rows | SuperAdmin (kinds) / Finance (rates) | |
| `PersonIdentifierType` | MDM | MDM seed | SuperAdmin | |
| `PersonSegment` | MDM | MDM seed | SuperAdmin | |
| `BloodGroup` (MDM + clinic `PatientBloodGroup`) | MDM + clinic | MDM SoR; clinic cache/enum → code | SuperAdmin | |
| `MaritalStatus` (MDM + hotel `Guest.maritalStatus`) | MDM + hotel | MDM SoR; hotel picker from gateway/MDM | SuperAdmin | |
| `StatisticalCategory` | MDM | MDM seed | SuperAdmin | AZ social categories |
| `WorkforceAbsenceKind` | orch | Workforce absence kind catalog | SuperAdmin (+ org disable) | Align finance `TimesheetEntryType` via `systemKey` |
| `BankAccountType` | finance | seed catalog | Finance (labels) / SuperAdmin (system keys) | |
| `ApprovalDocumentType` | finance | seed growing with modules | SuperAdmin seed + Finance policies | |
| `StockMovementReason` | finance | seed catalog | Finance | Posting keys stable |
| `Guest.gender` / `title` / `nationality` | hotel | seed lists (nationality ISO via hub/gateway) | SuperAdmin (ISO) / SatAdmin (title labels optional) | |
| `PosResourceType`, `AddOnPricingUnit`, `ServiceCatalogKind`, `ResourceKind` | hotel / clinic | seed + disable | SatAdmin disable only | Full free CRUD optional later |
| `CardScheme` / `CardType`, `ProductKind` (bank) | bank-core | seed product factory | SuperAdmin / Bank SatAdmin | UI must match core enums during transition |
| `HoldReason` | bank-core | catalog | Bank SatAdmin | |
| Industry / satellite lists in orch UI | orch | `PricingModule` / satellites table | SuperAdmin | Delete hardcoded page consts |
| Retail vertical presets | retail | code config OK or seed | SuperAdmin | Low priority |

### Keep T3 (document only — no Wave A/B work)

Grouped: all lifecycle `*Status`; `AccountType`; `TradeContext`; `PaymentRail`; `LabResultFlag`; `FolioType` (routing); `ProductType` SELLABLE/STOCK; `PartyKind` binary; `TxnType` / `CardTxnType`; `OrgOperatingMode` / `OrgRouting`; AuthZ role enums; signature/EQAIMÉ/EMAS portal enums.

---

## UI control contract

Catalog SoR (T1/T2) is incomplete without the correct ops control. **SHIPPED for a managed list requires both:** admin CRUD (where T1/T2) **and** the control type below on every create/edit path that sets the field.

### Default control by semantics

| Catalog size / semantics | Default control | Forbidden |
|--------------------------|-----------------|-----------|
| ≤12 mutually exclusive values | **Select** (`FieldSelect` / native `<select>`) or **Radio / chips** on hot ops paths (pay tender, party billing) | Plain text / free `shortText` |
| Multi-value taxonomy | **Multi-select** or checkbox group | Comma-separated text |
| ≥20 values, searchable codes, or entity refs | **Autocomplete / AsyncCombobox** (API-backed) | Plain text; native select of 100+ items |
| Boolean flags | **Checkbox** | `"true"` / `"false"` text |
| T3 lifecycle status | Filter **Select** and/or **action buttons** that advance state | Free-text status entry |
| Catalog admin create (`code` / `name`) | Text for natural key + labels | — |
| Entity refs (account, GL, SKU, guest, project) | Autocomplete by API | Raw UUID text (except debug/scaffold explicitly marked) |
| Soft hint over known codes (legacy import) | Prefer strict Select; `<datalist>` only transitional | Datalist as long-term ops control |

**Kit (shipped):** `@era/satellite-kit/ui` — `CatalogFieldKind`, `resolveCatalogControl`, `inferCatalogFieldKind`, `CatalogField`. Agents/devs pick a **kind**; the kit assigns Select / Multi / Chips / Combobox. Plain text only for `FREE_TEXT`. Cursor rule: `era-managed-list-controls.mdc`. Full async entity fetch can deepen `ENTITY_REF` later; client filterable combobox is the Phase 0 baseline.

### UI status legend (debt matrix)

| Status | Meaning |
|--------|---------|
| `select-hardcoded` | Dropdown OK; options are const arrays — wire to catalog |
| `select-api` | Dropdown OK; options from master/API — keep pattern |
| `text` | Plain text / `shortText` / `code` where closed list required |
| `datalist` | Text + `<datalist>` — upgrade to strict Select |
| `radio-chips` | Buttons / chips — keep when ≤4 ops actions |
| `missing` | Field/enum exists in API/schema; no picker on create/edit |
| `ok-text` | Free text is correct (names, phones, document numbers) |
| `special` | Non-select UX kept on purpose (e.g. body silhouette) |

### UI debt matrix (audit 2026-08-04)

#### Hotel PMS

| Screen / file | Field | UI now | Target control | Wave |
|---------------|-------|--------|----------------|------|
| `ReservationCardLeftPanel.tsx` | market, segment | `select-api` (HotelLookup) | Select ← SatAdmin catalog | A1 ✅ |
| same | paymentMethod | `select-api` (Tender seed) | Select ← Tender | A3 ✅ |
| same | sourceId, agencyId, room/rate/meal | `select-api` | keep Select | — |
| same | vipType, tripReason | `select-api` | Select | A1 ✅ |
| same | preferredLocation, preferredBed | `select-api` | Select ← RoomView / BedType | A1 ✅ |
| same | accomType, recordType | `select-api` | Select (catalog or seed) | A1 ✅ |
| same | specialStates | `select-api` (multi) | Multi-select | A1 ✅ |
| `GuestCardLeftPanel.tsx` | title, gender, vipType, loyaltyTier, visaType, maritalStatus, verificationStatus | `select-api` | Select | A1 ✅ / B2 |
| same | nationality | `select-api` (ISO interim) | Autocomplete (hub) | B2 interim |
| same | names, phone, visaNumber, FIN, … | `ok-text` | text | — |
| `admin/master-data/page.tsx` | room `viewCode`, `bedTypeCode` | `select-api` | strict Select | A1 ✅ |
| same | revenue `taxTag` | `text` | Select ← TaxRate | A6 / B |
| Folio / `GroupBookingModal` | paymentMethod | `select-api` (Tender) | Select ← Tender | A3 ✅ |
| `front-cash/pending` | CASH / CARD | `radio-chips` | keep; expand via Tender | A3 |
| Guest CRM tags / allergens / preference importance | `text` | Autocomplete / Select | A1+ / P1 |
| Notes tab | note types | `select-api` (NOTE_TYPE slots) | catalog-driven | A2 ✅ |

#### Clinic

| Screen / file | Field | UI now | Target control | Wave |
|---------------|-------|--------|----------------|------|
| `PatientCardBody.tsx` | sex, bloodGroup | `select-hardcoded` | Select ← MDM | B2 |
| `patients/page.tsx` create | bloodGroup | `select-api` (CatalogField) | Select ← MDM | B2 interim ✅ |
| Patient create / card | nationality | `select-api` (ISO interim) | Autocomplete | B2 interim ✅ |
| Clinical / admin procedure | bodyPart | `select-api` (ClinicLookup) | Select ← BodyPart catalog | A4 ✅ |
| `PatientContraindicationsPanel` / silhouette | body part | `special` | keep silhouette + catalog codes | A4 |
| `CashierSettleModal.tsx` | method | `select-api` (Tender) | Select ← Tender (incl. TRANSFER) | A3 ✅ |
| `admin/diagnostic-catalog` | category, kind, section | `text` | Select | A4+ / P1 |
| same | analyte unit | `text` | Autocomplete ← UoM | B1 |

#### Finance

| Screen / file | Field | UI now | Target control | Wave |
|---------------|-------|--------|----------------|------|
| Counterparty modals | legalForm, role | `select-hardcoded` | Select ← hub / seed | B1 |
| `banking/cash/page.tsx` | pkoSubtype / rkoSubtype | `select-api` (CashOrderSubtype) | Select ← catalog | A6 ✅ |
| same | offsetAccount (OTHER) | `select-api` (AsyncCombobox CoA) | Autocomplete ← CoA | A6 ✅ |
| `CreateInvoiceModal` | vatRate, tradeContext | `select-api` / select | keep; VAT from TaxRate API | A6 ✅ |
| same | incoterms | `text` | Select (platform Incoterms) | B / Phase2 / P1 |
| same | countryOfDestination | `text` | Autocomplete ← countries | B / P1 |
| Contracts / payroll components | type / codes | `select-api` (`/settings/payroll-components`) | Admin Select + CRUD | A6 ✅ |
| Product / bank-account / FA depreciation | selects | `select-hardcoded` | keep pattern | — |

#### Bank / Orchestrator / Bank DBO

| Screen / file | Field | UI now | Target control | Wave |
|---------------|-------|--------|----------------|------|
| Bank CIF / Payment / Product / Hold / IFRS9 | party type, rail, product, reason, stage | `select-hardcoded` | keep Select; align rails to core | B4 |
| Bank AccountOpen / Product / inbound | currency | `text` | Select | scaffold → B4 |
| Bank modals | customerId, branchId, glAccountId, … | `text` | Autocomplete | scaffold |
| Orch absences / holdings / early-access | kind, role, industry | `select-hardcoded` | Select ← catalog / pricing | B3 / B5 |
| Bank DBO transfers | from/to account | `select-api` | keep | — |
| Bank DBO `payments/new` | debit account | `missing` (hidden first) | Select | P1 fix |
| Bank DBO login channel | RETAIL / CORPORATE | `radio-chips` | keep | — |

#### CRM / F&B / Retail / Wholesale / Logistics / Auto / Construction

| Screen / file | Field | UI now | Target control | Wave |
|---------------|-------|--------|----------------|------|
| `era-crm/.../leads/page.tsx` | partyKind, prospectType | `select-api` (CrmLookup) | Select ← catalog | A5 ✅ |
| same | activitySector | `select-api` (CrmLookup) | Select ← ActivitySector | A5 ✅ |
| same create | channel | `select-api` (CrmLookup) | Select ← LeadChannel | A5 ✅ |
| CRM lead detail | stage | `select-hardcoded` | Select ← pipeline rows | A5 / P1 |
| F&B `OrdersPanel` | pay CASH/CARD/TRANSFER | `radio-chips` | keep; Tender SoR | A3 ✅ |
| Retail POS | preset, payment | `select-api` / CatalogField | keep; Tender later | A3 ✅ |
| Wholesale import-orders | currencyCode | `text` | Select | P1 |
| Wholesale | order channel / pay | `missing` | Select / radio-chips | A3 / P1 |
| Logistics trip | status advance | `radio-chips` / buttons | keep (T3) | — |
| Auto work-orders | pay, partsStatus, part SKU | `missing` / text | Select / Autocomplete | P1 |
| Construction field-ops | weather | `text` | Select (presets) | P1 |
| Construction material-requisitions | projectCode, itemCode | `text` | Select / Autocomplete | P1 |

### UI priority (cross-cutting)

| Priority | Focus |
|----------|--------|
| **P0** | ✅ Cleared (2026-08-04): Hotel FO/guest CatalogField; CRM channel + activitySector + prospect from CrmLookup; hotel market/segment from HotelLookup |
| **P1** | Finance Incoterms / country; ContractType / EmployeeDocumentKind; hotel revenue taxTag; wholesale/auto/construction missing pickers; CRM stage ← pipeline |
| **P2** | Shared AsyncCombobox deepen in kit; diagnostic category/kind; guest CRM allergens/tags autocomplete |

**P1 tracking (2026-08-04 wave):** bank-dbo debit Select done; hotel view/bed Select done; GL offset Autocomplete done; remaining P1 (Incoterms, wholesale currency, auto pay UI, construction weather, cash subtypes as T1 table) parked for follow-up PRs — owners = product app SatAdmin.

Definition of done for UI rows: status leaves `text` / `datalist` / `missing`; `select-hardcoded` becomes `select-api` (or catalog-backed equivalent); UAT-SMOKE uses the picker (not typed free strings).

---

## Migration plan

### Principles

1. **Pre-prod cutover** — no long dual-write; migrate data, drop Prisma enum in same PR when safe.
2. **Seed former enum values** with `active=true` and stable `code` identical to old enum member names (keeps reports/API clients working).
3. **Retire, don’t delete** — follow [hotel-master-data-retire-policy.md](./hotel-master-data-retire-policy.md) for hotel; same `active` rule for new catalogs elsewhere.
4. **UI before SHIPPED** — SatAdmin/Finance CRUD + ops picker of the **correct control type** (see UI control contract); UAT-SMOKE path; COVERAGE / acceptance matrices updated per capability.
5. **i18n** — `nameAz` / `nameRu` / `nameEn` on rows; stop hardcoding option labels in one locale only.
6. **No text-for-list regressions** — new catalog-shaped fields must ship as Select / Multi / Radio / Autocomplete per the contract; plain text is allowed only when marked `ok-text`.

### Wave A (execute first)

| Step | Work | Exit criteria | Status (2026-08-04) |
|------|------|---------------|---------------------|
| A0 | Shared design: `Tender` contract (code, labels, meta for fiscal/GL) + ownership Finance org prefs vs satellite subset | ADR amended if contract changes; kit type in `@era/contracts` if cross-app | ✅ `@era/contracts` tender + kit helpers |
| A1 | Hotel: Market, Segment, VipType, LoyaltyTier, VisaType models + `/admin/master-data` + FO/guest **Select** pickers; view/bed strict Select; FO prefs/tripReason off text | No hardcoded market/segment arrays; guest/FO catalog fields not `text`/`datalist` | ✅ `HotelLookup` + CatalogField |
| A2 | Hotel: ReservationNoteType, ConciergeCategory, EventOrderLineKind → catalogs; drop enums | Admin CRUD + retire | ✅ Lookup kinds + admin/seed; Prisma enums **dropped** → String codes |
| A3 | Tender enablement: Finance SoR + hotel/clinic/fnb/retail(/wholesale) consumers; pay UI stays Select or radio-chips | One code set; clinic `TRANSFER` as catalog row; no divergent tender consts | ✅ Finance `GET/PUT /organization/tenders`; hotel/clinic/fnb/retail consumers; wholesale P1 |
| A4 | Clinic: BodyPart catalog + contraindications/procedure UI | Enum removed or unused; diagnostic category/kind Select where closed | ✅ `ClinicLookup` + admin; Prisma `BodyPart` enum **dropped** → String |
| A5 | CRM: channels, prospect types, activity sectors; stages owned by pipeline; **expose channel Select on create** | No inferred-only channel; activitySector not free text | ✅ `CrmLookup` + create CatalogFields; stage pipeline P1 |
| A6 | Finance: PayrollComponent.code String; CashOrder subtypes; ContractType; EmployeeDocumentKind; TaxRate-only VAT UI; GL offset Autocomplete | Custom payroll code create works; no VAT const arrays; offsetAccount not plain text | ✅ Payroll String + UI; cash `CashOrderSubtype` T1 + API/UI; offset Autocomplete; VAT TaxRate API; ContractType/EmployeeDocumentKind still P1 |

**Suggested PR split:** A1+A2 (hotel-only) → A3 (multi-app, careful) → A4 → A5 → A6 (finance-only). Obeys per-core ship skill; no emergency reset.

### Wave B (after A0–A3 stabilize)

| Step | Work | Exit criteria |
|------|------|----------------|
| B1 | Unify `CounterpartyLegalForm` (+ document finance↔hub mapping) in data-hub; finance consumes hub/gateway | Single value set in docs + seed |
| B2 | MDM demographics SoR: blood, marital, statistical, identifier types; hotel/clinic pickers | No divergent clinic/MDM blood enums |
| B3 | Orch workforce absence kinds catalog; finance timesheet types map by systemKey | CP absence ADR still governs pay formulas |
| B4 | Remaining hybrid seeds (BankAccountType, StockMovementReason, ApprovalDocumentType, bank HoldReason/CardScheme) | Seed + admin labels; systemKey immutable |
| B5 | Purge hardcoded industry lists in orch employments / early-access survey — read pricing/satellite catalog | UI complete vs MODULES_CATALOG |

### Wave C (explicit non-goal)

Do **not** convert T3 lifecycle/protocol enums to tables “for consistency”. Revisit only if a paying tenant requires custom *workflow* states (unlikely; prefer labels/i18n overlay).

### Tracking

| Artifact | Role |
|----------|------|
| This ADR | Decision + ownership matrix + UI control contract + UI debt matrix + waves |
| Phase plans | [`.cursor/plans/managed-lists-roadmap.plan.md`](../../.cursor/plans/managed-lists-roadmap.plan.md) + `managed-lists-phase-0…6*.plan.md` |
| Cursor rule | [`.cursor/rules/era-managed-list-controls.mdc`](../../.cursor/rules/era-managed-list-controls.mdc) — ban text-for-list; kind → control |
| Kit API | `@era/satellite-kit/ui` — `CatalogField`, `resolveCatalogControl`, `CatalogFieldKind`, `inferCatalogFieldKind` |
| App DELIVERY / COVERAGE rows | Per-catalog SHIPPED when admin UI + **correct** picker + seed exist |
| [reference-data-ecosystem.md](./reference-data-ecosystem.md) | Global SoR unchanged; Wave B legal-form/UoM kinds align here |
| [hotel-master-data-retire-policy.md](./hotel-master-data-retire-policy.md) | Retire semantics for hotel T1 |
| [UI_PLAYBOOK_SATELLITES.md](../UI_PLAYBOOK_SATELLITES.md) | Shell/patterns + CatalogField |

---

## Consequences

- Fewer PG `ALTER TYPE` migrations when hotels add markets or finance adds payroll codes.
- Slightly more admin surface area; must ship empty-state + seed so pilot orgs are not blank.
- Cross-satellite tender requires a clear SoR (Finance org) — satellites only enable/disable and map locally.
- Agents and module-maps must list new `/admin` catalog routes when implemented.
- Acceptance: new catalogs that affect sell/show update Implementation-Matrix + Product-Readiness for the owning product line.
- Ops forms must not “finish” catalog work while leaving `text` / `datalist` / `missing` controls — UI debt matrix is part of wave exit criteria.
- Shared Autocomplete/Combobox in the design system becomes a platform dependency for nationality, GL, UoM, and SKU pickers.

## Alternatives considered

| Option | Why rejected |
|--------|----------------|
| Keep all lists as Prisma enums | Blocks tenant config; enum migration pain |
| Move *all* enums including statuses to tables | State machines become data-driven soft mess; no product need pre-launch |
| Free `String` everywhere without catalog | Status quo hotel market/segment — no referential integrity, bad reporting |
| Each satellite owns global legal-form/blood lists | Already diverging finance vs hub — forbids duplication |
| Catalog tables but keep free-text ops inputs | Operators reintroduce garbage values; reporting breaks; defeats T1/T2 |
| `<datalist>` as permanent picker | Looks like autocomplete but does not enforce membership — reject for FO/admin inventory codes |

## References

- Inventory basis: repo-wide Prisma enum audit 2026-08-04 (~315 enums; finance 113, hotel 55, orch 42, bank-core 40, clinic 31).
- UI control audit 2026-08-04 — hotel/clinic/finance/bank/orch/crm and smaller satellites (see UI debt matrix).
- [reference-data-ecosystem.md](./reference-data-ecosystem.md)
- [reference-data-phase2-catalogs.md](./reference-data-phase2-catalogs.md)
- [orchestrator-platform-integration-gateway.md](./orchestrator-platform-integration-gateway.md)
- [hotel-master-data-retire-policy.md](./hotel-master-data-retire-policy.md)
- [cp-workforce-absence-split.md](./cp-workforce-absence-split.md)
- [crm-lead-party-model-and-prospect-import.md](./crm-lead-party-model-and-prospect-import.md)
- [era-mdm-natural-person-identity.md](./era-mdm-natural-person-identity.md)
- [UI_PLAYBOOK_SATELLITES.md](../UI_PLAYBOOK_SATELLITES.md)
