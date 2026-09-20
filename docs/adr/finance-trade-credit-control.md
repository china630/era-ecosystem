# ADR: Finance trade credit control (limit, A–D policy, pickup grant)

**Status:** Accepted — **Phase 0–3 eng** (lock, A–D, optional 2a/2b/2c, Phase 3 working-capital suggested limit); not Pilot / not SHIPPED  
**Date:** 2026-09-13  
**Amended:** 2026-09-18 — Phase 3 working-capital limit engine (suggested limit proposals; A–D remains discipline lock)  
**Product:** ERA Finance (`era-finance-core`) + Control plane billing (`era-orchestrator`) + enforcement in industry satellites (first: `era-wholesale`)  
**SKU:** `trade_credit_control` (premium add-on; not in NAS base); Phase 2c also `trade_credit_factor_lead`

## Context

NAS Finance already **records** AR (invoices, aging, `paymentTermsDays`, reconciliation) and exposes a **guest invoice link** (`/portal/invoice/{token}`). It does **not** own a credit limit. Wholesale already calls Finance for `creditLimit` and falls back to a stub because `Counterparty` has no such field. Hotel keeps `creditLimitAzn` on agency/profile — not Finance SoR.

The commercial need is not a fintech bureau and not IFRS 9. Accountants want a **lock against sales**: the buyer (or finance) sees whether deferred shipment is allowed, receives a **short-lived confirmation (code/QR)**, and warehouse/sales may ship on credit **only** against that grant. Internal **A–D groups** (product language **А–Г**) drive later auto-raise (A) and auto-block (D). Groups are **finance-only** — not sales, not the buyer portal.

Related (do not conflate):

- Invoice guest portal — [era-finance-core/PRD.md](../../era-finance-core/PRD.md) §4.4.1 (one invoice, no login).  
- Wholesale credit stub — `GET /api/credit-limit`.  
- Hotel agency portal / CL — [hotel-agency-portal.md](./hotel-agency-portal.md), [hotel-city-ledger-and-fo-money.md](./hotel-city-ledger-and-fo-money.md).  
- Bank credit/ECL — [era-bank-risk-and-audit.md](./era-bank-risk-and-audit.md) (**out** of this SKU).  
- Multi-book — [finance-accounting-book.md](./finance-accounting-book.md) (eng-complete; Lab RT deferred). Trade credit is a **separate** Finance domain (AR + shipment gate), not a GAAP follow-up PR. Exposure reads the **default ops** book.

## Decision

### 1. Two layers, one SKU

| Layer | Job | Visible to |
|-------|-----|------------|
| **Lock (protocol)** | Limit, AR exposure, residual, **pickup grant** (code/QR), shipment guard | Buyer: residual + grant. Sales/warehouse: grant validity + amount only |
| **Policy (brain)** | Internal groups **A–D** (UI **А–Г**), review queue, later auto-raise A / auto-block D | **Accountant / owner / finance admin only** |

Without the lock, scoring is another aging report. Without policy, the lock stays fully manual.

### 2. Source of truth

| Concern | Owner |
|---------|--------|
| Credit facility, limit, stop-list, A–D, grant issue/consume, exposure math | **Finance** |
| Shipment / order confirm when `payment = on account` | **Satellite** (Wholesale first): call Finance `assertGrant` / consume grant |
| Buyer identity for the cabinet | **Orchestrator + MDM** (VÖEN / `globalId`); not a second counterparty DB |
| GL / NAS books | Unchanged; facility is **not** a second ledger |

Hotel city-ledger enforcement is **out of Phases 0–2** (not a Phase 2 deliverable). A later wave may reuse the same `TradeCreditFacility` for hotel agencies; that requires a **separate ADR** and must not mix wholesale buyer billing quota with hotel agency accounts in v1. Until then, hotel keeps `creditLimitAzn` on agency/profile per [hotel-city-ledger-and-fo-money.md](./hotel-city-ledger-and-fo-money.md).

### 3. Visibility (hard rule)

