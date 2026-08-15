import fs from "fs";
import path from "path";

const root = "d:/My Projects/era-ecosystem";
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const write = (p, c) => {
  fs.writeFileSync(path.join(root, p), c.replace(/\r?\n/g, "\n"), "utf8");
  console.log("wrote", p);
};
const replaceAll = (p, pairs) => {
  let s = read(p);
  for (const [a, b] of pairs) {
    if (!s.includes(a)) {
      console.warn("miss", p, a.slice(0, 60));
      continue;
    }
    s = s.split(a).join(b);
  }
  write(p, s);
};

// PRD audience + §11
{
  let s = read("era-bank-core/PRD.md");
  s = s.replace(
    /\*\*Audience:\*\* mid-size universal\/retail bank in Azerbaijan \(CBAR \/ AMB regulated\) — \*\*not\*\* full enterprise ABS parity \(Temenos\/FLEXCUBE Universal complete\)\./,
    "**Audience:** Full commercial universal/retail CBS for banks in Azerbaijan (CBAR / AMB regulated). Product depth targets commercial ABS capability coverage (see Capability Inventory); live/cert partners remain YC-E gated.",
  );
  s = s.replace(
    /## §11\. Out of scope \/ not in current edition[\s\S]*?(?=## §12\. Changelog)/,
    `## §11. Scope — Full commercial CBS program

SSOT: [Bank-Capability-Inventory.md](../docs/acceptance/Bank-Capability-Inventory.md).  
Program tracker: [Bank-Full-CBS-Roadmap.md](../docs/acceptance/Bank-Full-CBS-Roadmap.md).

### 11.1 Product envelope

ERA Bank targets a **full commercial CBS** for Azerbaijan: deepen all PARTIAL capabilities to product IN, and bring former OUT lines (ATM/scheme, markets FO, CSD/AM/brokerage, PFM, pension/PSA, multi-entity, MIS/BPM/DMS, certified risk) onto DECLARED→IN waves.

### 11.2 Still partner / field gated (YC-E)

Live rails, cards gateway, ASAN/SİMA, AKB + certified ECL, FMN/CBAR submit, sanctions feed, pentest/HA, Pilot field / \`pilot_ready\` — [CERTIFICATION-TRACK.md](../era-bank/doc/CERTIFICATION-TRACK.md).

### 11.3 ADR constraints until revised

- One **deployment** = one bank license (ADR D5) until CAP-CORE-MENT wave revises multi-entity holding.
- Money remains ACID in \`era-bank-core\`; corporate ERP stays in finance-core.

`,
  );
  if (!s.includes("Full commercial CBS program")) {
    // fallback append note in changelog
  }
  if (!s.includes("Full commercial CBS program (Phase 0)")) {
    s = s.replace(
      /\| 2026-08-06 \| BE Lite→Deep:.*\|/,
      `$&\n| 2026-08-06 | Full commercial CBS program (Phase 0): audience + §11 rewrite; OUT→DECLARED roadmap. |`,
    );
  }
  write("era-bank-core/PRD.md", s);
}

// ADR
replaceAll("docs/adr/era-bank-core.md", [
  [
    "scope boundary [Bank-Capability-Inventory.md](../acceptance/Bank-Capability-Inventory.md) (mid-size AZ CBS ≠ full enterprise ABS)",
    "scope boundary [Bank-Capability-Inventory.md](../acceptance/Bank-Capability-Inventory.md) · Full commercial CBS program [Bank-Full-CBS-Roadmap.md](../acceptance/Bank-Full-CBS-Roadmap.md)",
  ],
  [
    "We want to add a **Core Banking System (CBS)** as a **licensable product** for mid-size banks in Azerbaijan, regulated by the Central Bank of Azerbaijan (**CBAR / AMB**).",
    "We deliver a **Core Banking System (CBS)** as a **licensable full commercial product** for banks in Azerbaijan, regulated by the Central Bank of Azerbaijan (**CBAR / AMB**). Mid-size-lab framing is retired; PARTIAL→IN and former OUT→IN are tracked in Bank-Full-CBS-Roadmap.",
  ],
]);

