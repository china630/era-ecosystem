# Bank BE/API roadmap (Lite → Deep-1 → Deep-2)

**SSOT companion to:** [Bank-Capability-Inventory.md](./Bank-Capability-Inventory.md)  
**AC rows:** [Bank-Implementation-Matrix.md](./Bank-Implementation-Matrix.md)  
**Engine:** `era-bank-core`  
**Superseded narrative:** Deep-2 closed lab. Continuing product depth: [Bank-Full-CBS-Roadmap.md](./Bank-Full-CBS-Roadmap.md). Live partner UAT = YC-E*.

| Wave | Meaning |
|------|---------|
| **Lite** | Schema + Nest surface + AuthZ + smoke tests; money may be deferred if documented |
| **Deep-1** | State machines + balanced `PostingEngine` + SoD where required |
| **Deep-2** | EOD steps, mode-flagged adapters, Inventory → IN (lab) |

Legend: `[x]` done · `[~]` partial · `[ ]` pending · `—` N/A (stays OUT/BLOCKED)

---

## Tracking by CAP

| CAP ID | Lite | Deep-1 | Deep-2 | Notes |
|--------|------|--------|--------|-------|
| CAP-CORE-FEE | [x] | [x] | [x] | FeeTariff + assess post |
| CAP-CORE-SDB | [x] | [x] | [x] | SafeDepositBox + EOD rent step |
| CAP-CORE-RELPRICE | [x] | [x] | [x] | Package link CRUD |
| CAP-OPS-CASH | [x] | [x] | [x] | CashMovement posting |
| CAP-OPS-INV | [x] | [x] | [x] | Optional GL post on move |
| CAP-OPS-Q | [x] | [x] | [x] | Assign/serve + CRM notes |
| CAP-DEP-ADIF | [x] | [x] | [x] | Export draft + EOD snapshot |
| CAP-DEP-STRUCT | [x] | [x] | [x] | indexLinkKey contract fields |
| CAP-DEP-CALL | [x] | [x] | [x] | callNoticeDays |
| CAP-LN-COLL | [x] | [x] | [x] | Valuation + lien |
| CAP-LN-SCORE | [x] | [x] | [x] | CreditPolicyRule + score API |
| CAP-LN-APPWF | [x] | [x] | [x] | LoanApplication SoD book |
| CAP-LN-LINE | [x] | [x] | [x] | CreditLine drawdown post |
| CAP-LN-MTG/LEASE/FACT/MFI/… | [x] | [x] | [x] | Kind-specific originate validation |
| CAP-LN-COLLX | [x] | [x] | [x] | banking_collections |
| CAP-LN-FORB | [x] | [x] | [x] | ForbearanceStage enum + routes |
| CAP-PAY-SO | [x] | [x] | [x] | StandingOrder + EOD run |
| CAP-PAY-CM | [x] | [x] | [x] | Sweep rules |
| CAP-PAY-VA | [x] | [x] | [x] | VirtualAccount |
| CAP-PAY-CHQ | [x] | [x] | [x] | Cheque clear/bounce |
| CAP-PAY-RAIL/ISO | [x] | [x] | [x] | Interfaces + BANK_RAIL_MODE (live YC-E1) |
| CAP-CARD-3DS | [x] | [x] | [x] | Threshold gate + dispute workflow |
| CAP-CARD-ATM/SCHEME | — | — | — | OUT |
| CAP-TF-* | [x] | [x] | [x] | banking_trade |
| CAP-TR-DRV | — | — | — | OUT contract-only |
| CAP-TR-CUST / WB | [x] | [x] | [x] | Ledger + insurance product |
| CAP-AML-CASE/RTF | [x] | [x] | [x] | Case + fraud score hook |
| CAP-AML-FEED | — | — | — | BLOCKED |
| CAP-RSK-MKT/OR | [x] | [x] | [x] | Gap + capital add-on endpoints |
| CAP-RSK-CERT | — | — | — | OUT |
| CAP-REG-CBAR | [x] | [x] | [x] | Template generate (submit stub) |
| CAP-DBO-H2H/OB | [x] | [x] | [x] | H2H + consent |
| CAP-ISL | [x] | [x] | [x] | banking_islamic |
| CAP-INS | [x] | [x] | [x] | Product + policy link |
| CAP-PEN/PSA | — | — | — | OUT |
| CAP-NFR-MIS/BPM/DMS | — | — | — | OUT |

---

## Wave signoffs

| Wave | Artifact |
|------|----------|
| Lite | [`era-bank-core/doc/reports/be-lite-signoff.md`](../../era-bank-core/doc/reports/be-lite-signoff.md) |
| Deep-1 | [`era-bank-core/doc/reports/be-deep1-signoff.md`](../../era-bank-core/doc/reports/be-deep1-signoff.md) |
| Deep-2 | [`era-bank-core/doc/reports/be-deep2-signoff.md`](../../era-bank-core/doc/reports/be-deep2-signoff.md) |
| FC-2…FC-7 | [`era-bank-core/doc/reports/fc2-fc7-signoff.md`](../../era-bank-core/doc/reports/fc2-fc7-signoff.md) |