| Actor | Sees | Must not see |
|-------|------|----------------|
| Finance (OWNER / ADMIN / ACCOUNTANT) | Limit, debt, DPD, utilization, **A–D / А–Г**, grant journal, overrides | — |
| Sales / warehouse | Ship / no-ship, grant amount and expiry | Group letter, score, “won’t pay” copy |
| Buyer cabinet | Available residual, open AR, payment schedule, request/receive grant | A–D, score, any risk nickname (including “Silver partner” as a score mask) |

Sales **must not** mint grants from the order form. Issuer is **buyer cabinet** or **Finance UI**. Override of a block: finance roles only, audit trail required.

### 4. Groups A–D (internal; UI А–Г)

Heuristic on **own** AR/sales history (DPD, partial pay, turnover trend, limit utilization). Not a legal verdict; not bureau PD/LGD.

| Group | Meaning | Target policy |
|-------|---------|----------------|
| **A** / А | Willing and able | Live limit; grant within residual; later **auto-raise** (cap + audit; explicit org flag, not surprise) |
| **B** / Б | Willing, not able | Short limit; grant only if overdue is clear / after payment; no auto-raise |
| **C** / В | Able, not willing | Limit exists; stricter grant (TTL, amount, or finance confirm) |
| **D** / Г | Neither | **Auto-block:** limits 0, no grants, prepaid only |

Phase 0 may store a **manual** group or omit auto-classify. Phase 1 computes A–D in Finance UI only. Auto-D on overdue threshold is safer than auto-A.

### 5. Pickup grant

A grant is a first-class Finance entity (not a WhatsApp string):

| Field | Rule |
|-------|------|
| `organizationId`, `counterpartyId` | Tenant + buyer |
| `amount` | ≤ available residual at issue |
| `expiresAt` | Hours, not weeks; **default 24h** from issue (Phase 0). Phase 1 may shorten for group C (e.g. 8h) via org policy |
| `code` / QR payload | Un-guessable; bound to org + counterparty + amount |
| `status` | `ISSUED` → `CONSUMED` \| `EXPIRED` \| `VOID` |
| `consumedBy` / shipment or invoice ref | Set on successful satellite consume |

**Gate:** on-account shipment amount ≤ remaining grant (or issue+consume in one finance-authorized step). No grant / group D / limit 0 → on-account shipment refused (prepaid is a separate path).

Buyers who will not use the cabinet: finance issues the grant in ERP.

### 6. Exposure

```
available = max(0, creditLimit − openArExposure − unusedIssuedGrants)
```

Open AR = unpaid invoices / on-account shipments for that counterparty on the **default ops** book. Unused issued grants reserve residual so two codes cannot double-spend the limit.

`Counterparty.creditLimit` (or a child `TradeCreditFacility`) is Finance-owned. Wholesale `GET /api/credit-limit` becomes a live read (plus grant assert on confirm) — stub only when the SKU is off.

### 7. Buyer cabinet vs invoice guest portal

| | Invoice guest link (§4.4.1) | Trade credit cabinet |
|--|-----------------------------|----------------------|
| Auth | Unguessable token, no account | Authenticated buyer (VÖEN-bound), SKU-gated |
| Scope | One invoice | Limit, AR, grants |
| Route | `/portal/invoice/{token}` | Finance `/buyer/*` (web; PWA in Phase 2a) |
| Sales | N/A | Cannot see A–D |

Do not overload `/portal/invoice/{token}` into a credit workspace.

#### 7.1 Buyer portal identity (resolved; no separate identity ADR)

Reuse the **agency portal pattern** from [hotel-agency-portal.md](./hotel-agency-portal.md), adapted for wholesale B2B buyers — **not** staff `OrganizationMembership`, not hotel `AgencyPortalAccount`.

| Concern | Owner |
|---------|--------|
| Email/password, invite, VÖEN grant to counterparty | **Orchestrator** — `BuyerPortalAccount` + `BuyerOrgGrant` (Prisma model name; earlier drafts said `BuyerCounterpartyGrant`) |
| Counterparty SoR, limit, grants, exposure | **Finance** |
| SSO exchange → session cookie | **Finance** `POST /api/auth/buyer-sso/exchange` → `era_buyer_session` |