// Inventory — rewrite header + OUT→DECLARED + PARTIAL notes + envelope
{
  let s = read("docs/acceptance/Bank-Capability-Inventory.md");
  s = s.replace(
    "**Audience product:** mid-size universal/retail bank in Azerbaijan (CBAR/AMB).",
    "**Audience product:** Full commercial universal/retail CBS for Azerbaijan (CBAR/AMB).",
  );
  s = s.replace(
    /\*\*Declared product envelope[\s\S]*?Tracker: \[Bank-BE-Roadmap\.md\]\(\.\/Bank-BE-Roadmap\.md\)\./,
    `**Product envelope:** Full commercial AZ CBS — PRD §4 modules + L2 trade/collections/cash/islamic/wealth/risk + roadmap waves for former OUT (ATM, markets FO, CSD, PFM, PEN/PSA, multi-entity, MIS/BPM/DMS). Trackers: [Bank-Full-CBS-Roadmap.md](./Bank-Full-CBS-Roadmap.md) · [Bank-BE-Roadmap.md](./Bank-BE-Roadmap.md).`,
  );
  s = s.replace(
    "| **OUT** | Common in advanced ABS; **not** a current ERA Bank module/AC — must not be sold as included |",
    "| **OUT** | Retired for Full CBS program — use DECLARED with wave ID (XO-*) instead |",
  );
  // OUT → DECLARED with waves
  const outMap = [
    ["| CAP-CORE-MENT | Multi-entity holding / many legal banks one install | OUT | One license = one bank (ADR D5) |", "| CAP-CORE-MENT | Multi-entity holding / many legal banks one install | DECLARED | XO-6; ADR D5 revision required |"],
    ["| CAP-CORE-AGENCY | Agency / shared services banking | OUT | |", "| CAP-CORE-AGENCY | Agency / shared services banking | DECLARED | XO-6 |"],
    ["| CAP-CARD-ATM | ATM switch / own ATM network | OUT | External processor first (PRD) |", "| CAP-CARD-ATM | ATM switch / own ATM network | DECLARED | XO-1 |"],
    ["| CAP-CARD-SCHEME | In-house card scheme | OUT | Explicit PRD out |", "| CAP-CARD-SCHEME | In-house card scheme | DECLARED | XO-1 |"],
    ["| CAP-TR-DRV | Derivatives (IRS, FX options, …) | OUT | PRD capital markets FO out |", "| CAP-TR-DRV | Derivatives (IRS, FX options, …) | DECLARED | XO-2 `banking_markets` |"],
    ["| CAP-TR-BOND | Bond FO / AM trading | OUT | |", "| CAP-TR-BOND | Bond FO / AM trading | DECLARED | XO-2 |"],
    ["| CAP-TR-AM | Asset management / funds | OUT | |", "| CAP-TR-AM | Asset management / funds | DECLARED | XO-3 |"],
    ["| CAP-TR-BRK | Brokerage / securities settlement | OUT | |", "| CAP-TR-BRK | Brokerage / securities settlement | DECLARED | XO-3 |"],
    ["| CAP-TR-METAL | Precious metals | OUT | |", "| CAP-TR-METAL | Precious metals | DECLARED | XO-3 |"],
    ["| CAP-RSK-CERT | Certified Basel/IFRS9 / ICAAP / stress | OUT | Until YC-E4+ |", "| CAP-RSK-CERT | Certified Basel/IFRS9 / ICAAP / stress | DECLARED | XO-8 + YC-E4 |"],
    ["| CAP-DBO-PFM | PFM / chat / voice banking | OUT | |", "| CAP-DBO-PFM | PFM / chat / voice banking | DECLARED | XO-4 |"],
    ["| CAP-PEN | Pension / social agency | OUT | |", "| CAP-PEN | Pension / social agency | DECLARED | XO-5 |"],
    ["| CAP-PSA | Public sector TSA | OUT | |", "| CAP-PSA | Public sector TSA | DECLARED | XO-5 |"],
    ["| CAP-NFR-MIS | Full MIS / data mart / BI | OUT | |", "| CAP-NFR-MIS | Full MIS / data mart / BI | DECLARED | XO-7 |"],
    ["| CAP-NFR-BPM | Enterprise BPM | OUT | |", "| CAP-NFR-BPM | Enterprise BPM | DECLARED | XO-7 |"],
    ["| CAP-NFR-DMS | Document management / e-archive | OUT | |", "| CAP-NFR-DMS | Document management / e-archive | DECLARED | XO-7 |"],
  ];
  for (const [a, b] of outMap) s = s.split(a).join(b);

  // PARTIAL backlog notes for FC waves
  s = s.replace(
    "| CAP-CORE-HOLD | Holds / arrests / liens | PARTIAL | |",
    "| CAP-CORE-HOLD | Holds / arrests / liens | PARTIAL | FC-1 → IN |",
  );
  s = s.replace(
    "| CAP-CORE-OD | Overdraft / account limits | PARTIAL | Model fields; not full OD product suite |",
    "| CAP-CORE-OD | Overdraft / account limits | PARTIAL | FC-1 → IN |",
  );
  s = s.replace(
    "| CAP-CORE-FX | Multi-currency / FX revaluation | PARTIAL | |",
    "| CAP-CORE-FX | Multi-currency / FX revaluation | PARTIAL | FC-1 → IN |",
  );
  s = s.replace(
    "| CAP-CORE-BR | Multi-branch / МФР | PARTIAL | |",
    "| CAP-CORE-BR | Multi-branch / МФР | PARTIAL | FC-1 → IN |",
  );
  s = s.replace(
    "| CAP-CORE-RELPRICE | Relationship / package pricing enterprise | PARTIAL | Package link CRUD (not enterprise) |",
    "| CAP-CORE-RELPRICE | Relationship / package pricing enterprise | PARTIAL | FC-1 → IN |",
  );

  s = s.replace(
    "| IN + PARTIAL | Declared mid-size AZ CBS lab | Sell as **lab-pilot / mvp** only |",
    "| IN + PARTIAL | Full commercial CBS in progress | Sell as **mvp** until PARTIAL cleared + Pilot field; program [Bank-Full-CBS-Roadmap](./Bank-Full-CBS-Roadmap.md) |",
  );
  s = s.replace(
    "| OUT + BLOCKED | Enterprise ABS extras | Explicitly **not in edition**; do not imply coverage |",
    "| DECLARED (ex-OUT) + BLOCKED | Full CBS backlog + external feeds | DECLARED = on roadmap; BLOCKED = partner/policy |",
  );
  s = s.replace(
    "**Forbidden sell phrases:** «полная АБС», «100% задач коммерческого банка», «как Temenos/FLEXCUBE», «certified IFRS 9 / Basel», «live rails» — while yaml `mvp` / Pilot field open / CAP-* OUT or DECLARED without evidence.",
    "**Forbidden sell phrases:** «GA», «certified IFRS 9 / Basel», «live rails» — while `pilot_ready: false` / Pilot field open / CAP DECLARED without wave evidence. Full commercial CBS is the **target envelope**, not a claim of completion.",
  );
  s += `\n| 2026-08-06 | Full commercial CBS Phase 0: mid-size retired; OUT→DECLARED (XO waves); PARTIAL→FC waves |\n`;
  write("docs/acceptance/Bank-Capability-Inventory.md", s);
}

