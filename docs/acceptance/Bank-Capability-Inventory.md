# Bank — Capability Inventory (scope boundary SSOT)

**Purpose:** answer «what does ERA Bank claim vs a full commercial CBS?»  
**Not** Product Readiness (sell/show) and **not** Implementation-Matrix (AC Scaffold).  
**Product line:** Bank (`era-bank-core` + `era-bank`) + channel Bank DBO (`era-bank-dbo`).  
**Canon links:** [Bank-Acceptance-System](./Bank-Acceptance-System.md) · [Bank-Product-Readiness-Matrix](./Bank-Product-Readiness-Matrix.md) · [PRD](../../era-bank-core/PRD.md) · [MODULES_CATALOG](../MODULES_CATALOG.md) § Banking · [CERTIFICATION-TRACK](../../era-bank/doc/CERTIFICATION-TRACK.md)

**Audience product:** Full commercial universal/retail CBS for Azerbaijan (CBAR/AMB).  
**Benchmark families:** Temenos Transact / Enterprise, Oracle FLEXCUBE Universal, typical CIS ABS (ЦФТ / Diasoft-class module maps) — used as **capability taxonomy**, not as feature parity claim.

---

## 0. How to read this document

| Status | Meaning |
|--------|---------|
| **IN** | In product edition scope and present in lab/mvp (may still be stub/lab methodology) |
| **PARTIAL** | Narrow MVP / skeleton; not enterprise depth |
| **DECLARED** | In PRD/TZ/modules, but live/cert/partner path open (often YC-E*) |
| **OUT** | Retired for Full CBS program — use DECLARED with wave ID (XO-*) instead |
| **BLOCKED** | External dependency / policy (e.g. sanctions feed) |

**Honesty rules**

1. Product-Readiness / AC «all in-scope ✅» ≠ «full commercial bank».  
2. Missing row here was historically invisible — **absence ≠ done**.  
3. Changing a row OUT → DECLARED/IN requires PRD/TZ + module key + Acceptance AC (same change).  
4. Edition `ga` / `pilot_ready: true` only after Pilot field + applicable YC-E for live claims ([editions/bank.yaml](../editions/bank.yaml)).

**Product envelope:** Full commercial AZ CBS — PRD §4 modules + L2 trade/collections/cash/islamic/wealth/risk + roadmap waves for former OUT (ATM, markets FO, CSD, PFM, PEN/PSA, multi-entity, MIS/BPM/DMS). Trackers: [Bank-Full-CBS-Roadmap.md](./Bank-Full-CBS-Roadmap.md) · [Bank-BE-Roadmap.md](./Bank-BE-Roadmap.md).

---

## 1. Core / CIF / accounts / GL

| ID | Capability | Status | Notes |
|----|------------|--------|-------|
| CAP-CORE-GL | Banking GL, CBAR COA, double-entry | IN | Kernel L1 |
| CAP-CORE-POST | Posting engine, SoD, reverse, idempotency | IN | HMAC + EOD 423 (YC-A1) |
| CAP-CORE-CIF | CIF retail/corporate via MDM | PARTIAL | Live MDM resolve DECLARED (P1) |
| CAP-CORE-CASA | Current/demand accounts, IBAN | IN | |
| CAP-CORE-HOLD | Holds / arrests / liens | IN | FC-1 product depth |
| CAP-CORE-OD | Overdraft / account limits | IN | FC-1 product depth |
| CAP-CORE-FX | Multi-currency / FX revaluation | IN | FC-1 product depth |
| CAP-CORE-EOD | EOD / EOM / calendar | IN | Lab; HA cert YC-E6 |
| CAP-CORE-PF | Product Factory (params/bands/day-count/FLOATING) | IN | |
| CAP-CORE-BR | Multi-branch / МФР | IN | FC-1 product depth |
| CAP-CORE-MENT | Multi-entity holding / many legal banks one install | IN | XO-6 lab; `BANK_MULTI_ENTITY=1`; ADR |
| CAP-CORE-AGENCY | Agency / shared services banking | IN | XO-6 AgencyLink API (lab) |
| CAP-CORE-SDB | Safe deposit box | IN | Fee module SDB + EOD rent count |
| CAP-CORE-RELPRICE | Relationship / package pricing enterprise | IN | FC-1 product depth |
| CAP-CORE-FEE | Enterprise fee/tariff engine | IN | FeeTariff + assess post (lab) |