> **Naming note:** Prisma / Nest code uses `BuyerOrgGrant`. ADR prose historically said `BuyerCounterpartyGrant` — treat them as the same grant row (account × org × finance counterparty).

- Buyer is **not** an ERA `Organization`. Without counterparty VÖEN (or linked MDM legal entity), portal invite is refused.
- Buyer HMAC payload (distinct from owner/staff SSO and hotel agency SSO):

  `buyer|{email}|{organizationId}|{counterpartyId}|{expiresAt}` (+ jti / replay guard)

- Finance staff invite flow: accountant links grant → Orch sends invite → buyer sets password → SSO into `/buyer`.
- Do **not** map buyer SSO into Finance OWNER/ADMIN/ACCOUNTANT roles or wholesale sales roles.
- Mobile (Phase 2a) uses the **same** HMAC exchange and APIs; no second password DB.

### 8. Billing

**Reject:** fee per invoice, % of deferred amount, fee per internal score recalculation.

**Accept:**

| Component | Rule |
|-----------|------|
| Unlock SKU | `trade_credit_control` in orchestrator `pricing_modules`, `satelliteKey=finance_core`, list price **99 AZN/mo** (catalog palette [era-commercial-catalog.md](./era-commercial-catalog.md)) |
| Billed metric | **Managed trade-credit counterparties** in the Baku billing month |
| Count if any | Non-zero facility/limit enabled, **or** on-account shipment/invoice in the month, **or** open AR > 0 |
| Do not count | Suppliers/utilities, dormant (limit 0, AR 0, no deferred shipment for N days), portal login alone |
| Anti-carousel | Stable VÖEN / `taxIdBlindIndex`, not internal UUID churn |
| Included quota (Phase 0 default) | **50** managed counterparties per org on the unlock SKU; overage billed via meter |
| Overage unit price | ~**1 AZN / billed buyer / month** (meter `TRADE_CREDIT_BUYER` or catalog equivalent) |
| Overage behavior | **Soft:** do not block shipment or grant issue because of billing quota; notify owner; invoice overage on next cycle |
| Platform `TIER_0…3` | May override **included** quota defaults later; Phase 0 ships fixed **50** on the SKU, not a 1000 AZN pack |

Commercial draft (not catalog law): ~1000 AZN at 1000 active deferred buyers, implemented as **meter/packs** on top of the 99 AZN unlock — not a 1000 AZN list SKU that breaks 19/29/39/99. Confirm pack sizes against real deferred-buyer counts (often tens–low hundreds, not 1000).

**Billed-buyer snapshot (Phase 0):** nightly/EOD job counts distinct counterparties in the Baku billing month if **any** of: non-zero facility/limit, on-account shipment/invoice in month, open AR > 0. Dedup by `taxIdBlindIndex`. Exclude dormant (limit 0, AR 0, no deferred shipment **30 days**). Portal login alone does not count.

### 9. Phases