// CERTIFICATION-TRACK
replaceAll("era-bank/doc/CERTIFICATION-TRACK.md", [
  [
    "**Scope boundary:** [`Bank-Capability-Inventory.md`](../../docs/acceptance/Bank-Capability-Inventory.md) — this track only advances CAP-* **DECLARED** live/cert rows; it does **not** add CAP-* **OUT** modules (trade finance, custody, wealth, …).",
    "**Scope boundary:** [`Bank-Capability-Inventory.md`](../../docs/acceptance/Bank-Capability-Inventory.md) · Full CBS program [`Bank-Full-CBS-Roadmap.md`](../../docs/acceptance/Bank-Full-CBS-Roadmap.md). This track advances live/cert DECLARED rows (YC-E). Product-depth XO/FC waves are separate.",
  ],
  [
    "Do **not** narrate YC-E completion as «полная АБС» — OUT inventory remains unless PRD adds modules.",
    "Do **not** narrate YC-E completion as product ga — Full CBS product-depth waves (FC/XO) must also reach IN; `pilot_ready` requires E7 field evidence.",
  ],
]);

// editions + sell lines
write(
  "docs/editions/bank.yaml",
  `product: bank
status: mvp
pilot_ready: false
notes: "Full commercial CBS program (Phase 0). mvp until FC/XO product depth + YC-E7 field. pilot_ready:false. Not ga. Live rails/ASAN/AKB ⏸."
`,
);

