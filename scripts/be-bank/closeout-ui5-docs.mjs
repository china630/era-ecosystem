import fs from "fs";
import path from "path";

const root = "d:/My Projects/era-ecosystem";
const w = (rel, c) => {
  const p = path.join(root, rel);
  fs.writeFileSync(p, c.replace(/\r?\n/g, "\n"), "utf8");
  console.log("wrote", rel);
};
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const patch = (rel, find, rep) => {
  const s = read(rel);
  if (!s.includes(find)) {
    if (s.includes(rep.slice(0, Math.min(40, rep.length)))) {
      console.log("skip", rel);
      return;
    }
    throw new Error(`miss ${rel}: ${find.slice(0, 60)}`);
  }
  w(rel, s.replace(find, rep));
};

// Product readiness Bank
w(
  "docs/acceptance/Bank-Product-Readiness-Matrix.md",
  `# Bank — Product Readiness Matrix (one screen)

**Canon:** [\`ERA-Acceptance-Standard.md\`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / pilot / sell?» for the **declared** Bank edition **and** each \`banking_*\` module.  
**Not the same as** [\`Bank-Implementation-Matrix.md\`](./Bank-Implementation-Matrix.md) (= Scaffold BE / AC only).  
**Not** [\`READINESS_MATRIX.md\`](../READINESS_MATRIX.md) (engineering API/DELIVERY %).  
**Not** [\`Bank-Capability-Inventory.md\`](./Bank-Capability-Inventory.md) (IN/PARTIAL/OUT scope boundary — use when asked «чего нет в АБС»).  
**BE waves:** [\`Bank-BE-Roadmap.md\`](./Bank-BE-Roadmap.md).

**Sources:** Sprint-Index · Implementation-Matrix · Capability Inventory · UAT-SMOKE · COVERAGE · Pilot · [\`docs/editions/bank.yaml\`](../editions/bank.yaml)

**Legend:** ✅ · 🟡 · ❌/\`[ ]\` · ⏸ external · \`n/a\`  
**Row rollup** = worst(Gate, Scaffold BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.  
**Line rollup** = worst across **all** module rows in § Modules × layers.

---

## Line summary (SSOT readiness)

| Edition | Gate | Scaffold BE | UI | Demo / TE | Pilot lab | Pilot field | Edition | Sell / show |
|---------|------|-------------|----|-----------|-----------|-------------|---------|-------------|
| **Bank** | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | \`mvp\` (\`pilot_ready: false\`) | **Lab-pilot mid-size CBS** (ops UI envelope + selective DBO). ≠ ga; YC-E live ⏸; not full ABS |

Channel line: [\`Bank-DBO-Product-Readiness-Matrix.md\`](./Bank-DBO-Product-Readiness-Matrix.md).

---

## Modules × layers (SSOT)

Same columns as the line. Use **this** table when asking readiness of a module — not Inventory IN/OUT and not AC alone.

| Module | Gate | Scaffold BE | UI | Demo / TE | Pilot lab | Pilot field | Edition | Sell / show |
|--------|------|-------------|----|-----------|-----------|-------------|---------|-------------|
| \`banking_core\` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | \`mvp\` | lab-pilot ops / kernel |
| \`banking_deposits\` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | \`mvp\` | lab-pilot |
| \`banking_loans\` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | \`mvp\` | lab-pilot; AKB/ECL **live/cert** ⏸ |
| \`banking_payments\` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | \`mvp\` | lab-pilot; rails **live** ⏸ |
| \`banking_cards\` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | \`mvp\` | lab-pilot; gateway mock → YC-E2 |
| \`banking_aml\` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | \`mvp\` | lab-pilot; sanctions feed BLOCKED |
| \`banking_treasury\` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | \`mvp\` | lab-pilot; not markets FO |
| \`banking_regreporting\` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | \`mvp\` | lab-pilot; CBAR submit ⏸ |
| \`banking_risk\` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | \`mvp\` | lab-pilot; **methodology=lab**, not certified |
| \`banking_dbo\` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | \`mvp\` | see DBO Product-Readiness (channel) |
| \`banking_trade\` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | \`mvp\` | lab-pilot ops; SWIFT **stub** (not live) |
| \`banking_collections\` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | \`mvp\` | lab-pilot ops SoD |
| \`banking_cash\` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | \`mvp\` | lab-pilot cash desk / fees+SDB |
| \`banking_islamic\` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | \`mvp\` | lab-pilot ops; DBO read-only thin |
| \`banking_wealth\` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | \`mvp\` | lab-pilot thin custody; no FO/CSD |

**How to read**

- Scaffold BE ✅ comes from Implementation-Matrix AC for that surface (with negative path).  
- UI ✅ = ops/DBO screens in UAT-SMOKE / TE pack for that module.  
- Demo / TE and Pilot lab use Bank TE + Pilot lab signoffs (full envelope after UI waves).  
- Pilot field and edition \`ga\` / \`pilot_ready\` stay closed until YC-E7 (+ applicable live YC-E*).

---

## UI (short)

| Surface | Path | Level |
|---------|------|-------|
| Teller / ops | \`era-bank\` ops | ✅ lab |
| Product Factory | \`/admin/product-factory\` | ✅ lab |
| Risk capital / ECL | \`/risk/capital\`, \`/risk/ecl\` | ✅ lab (\`methodology=lab\`) |
| Cash / fees / SDB | \`/cash\`, \`/fees\` | ✅ lab |
| Payments tails | \`/payments/extras\` | ✅ lab |
| Collections | \`/collections\` | ✅ lab |
| Trade | \`/trade\` | ✅ lab (SWIFT stub) |
| Islamic / wealth | \`/islamic\`, \`/wealth\` | ✅ lab |
| AML cases / card disputes / 3DS ops | \`/aml/cases\`, \`/cards/disputes\`, \`/cards/3ds\` | ✅ lab |
| Loans deep | \`/loans/applications\`, \`/loans/credit-lines\` | ✅ lab |

**Having routes ≠ UI ready for sell** — sell/show remains lab-pilot mid-size CBS until field/YC-E.

---

## Not in this edition (must disclose)

Do **not** claim coverage for CAP-* **OUT** / **BLOCKED** in [\`Bank-Capability-Inventory.md\`](./Bank-Capability-Inventory.md):

| Area | Examples |
|------|----------|
| Markets FO | Derivatives FO, bond FO, full AM/brokerage/CSD |
| Channels | Own ATM switch / in-house card scheme; PFM |
| Specialized | Pension/social agency; public-sector TSA |
| Platform extras | Multi-entity holding CBS; enterprise MIS/BPM/DMS; live sanctions feed (BLOCKED) |
| Certification | Certified Basel/IFRS9 / ICAAP (CAP-RSK-CERT) |
| Live rails / SWIFT | STUB / SENT_STUB — YC-E track |

**DECLARED live (not ga):** rails, cards gateway, ASAN, AKB+certified ECL, FMN/CBAR, pentest/HA, Pilot field — [CERTIFICATION-TRACK](../../era-bank/doc/CERTIFICATION-TRACK.md).

---

## Pilot / field

| Item | Status | Evidence |
|------|--------|----------|
| Lab RT (UAT-SMOKE) — **ops-backed subset** | [x] kit | \`reports/bank-pilot-lab-signoff.md\` + \`era-bank/doc/UAT-SMOKE.md\` |
| Lab RT — **full module envelope** (UI-1…4) | [x] | UAT steps 17–24 + TE pack + \`reports/bank-te-demo-signoff.md\` |
| Field checklist | [ ] | YC-E7 |
| Partner / customer sign-off | [ ] | — |

Line **Pilot lab** = [x] for **lab** full envelope only — not Pilot field / not \`pilot_ready\`.

---

## Sell / show rules

- Edition column copies \`docs/editions/bank.yaml\` (\`mvp\`, \`pilot_ready: false\` until E7).
- Answer «готовность модуля» from **Modules × layers**; «готовность продукта / линии» from **Line summary**.
- Forbidden: «полная АБС» / «100% задач банка» / «GA» / certified risk / live rails / live SWIFT.
`,
);

