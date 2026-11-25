import { InstitutionType } from "@era/bank-core-database";
import {
  assembleGlReportPayload,
  parseRegReportDefinition,
  pickActiveRegReportTemplate,
  validateControlRatios,
  type TemplateCandidate,
  type TrialRow,
} from "../src/modules/regreporting/reg-report.engine";

const sampleRows: TrialRow[] = [
  {
    glAccountId: "gl1",
    debitMinor: 1_000n,
    creditMinor: 0n,
    currency: "AZN",
  },
  {
    glAccountId: "gl2",
    debitMinor: 0n,
    creditMinor: 1_000n,
    currency: "AZN",
  },
];

const glById = new Map([
  ["gl1", { code: "1000101", name: "Cash", type: "ASSET" as const }],
  ["gl2", { code: "2200101", name: "Deposits", type: "LIABILITY" as const }],
]);

describe("reg-report.engine template pick", () => {
  it("picks newest validFrom matching institution type", () => {
    const rows: TemplateCandidate[] = [
      {
        id: "a",
        code: "CBAR_TRIAL_BALANCE",
        version: "v1",
        validFrom: new Date("2020-01-01"),
        institutionType: null,
        definitionJson: {},
        outputFormat: "JSON",
      },
      {
        id: "b",
        code: "CBAR_TRIAL_BALANCE",
        version: "v2",
        validFrom: new Date("2024-01-01"),
        institutionType: InstitutionType.BANK,
        definitionJson: {},
        outputFormat: "JSON",
      },
    ];
    const picked = pickActiveRegReportTemplate(
      rows,
      InstitutionType.BANK,
      new Date("2025-06-01"),
    );
    expect(picked?.id).toBe("b");
  });

  it("parses definitionJson assembly kind", () => {
    const def = parseRegReportDefinition({
      assembly: { kind: "TRIAL_BALANCE" },
      controlRatios: [],
    });
    expect(def.assembly.kind).toBe("TRIAL_BALANCE");
  });
});

describe("reg-report.engine control ratios", () => {
  it("passes when trial balance debits equal credits", () => {
    const def = parseRegReportDefinition({
      assembly: { kind: "TRIAL_BALANCE" },
      controlRatios: [
        {
          code: "TB_DEBIT_EQ_CREDIT",
          path: "totals.balanced",
          operator: "eq",
          expected: true,
        },
      ],
    });
    const output = assembleGlReportPayload(
      "CBAR_TRIAL_BALANCE",
      def,
      sampleRows,
      glById,
      "v1",
    );
    const validation = validateControlRatios(def, output);
    expect(validation.passed).toBe(true);
    expect(validation.results[0]?.passed).toBe(true);
  });

  it("fails when trial balance is out of balance", () => {
    const def = parseRegReportDefinition({
      assembly: { kind: "TRIAL_BALANCE" },
      controlRatios: [
        {
          code: "TB_DEBIT_EQ_CREDIT",
          path: "totals.balanced",
          operator: "eq",
          expected: true,
        },
      ],
    });
    const imbalanced: TrialRow[] = [
      { glAccountId: "gl1", debitMinor: 500n, creditMinor: 0n, currency: "AZN" },
      { glAccountId: "gl2", debitMinor: 0n, creditMinor: 400n, currency: "AZN" },
    ];
    const output = assembleGlReportPayload(
      "CBAR_TRIAL_BALANCE",
      def,
      imbalanced,
      glById,
      "v1",
    );
    const validation = validateControlRatios(def, output);
    expect(validation.passed).toBe(false);
    expect(validation.results[0]?.passed).toBe(false);
  });

  it("validates balance sheet assets = liabilities + equity", () => {
    const rows: TrialRow[] = [
      { glAccountId: "gl1", debitMinor: 1_100n, creditMinor: 0n, currency: "AZN" },
      { glAccountId: "gl2", debitMinor: 0n, creditMinor: 1_000n, currency: "AZN" },
      { glAccountId: "gl3", debitMinor: 0n, creditMinor: 100n, currency: "AZN" },
    ];
    const gl = new Map([
      ["gl1", { code: "1000101", name: "Cash", type: "ASSET" as const }],
      ["gl2", { code: "2200101", name: "Deposits", type: "LIABILITY" as const }],
      ["gl3", { code: "3100101", name: "Equity", type: "EQUITY" as const }],
    ]);
    const def = parseRegReportDefinition({
      assembly: { kind: "BALANCE_SHEET_STUB" },
      controlRatios: [
        {
          code: "BS_ASSET_EQ_LIAB_EQUITY",
          operator: "sum_eq_minor",
          leftPath: "aggregatedByType.ASSET",
          rightPaths: ["aggregatedByType.LIABILITY", "aggregatedByType.EQUITY"],
        },
      ],
    });
    const output = assembleGlReportPayload(
      "CBAR_BALANCE_SHEET_STUB",
      def,
      rows,
      gl,
      "v1",
    );
    const validation = validateControlRatios(def, output);
    expect(validation.passed).toBe(true);
  });
});