replaceAll("docs/acceptance/Bank-Product-Readiness-Matrix.md", [
  [
    "| **Bank** | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` (`pilot_ready: false`) | **Lab-pilot mid-size CBS** (ops UI envelope + selective DBO). ≠ ga; YC-E live ⏸; not full ABS |",
    "| **Bank** | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` (`pilot_ready: false`) | **Full commercial CBS program** — ops UI lab envelope; PARTIAL/XO backlog; YC-E ⏸; ≠ ga / ≠ pilot_ready |",
  ],
  [
    "**Having routes ≠ UI ready for sell** — sell/show remains lab-pilot mid-size CBS until field/YC-E.",
    "**Having routes ≠ field-ready.** Sell/show: mvp Full CBS program until PARTIAL→IN + Pilot field (YC-E7).",
  ],
]);

replaceAll("docs/acceptance/Bank-Sprint-Index.md", [
  [
    "Current **line** rollup: Gate ✅ · BE ✅ · UI ✅ · Demo ✅ · Pilot lab [x] · Pilot field [ ] · edition `mvp` · Sell: lab-pilot mid-size CBS · YC-E live ⏸ · ≠ ga",
    "Current **line** rollup: Gate ✅ · BE ✅ · UI ✅ · Demo ✅ · Pilot lab [x] · Pilot field [ ] · edition `mvp` · Sell: Full commercial CBS program (PARTIAL/XO backlog) · YC-E ⏸ · ≠ ga / ≠ pilot_ready",
  ],
]);

replaceAll("docs/MODULES_CATALOG.md", [
  [
    "**Product envelope:** mid-size AZ universal/retail CBS (PRD §4) — **lab-pilot / mvp**, not product ga, **not** full enterprise ABS. Scope boundary SSOT: [Bank-Capability-Inventory.md](./acceptance/Bank-Capability-Inventory.md). BE waves: [Bank-BE-Roadmap.md](./acceptance/Bank-BE-Roadmap.md). Live/cert: [CERTIFICATION-TRACK.md](../era-bank/doc/CERTIFICATION-TRACK.md).",
    "**Product envelope:** Full commercial AZ CBS (PRD §4 + FC/XO roadmap) — **mvp** until product-depth + Pilot field; not ga. SSOT: [Bank-Capability-Inventory.md](./acceptance/Bank-Capability-Inventory.md) · [Bank-Full-CBS-Roadmap.md](./acceptance/Bank-Full-CBS-Roadmap.md). Live/cert: [CERTIFICATION-TRACK.md](../era-bank/doc/CERTIFICATION-TRACK.md).",
  ],
]);

replaceAll("docs/SATELLITE_DOCUMENTATION.md", [
  [
    "| Bank scope / acceptance | [Bank-Capability-Inventory.md](./acceptance/Bank-Capability-Inventory.md) · [Bank-Acceptance-System.md](./acceptance/Bank-Acceptance-System.md) · [Bank-Product-Readiness-Matrix.md](./acceptance/Bank-Product-Readiness-Matrix.md) — mid-size AZ CBS lab-pilot ≠ full ABS |",
    "| Bank scope / acceptance | [Bank-Capability-Inventory.md](./acceptance/Bank-Capability-Inventory.md) · [Bank-Full-CBS-Roadmap.md](./acceptance/Bank-Full-CBS-Roadmap.md) · [Bank-Product-Readiness-Matrix.md](./acceptance/Bank-Product-Readiness-Matrix.md) — Full commercial CBS program (mvp until field) |",
  ],
]);

replaceAll("docs/acceptance/Bank-Acceptance-System.md", [
  ["### In scope (declared mid-size AZ CBS)", "### In scope (Full commercial AZ CBS program)"],
]);

replaceAll("docs/acceptance/Bank-BE-Roadmap.md", [
  [
    "**Out of these waves:** ops/DBO UI, live partner UAT (YC-E*), edition `ga` / `pilot_ready`.",
    "**Superseded narrative:** Deep-2 closed lab. Continuing product depth: [Bank-Full-CBS-Roadmap.md](./Bank-Full-CBS-Roadmap.md). Live partner UAT = YC-E*.",
  ],
]);

console.log("phase0 canon done");