w(
  "docs/editions/bank.yaml",
  `product: bank
status: mvp
pilot_ready: false
notes: "mvp; line Product-Readiness UI ✅ / Demo ✅ / Pilot lab [x] (full ops UI envelope after UI waves). Still pilot_ready:false / ≠ ga. YC-E live ⏸. Lab-pilot mid-size CBS; SWIFT/rails stub."
`,
);

patch(
  "docs/acceptance/Bank-Sprint-Index.md",
  `Current **line** rollup: Gate ✅ · BE ✅ · UI ❌ · Demo ❌ · Pilot lab [ ] · Pilot field [ ] · edition \`mvp\` · Sell: not UI-complete (new L2 API-only); ops modules still lab-demoable · YC-E ⏸`,
  `Current **line** rollup: Gate ✅ · BE ✅ · UI ✅ · Demo ✅ · Pilot lab [x] · Pilot field [ ] · edition \`mvp\` · Sell: lab-pilot mid-size CBS · YC-E live ⏸ · ≠ ga`,
);

patch(
  "docs/acceptance/Bank-Sprint-Index.md",
  `| YC-E1–E7 cert | gate[ ] | ✅ | [ ] | ⏸ until sandbox creds — CERTIFICATION-TRACK |

## Backlog`,
  `| YC-E1–E7 cert | gate[ ] | ✅ | [ ] | ⏸ until sandbox creds — CERTIFICATION-TRACK |
| UI-1…5 ops+DBO | gate[x] | ✅ | [x] lab | Cash/fees/SO; loans-deep/collections; trade; islamic/wealth/AML/3DS; TE+UAT line flip |

## Backlog`,
);