---

## 2. Deposits

| ID | Capability | Status | Notes |
|----|------------|--------|-------|
| CAP-DEP-TERM | Term/savings, accrual, rollover, early close | IN | EOD accrual |
| CAP-DEP-ADIF | ADİF tagging / reporting | IN | EOD adifSnapshot + tagged contracts |
| CAP-DEP-STRUCT | Structured / index-linked / dual-currency deposits | IN | FC-2 indexLinkKey + contract fields |
| CAP-DEP-CALL | Advanced corporate call / brokered deposits | IN | FC-2 callNoticeDays + notice semantics |

---

## 3. Lending / credit factory

| ID | Capability | Status | Notes |
|----|------------|--------|-------|
| CAP-LN-ORIGIN | Originate / schedule / disburse / repay | IN | Repay-by-schedule |
| CAP-LN-COLL | Collateral + NPL/DPD/stage | IN | Valuation + lien register |
| CAP-LN-AKB | Live AKB / credit registry | DECLARED | Stub default; live flag YC-E4 |
| CAP-LN-EMDK | ƏMDK deep integration | DECLARED | Thin today |
| CAP-LN-ECL | IFRS 9 ECL **certified** | DECLARED | Lab only (`methodology=lab`) until YC-E4 |
| CAP-LN-SCORE | Credit decision / policy rules engine | IN | CreditPolicyRule + bureau score merge |
| CAP-LN-APPWF | Full application workflow (retail/SME/corp) | IN | LoanApplication SoD book |
| CAP-LN-LINE | Credit lines / revolvers / multi-draw | IN | CreditLine drawdown post |
| CAP-LN-SYND | Syndicated / club loans | IN | participationPct / leadBank on line + loan |
| CAP-LN-PF | Project / construction drawdown finance | IN | projectRef on LOAN_PROJECT |
| CAP-LN-MTG | Full mortgage + LTV/LTI suite | IN | collateralFlag + collateral on originate |
| CAP-LN-LEASE | Leasing / hire-purchase | IN | assetRef required |
| CAP-LN-FACT | Factoring / invoice finance | IN | invoiceRef required |
| CAP-LN-MFI | Microfinance / group lending | IN | ProductKind LOAN_MFI params |
| CAP-LN-COLLX | Collections / recovery / legal workout factory | IN | banking_collections |
| CAP-LN-FORB | Forbearance / restructuring suite | IN | ForbearanceStage enum + transitions |
| CAP-LN-BG | Financial guarantees as loan product | PARTIAL | Via banking_trade BG |

---

## 4. Payments / clearing / cash management

| ID | Capability | Status | Notes |
|----|------------|--------|-------|
| CAP-PAY-INT | Internal transfer / staff payment SoD | IN | |
| CAP-PAY-RAIL | AZIPS / XÖHKS / AÖS / SWIFT **live** | DECLARED | Stub → YC-E1 |
| CAP-PAY-ISO | ISO 20022 ops depth | DECLARED | |
| CAP-PAY-SO | Standing orders / direct debit / mass payroll | IN | StandingOrder + DD mandate; EOD runDue |
| CAP-PAY-CM | Corporate cash mgmt / pooling / sweeping | IN | Sweep rules + post |
| CAP-PAY-VA | Virtual accounts / escrow | IN | VirtualAccount API |
| CAP-PAY-CHQ | Cheque / bill clearing | IN | Clear/bounce posts |
| CAP-PAY-CORR | Correspondent banking deep ops | IN | Nostro statement/reconcile + corr payment post |
| CAP-PAY-RTP | Instant / request-to-pay overlays | DECLARED | AÖS path |

---

## 5. Cards / acquiring / cash channels

