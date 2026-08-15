# Bank — Full commercial CBS roadmap

**Product envelope:** Full commercial Core Banking System for Azerbaijan (CBAR/AMB), not mid-size-lab-only.  
**Target:** PARTIAL→IN product depth; former OUT→DECLARED→IN by waves; YC-E live → Pilot field → `pilot_ready: true`.  
**Companions:** [Bank-Capability-Inventory.md](./Bank-Capability-Inventory.md) · [Bank-BE-Roadmap.md](./Bank-BE-Roadmap.md) · [CERTIFICATION-TRACK.md](../../era-bank/doc/CERTIFICATION-TRACK.md)

**Legend:** `[ ]` pending · `[~]` in progress · `[x]` done (lab product depth) · `⏸` partner/field gated

---

## Phase 0 — Canon

| Item | Status |
|------|--------|
| Remove mid-size framing; Full commercial CBS in PRD/ADR/Inventory | [x] |
| Former OUT → DECLARED with wave IDs | [x] |
| Editions stay `mvp` / `pilot_ready: false` until E7 | [x] |

---

## Phase 1 — PARTIAL → IN (FC waves)

| Wave | CAP focus | Status |
|------|-----------|--------|
| FC-1 | HOLD, OD, FX reval, BR/МФР, RELPRICE | [x] |
| FC-2 | STRUCT/CALL deposits; LN-SCORE; FORB; product packs MTG/LEASE/FACT/MFI/SYND/PF | [x] |
| FC-3 | Cards ISS/ACQ/3DS product depth (mock until E2) | [x] |
| FC-4 | Treasury BASIC/MM; CORR; TF-TL/SCF/SWIFT depth | [x] |
| FC-5 | AML RULE/SCR/RTF/PEP/ML; FATCA/LEX; IRRBB/OR | [x] |
| FC-6 | Custody/CSD prep; INS; OPS-Q CRM; OB AIS/PIS | [x] |
| FC-7 | BE `[~]` closeout (INV, score UI, forbearance stages, insurance) | [x] |

**IN definition:** engine state machines + PostingEngine/SoD + ops UI (+ DBO if customer) + UAT/TE + Inventory IN + matrices.

---

## Phase 2 — Former OUT → IN (XO waves)

| Wave | CAP | Status | Module key (target) |
|------|-----|--------|---------------------|
| XO-1 | CARD-ATM, CARD-SCHEME | [x] | `banking_cards` + ATM adapter |
| XO-2 | TR-DRV, TR-BOND, markets FO | [x] | `banking_markets` |
| XO-3 | TR-AM, TR-BRK, TR-METAL, CSD | [x] | `banking_wealth` / `banking_markets` |
| XO-4 | DBO-PFM | [x] | `era-bank-dbo` PFM |
| XO-5 | PEN, PSA | [x] | `banking_pension`, `banking_psa` |
| XO-6 | CORE-MENT, CORE-AGENCY | [x] | ADR D5 optional flag |
| XO-7 | NFR-MIS, BPM, DMS | [x] | platform-extras metadata |
| XO-8 | RSK-CERT | [~] | pack ready; CAP stays DECLARED until YC-E4 |

---

## Phase 3 — Field (YC-E)

| Wave | Outcome | Status |
|------|---------|--------|
| YC-E1…E6 | Live adapters + staging evidence | ⏸ partner creds; mode flags + contract tests shipped |
| YC-E7 | Pilot field → `pilot_ready: true` | ⏸ |

Without sandbox credentials: ship mode-flagged adapters (`BANK_*_MODE=live|stub`) and contract tests only — do not claim live IN.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-06 | Phase 0 canon: mid-size retired; Full commercial CBS |
| 2026-08-06 | FC-1 core PARTIAL→IN (holds/OD/FX/BR/RELPRICE) |
| 2026-08-06 | FC-2…FC-7 lab product depth (engine + ops routes + fc2-fc7.spec.ts) |
| 2026-08-06 | XO-1…8 scaffolds + YC-E mode adapters; pilot_ready remains false |