| Phase | In | Out |
|-------|----|-----|
| **0 — accountant lock** | Manual limit + stop-list; exposure; web `/buyer` cabinet + Orch buyer SSO; grant issue/consume (24h TTL); Wholesale guard; finance override + audit; SKU 99 AZN + **50 included** buyers + meter overage | Auto A–D, bureau, PWA/native mobile, acquiring, factoring, hotel CL |
| **1 — policy** | A–D in Finance UI only; classifier + [Appendix A](#appendix-a-phase-1-classifier-defaults); D → block limits and grants; A raise as **proposal**, auto-A behind org flag | Buyer-visible grades |
| **2 — optional (three tracks)** | See §9.1 | Hotel CL (separate ADR); native App Store/Play before PWA |
| **3 — working-capital limit** | Suggested limit from turnover×terms (proposal only); weighted DPD; ability without utilization; trial/restore/enrich haircut proposals; decision log | Auto-apply WC limit; buyer-visible score; PD/LGD |

#### 9.1 Phase 2 tracks (not one PR)

Phase 2 is **optional** and **split**. Tracks share the Phase 0 cabinet and facility; they must not leak А–Г to buyer/sales or bill per grant/invoice.

| Track | SKU / billing | Delivers | Depends on |
|-------|---------------|----------|------------|
| **2a — mobile cabinet** | Same `trade_credit_control` | **PWA / responsive** `/buyer` (QR grant, pull-to-refresh, notify opt-in — no А–Г). Native store apps only if demanded | Phase 0 — **eng landed** |
| **2b — registry enrichment** | Meter `TRADE_CREDIT_ENRICH` (~2 AZN/check) | Finance-only deep check (VÖEN / risky); optional policy auto-D | Phase 0 + 1 — **eng landed** |
| **2c — pay / factor** | Acquiring + SKU `trade_credit_factor_lead` | Pay open invoices via payment links; factoring = referral — [finance-trade-credit-factor-lead.md](./finance-trade-credit-factor-lead.md) | Phase 0 — **eng landed (no GL)** |

Recommended order: **2a → 2b → 2c**. Coverage ids: `FIN-TCC-02` (2a), `FIN-TCC-03` (2b), `FIN-TCC-04` (2c).

#### 9.2 Phase 3 — working-capital suggested limit

A–D remains the **discipline lock**. Phase 3 adds a **finance-only suggested limit** (`suggestTradeCreditLimit`) written as `proposedLimit` + `proposedKind` for accountant Accept/Reject (never silent auto except existing once-into-A raise when `autoRaiseEnabled`).

Formula and knobs: [Appendix B](#appendix-b-phase-3-working-capital-suggested-limit). Coverage id **FIN-TCC-05** = **API** until Lab RT.

Proposal priority: D block → RESTORE → TRIAL (thin) → ENRICH_HAIRCUT → WORKING_CAPITAL / A_RAISE. Buyer/Wholesale omit `suggestedLimit` / `proposedKind` / `policyGroup`.

### 10. Anti-goals

- Showing A–D (or score nicknames) to sales or buyers.  
- Bank PD/LGD, AKB, IFRS 9 ECL.  
- Sales-minted grants.  
- Replacing CRM / counterparty MDM.  
- Pay-per-document on this SKU.  
- Folding this work into a multi-book “finish GAAP” PR.  
- Auto-applying working-capital / trial / restore / enrich-haircut limits without Accept.  
- Buyer-visible “your limit improved” / score nicknames.

## Consequences

- Phase 0 schema (`TradeCreditFacility` + `TradeCreditGrant` + buyer meter snapshot) and Wholesale confirm consuming grants are **implemented** — scoring ML is still out.  
- **Phase 1 classifier** (Appendix A, amended by Phase 3): org policy, pin A–D, auto-D block / optional auto-raise A proposal, staff-only А–Г UI, `GET /trade-credit/facilities`, nightly reclassify. Buyer and Wholesale outbound shapes **must not** include `policyGroup` (leak specs).  
- **Phase 3** stores `suggestedLimit` / `proposedKind` and `TradeCreditLimitDecision` for Accept/Reject feedback (+30d DPD follow-up). No ML auto-tune.  
- Buyer identity follows §7.1 (`BuyerPortalAccount` + HMAC); no separate identity ADR required unless hotel agency and wholesale buyer accounts are merged (forbidden without a new ADR).  
- Coverage ids **FIN-TCC-01..05** = **API** until Lab RT. No Pilot / `ga` from this ADR.  
- AC-FIN-TCC Scaffold 🟡 until Lab RT; negatives land in classifier/limit/policy/leak specs + wholesale confirm specs.  
- Phase 1 classifier recalc and Phase 3 suggest recalc are **not** billable meter events.

## Appendix A: Phase 1 classifier defaults

Heuristic on **own** AR/sales history only — not a legal verdict, not bureau PD/LGD. Thresholds are org-tunable; these are Phase 1 **defaults**.

### Features (default ops book)

| Feature | Definition |
|---------|------------|
| `maxDpd` / `avgDpd` | Open AR due dates vs today (UTC) |
| `overdueShare` | Overdue AR / open AR |
| `partialPayRatio` | Partial settlements vs full, 12-month lookback |
| `turnoverTrend` | Recognized sales last 90d vs previous 90d |
| `utilization` | openAr / creditLimit (1 if limit 0) |

Insufficient history (e.g. **< 3 paid invoices**): leave group **null**; no auto-D or auto-A; accountant may pin manually.

### Willingness / ability signals

| Signal | Default rule |
|--------|----------------|
| Willingness **high** | `weightedAvgDpd ≤ 7` (fallback `avgDpd`) and `overdueShare < 0.15`; `partialPayRatio < 0.5` |
| Willingness **low** | `maxDpd ≥ 30` or `overdueShare ≥ 0.4` |
| Ability **high** | Seasonal turnover (YoY same-90d when available, else dual 90d) not falling > 25% |
| Ability **low** | Seasonal turnover down > 25% |

Utilization is **not** an ability signal (Phase 3): high util with clean overdue → `utilization_raise_alert` only.

Map high/high → **A**, high/low → **B**, low/high → **C**, low/low → **D** (see §4 matrix).

**Hard rule:** `maxDpd ≥ autoDMaxDpd` → **D** regardless of other scores. Default `autoDMaxDpd` = **90**.

### Org policy defaults (Phase 1)

| Setting | Default |
|---------|---------|
| `autoRaiseEnabled` | **false** |
| `autoRaisePct` | 20% |
| `autoRaiseCapAzn` | Required when auto-raise enabled (no unbounded raise) |
| Auto-raise cadence | **Once per transition into A** (nightly does not compound while already A) |
| Group **C** grant TTL | 8h (vs 24h for A/B) or finance confirm on issue (org choice) |
| `partialPayRatio` | Phase 3: haircut on suggested + blocks willingness_high at ≥0.5 |

Phase 2b enrichment may add optional modifiers (`riskyTaxpayer`, `voenInactive`); default **informational only** — auto-D remains DPD-threshold unless org policy explicitly enables bureau-driven block. Stale enrich (default TTL **90d**) is treated as unknown.

## Appendix B: Phase 3 working-capital suggested limit

Pure function `suggestTradeCreditLimit` (no Nest/Prisma). Staff-only.

**Raw:** `k × (recognizedLast90 × 30/90) × (termsDays/30) × (1 − overdueShare)`  
`termsDays` = counterparty `paymentTermsDays` or **30**.

**Modifiers (defaults):** group A 1.0 / B 0.5 / C 0.3 / D 0; thin → trial path; partial ≥0.3 → ×0.8; concentration ≥0.8 → ×0.7; fresh enrich risky/inactive → ×0.5 (skipped if force-D).

`suggested = clamp(round(raw × modifiers), floor, cap)`. Cap = `suggestedCapAzn` else `autoRaiseCapAzn` else uncapped. Deadband 5% vs current → no proposal.

**Trial (thin):** `min(trialLimitAzn=500, last recognized invoice)` (missing last → 0). Kind `TRIAL`.

**Grant TTL:** `partialPayRatio ≥ partialPayThreshold` tightens TTL to `grantTtlHoursC` (not a hard D).

**Classifier:** `weightedAvgDpd` including **0** (do not fall back to unweighted `avgDpd` when the book is current). Enrich haircut proposal outranks A-raise % / auto bump.

**Kinds:** `WORKING_CAPITAL` | `TRIAL` | `RESTORE` | `ENRICH_HAIRCUT` | `A_RAISE`. Feedback: `TradeCreditLimitDecision` + 30d DPD follow-up. No ML.

## References

- [era-architecture-boundaries](../CONTROL_PLANE_ARCHITECTURE.md) — control plane vs Finance vs satellites  
- [mdm-legal-entity-vs-finance-counterparty-registry.md](./mdm-legal-entity-vs-finance-counterparty-registry.md)  
- [era-commercial-catalog.md](./era-commercial-catalog.md)  
- [hotel-agency-portal.md](./hotel-agency-portal.md) — identity pattern for §7.1  
- Wholesale module map: `era-wholesale/.cursor/rules/era-wholesale-module-map.mdc`  