| ID | Capability | Status | Notes |
|----|------------|--------|-------|
| CAP-CARD-ISS | Issue / block / limits | IN | Mock gateway + product limits |
| CAP-CARD-LIVE | Issuer auth/clearing live | DECLARED | YC-E2 |
| CAP-CARD-ACQ | Acquiring / merchant / POS / e-com | IN | AcquiringMerchant + merchant auth |
| CAP-CARD-ATM | ATM switch / own ATM network | IN | XO-1 lab scaffold; scheme outbox |
| CAP-CARD-SCHEME | In-house card scheme | IN | XO-1 lab adapter |
| CAP-CARD-3DS | 3DS / token / chargeback disputes | IN | Threshold gate + dispute transitions |

---

## 6. Trade finance

| ID | Capability | Status | Notes |
|----|------------|--------|-------|
| CAP-TF-LC | Letters of credit (import/export) | IN | banking_trade lab |
| CAP-TF-BG | Bank guarantees / SBLC | IN | |
| CAP-TF-DC | Documentary collections | IN | |
| CAP-TF-TL | Trade loans / packing credit | IN | LOAN_TRADE + packing credit register |
| CAP-TF-SCF | Supply-chain finance | IN | ScfProgram activate/fund lifecycle |
| CAP-TF-SWIFT | Trade SWIFT message set (MT7xx etc.) | IN | Outbox SENT_STUB + MT type catalog |

---

## 7. Treasury / markets / custody / wealth

| ID | Capability | Status | Notes |
|----|------------|--------|-------|
| CAP-TR-BASIC | FX deals, interbank, GS, GAP | IN | FX + interbank + gap snapshot |
| CAP-TR-LCR | LCR/NSFR/RWA/CAR lab | IN | Risk module; not certified |
| CAP-TR-MM | Full money-market book | IN | MoneyMarketPlacement book + post |
| CAP-TR-DRV | Derivatives (IRS, FX options, …) | IN | XO-2 `banking_markets` lab |
| CAP-TR-BOND | Bond FO / AM trading | IN | XO-2 lab |
| CAP-TR-CUST | Custody / safekeeping / CSD | IN | CustodyPositionLedger + CsdAccount API |
| CAP-TR-AM | Asset management / funds | IN | XO-3 brokerage/metal scaffolds (lab) |
| CAP-TR-BRK | Brokerage / securities settlement | IN | XO-3 lab |
| CAP-TR-METAL | Precious metals | IN | XO-3 lab |
| CAP-WB-PB | Private banking / wealth / trust | IN | Safekeeping + insurance product link |

---

## 8. AML / fraud / financial crime

| ID | Capability | Status | Notes |
|----|------------|--------|-------|
| CAP-AML-RULE | Rules alerts + FMN export | IN | Rules + batch screen API |
| CAP-AML-SCR | Screening (seed lists) | IN | POST /aml/screen/batch |
| CAP-AML-FEED | Live OFAC/EU/UN ingest | BLOCKED | BANK-SANC-LIVE; hub |
| CAP-AML-RTF | Real-time fraud (card/pay scoring, mule, device) | IN | deviceId/muleSuspect + payment submit hook |
| CAP-AML-CASE | Enterprise case / SAR lifecycle | IN | AmlCase transitions + sarDraftFields |
| CAP-AML-PEP | PEP / adverse media deep | IN | pepFlag ops update + mlScore rules stub |
| CAP-AML-ML | ML transaction monitoring | IN | mlScorePlaceholder rules computation |

---

## 9. Risk / regulatory reporting

| ID | Capability | Status | Notes |
|----|------------|--------|-------|
| CAP-RSK-ECLLAB | ECL STAGE_FLAT/PD_LGD + provision SoD | IN | methodology=lab |
| CAP-RSK-CAPUI | Capital / LCR UI | IN | `/risk/capital` |
| CAP-RSK-CERT | Certified Basel/IFRS9 / ICAAP / stress | DECLARED | XO-8 pack ready (lab); YC-E4 for certified |
| CAP-RSK-MKT | Market risk / IRRBB full | IN | IRRBB gap report from inputs |
| CAP-RSK-OR | Operational risk | IN | OpRisk capital add-on stub |
| CAP-REG-CBAR | CBAR prudential **live submit** | DECLARED | Stubs → YC-E5 |
| CAP-REG-FATCA | FATCA/CRS deep ops | IN | Classification workflow + report |
| CAP-REG-LEX | Large exposures enterprise | IN | POST /reports/large-exposures/generate |