// Implementation matrix notes
for (const [find, rep] of [
  [
    "| AC-BNK-FEE | Fee tariff CRUD + assess post | ✅ | [ ] | BE Lite→Deep; SystemGl FEE_*; negative unknown tariff + short idempotency | UI deferred; `be-lite-fee.spec.ts` |",
    "| AC-BNK-FEE | Fee tariff CRUD + assess post | ✅ | [ ] | BE Lite→Deep; SystemGl FEE_*; negative unknown tariff + short idempotency | Ops `/fees` UI; `be-lite-fee.spec.ts` |",
  ],
  [
    "| AC-BNK-CASH | Cash vault/till + inventory + queue | ✅ | [ ] | banking_cash; posting vault↔till; EOD sdbRent | UI deferred; `be-collections.spec.ts` cash legs |",
    "| AC-BNK-CASH | Cash vault/till + inventory + queue | ✅ | [ ] | banking_cash; posting vault↔till; EOD sdbRent | Ops `/cash` UI; UAT step 17 |",
  ],
  [
    "| AC-BNK-COLL | Collections cases / PTP / recovery SoD | ✅ | [ ] | banking_collections; SoD self-approve reject | UI deferred |",
    "| AC-BNK-COLL | Collections cases / PTP / recovery SoD | ✅ | [ ] | banking_collections; SoD self-approve reject | Ops `/collections` UI; UAT SoD negative |",
  ],
  [
    "| AC-BNK-TRADE | Trade finance LC/BG/DC/SCF/SWIFT stub | ✅ | [ ] | banking_trade; contingent GL; SENT_STUB | Live SWIFT YC-E; `be-deep-trade.spec.ts` |",
    "| AC-BNK-TRADE | Trade finance LC/BG/DC/SCF/SWIFT stub | ✅ | [ ] | banking_trade; contingent GL; SENT_STUB | Ops `/trade` UI; live SWIFT YC-E |",
  ],
  [
    "| AC-BNK-SO | Standing orders / VA / cheque / sweep | ✅ | [ ] | payments extensions; EOD SO run | Rails still stub; `be-deep-standing-order.spec.ts` |",
    "| AC-BNK-SO | Standing orders / VA / cheque / sweep | ✅ | [ ] | payments extensions; EOD SO run | Ops `/payments/extras` + DBO SO; rails stub |",
  ],
  [
    "| AC-BNK-LN-WF | Loan application WF + credit line + score | ✅ | [ ] | loans-deep; SoD on book | |",
    "| AC-BNK-LN-WF | Loan application WF + credit line + score | ✅ | [ ] | loans-deep; SoD on book | Ops apps/credit-lines + DBO apply |",
  ],
  [
    "| AC-BNK-ISL | Islamic window contracts | ✅ | [ ] | banking_islamic lab activate post | |",
    "| AC-BNK-ISL | Islamic window contracts | ✅ | [ ] | banking_islamic lab activate post | Ops `/islamic` + DBO read-only |",
  ],
  [
    "| AC-BNK-WEALTH | Custody safekeeping thin | ✅ | [ ] | banking_wealth; FOP receive; no FO | Derivatives FO OUT |",
    "| AC-BNK-WEALTH | Custody safekeeping thin | ✅ | [ ] | banking_wealth; FOP receive; no FO | Ops `/wealth`; Derivatives FO OUT |",
  ],
  [
    "| AC-BNK-AML-RTF | AML case + fraud score lab | ✅ | [ ] | aml cases + `/aml/fraud/score` | Live feed BLOCKED |",
    "| AC-BNK-AML-RTF | AML case + fraud score lab | ✅ | [ ] | aml cases + `/aml/fraud/score` | Ops `/aml/cases`; live feed BLOCKED |",
  ],
]) {
  patch("docs/acceptance/Bank-Implementation-Matrix.md", find, rep);
}

// DBO implementation + readiness
patch(
  "docs/acceptance/Bank-DBO-Implementation-Matrix.md",
  `| AC-DBO-OPEN | Open API B2B + API keys | 🟡 | [ ] | engine /dbo/open/* | Curl-only stretch |

**Edition / wave rollup (BE only)**`,
  `| AC-DBO-OPEN | Open API B2B + API keys | 🟡 | [ ] | engine /dbo/open/* | Curl-only stretch |
| AC-DBO-SO | Standing orders / DD list+create+pause | ✅ | [ ] | dbo/standing-orders; CIF scope; unauth 401 | Corp large SO paused pending dual-control |
| AC-DBO-LOAN-APP | Loan application draft→submit | ✅ | [ ] | dbo/loans/applications; no book | Book stays ops SoD |
| AC-DBO-3DS | Card 3DS challenge complete | ✅ | [ ] | dbo/cards/3ds/challenges; card ownership | Ops creates challenge |

**Edition / wave rollup (BE only)**`,
);

patch(
  "docs/acceptance/Bank-DBO-Product-Readiness-Matrix.md",
  `| Accounts / transfers / payments | \`/accounts\`, \`/transfers\`, \`/payments\` | ✅ lab |
| Corporate approve | \`/payments/approve\` | ✅ lab |`,
  `| Accounts / transfers / payments | \`/accounts\`, \`/transfers\`, \`/payments\` | ✅ lab |
| Standing orders | \`/standing-orders\` | ✅ lab |
| Loan apply | \`/loans/apply\` | ✅ lab (submit only) |
| 3DS challenge | \`/cards/3ds\` | ✅ lab |
| Islamic (read-only) | \`/islamic\` | ✅ lab thin |
| Corporate approve | \`/payments/approve\` | ✅ lab |`,
);

// COVERAGE
patch(
  "docs/COVERAGE_MATRIX.md",
  `| BANK-FEE-01 | Fee tariff assess post | BE roadmap | Y | — | — | — | — | API | UI deferred |
| BANK-CASH-01 | Vault/till cash movements | BE roadmap | Y | — | — | — | — | API | banking_cash |
| BANK-COLL-01 | Collections recovery SoD | BE roadmap | Y | — | — | — | — | API | banking_collections |
| BANK-TRADE-01 | Trade LC/BG contingent | BE roadmap | Y | — | — | — | — | API | banking_trade lab |
| BANK-SO-01 | Standing orders EOD run | BE roadmap | Y | — | — | — | — | API | stub rails |
| BANK-ISL-01 | Islamic contract activate | BE roadmap | Y | — | — | — | — | API | banking_islamic lab |
| BANK-WEALTH-01 | Safekeeping FOP | BE roadmap | Y | — | — | — | — | API | thin custody |
| BANK-AML-RTF-01 | Fraud score lab | BE roadmap | Y | — | — | — | — | API | not live feed |`,
  `| BANK-FEE-01 | Fee tariff assess post | BE roadmap | Y | Y \`/fees\` | — | — | — | SHIPPED | tariffs/SDB lab |
| BANK-CASH-01 | Vault/till cash movements | BE roadmap | Y | Y \`/cash\` | — | — | — | SHIPPED | banking_cash |
| BANK-COLL-01 | Collections recovery SoD | BE roadmap | Y | Y \`/collections\` | — | — | — | SHIPPED | banking_collections |
| BANK-TRADE-01 | Trade LC/BG contingent | BE roadmap | Y | Y \`/trade\` | — | — | — | SHIPPED | SWIFT stub |
| BANK-SO-01 | Standing orders EOD run | BE roadmap | Y | Y \`/payments/extras\` | — | — | — | SHIPPED | + DBO SO |
| BANK-ISL-01 | Islamic contract activate | BE roadmap | Y | Y \`/islamic\` | — | — | — | SHIPPED | DBO read-only |
| BANK-WEALTH-01 | Safekeeping FOP | BE roadmap | Y | Y \`/wealth\` | — | — | — | SHIPPED | thin custody |
| BANK-AML-RTF-01 | Fraud score lab | BE roadmap | Y | Y \`/aml/cases\` | — | — | — | API | score engine; cases UI |`,
);

console.log("docs closeout patches applied");