---

## 10. Digital channels / Open API

| ID | Capability | Status | Notes |
|----|------------|--------|-------|
| CAP-DBO-UI | Retail/corp DBO + dual-sign | IN | Lab |
| CAP-DBO-ASAN | ASAN/SİMA **live** | DECLARED | Stub → YC-E3 |
| CAP-DBO-OB | Open Banking AIS/PIS suite | IN | AIS `/dbo/open/accounts` + PIS orders (lab) |
| CAP-DBO-PFM | PFM / chat / voice banking | IN | XO-4 DBO `/pfm` stub BFF (lab) |
| CAP-DBO-H2H | Corporate H2H file exchange | IN | DboH2hFileJob |

---

## 11. Branch ops / inventory

| ID | Capability | Status | Notes |
|----|------------|--------|-------|
| CAP-OPS-TELLER | Teller / ops modal UI | IN | |
| CAP-OPS-CASH | Cash desk / vault / CIT | IN | banking_cash posting |
| CAP-OPS-INV | Inventory (blanks, card stock, chequebooks) | IN | Optional GL post on inventory move |
| CAP-OPS-Q | Branch queue / branch CRM | IN | Assign/serve + CRM notes JSON |

---

## 12. Specialized lines

| ID | Capability | Status | Notes |
|----|------------|--------|-------|
| CAP-ISL | Islamic banking window | IN | banking_islamic lab |
| CAP-INS | Bancassurance deep | IN | InsuranceProduct + policy link + commission |
| CAP-PEN | Pension / social agency | IN | XO-5 `banking_pension` lab |
| CAP-PSA | Public sector TSA | IN | XO-5 `banking_psa` lab |

---

## 13. Platform / NFR / certification

| ID | Capability | Status | Notes |
|----|------------|--------|-------|
| CAP-NFR-HA | HA EOD / DR / pentest | DECLARED | YC-E6 |
| CAP-NFR-ONP | On-prem ref-data / air-gap | PARTIAL | |
| CAP-NFR-MIS | Full MIS / data mart / BI | IN | XO-7 metadata stub (lab) |
| CAP-NFR-BPM | Enterprise BPM | IN | XO-7 process stub (lab) |
| CAP-NFR-DMS | Document management / e-archive | IN | XO-7 document meta stub (lab) |
| CAP-NFR-FIELD | Pilot **field** + `pilot_ready` | DECLARED | YC-E7 |

---

## 14. Rollup (honest)

| Bucket | Count (approx.) | Implication |
|--------|-----------------|-------------|
| IN + PARTIAL | Full commercial CBS in progress | Sell as **mvp** until PARTIAL cleared + Pilot field; program [Bank-Full-CBS-Roadmap](./Bank-Full-CBS-Roadmap.md) |
| DECLARED | Partner/regulator live paths | YC-E1…E7; no false SHIPPED |
| DECLARED (ex-OUT) + BLOCKED | Full CBS backlog + external feeds | DECLARED = on roadmap; BLOCKED = partner/policy |

**Forbidden sell phrases:** «GA», «certified IFRS 9 / Basel», «live rails» — while `pilot_ready: false` / Pilot field open / CAP DECLARED without wave evidence. Full commercial CBS is the **target envelope**, not a claim of completion.

---

## 15. Changelog

| Date | Change |
|------|--------|
| 2026-08-06 | FC-2…FC-7 PARTIAL→IN (see fc2-fc7-signoff) |

| 2026-08-06 | XO-1…7 IN (lab); YC-E adapter scaffolds; CAP-RSK-CERT pack ready, stays DECLARED |
