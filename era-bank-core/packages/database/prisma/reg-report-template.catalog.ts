import { InstitutionType, RegReportOutputFormat } from "../generated/client";

/** Seed catalog for {@link RegReportTemplate} — shared by db:seed and migration parity. */
export const REG_REPORT_TEMPLATE_CATALOG: Array<{
  id: string;
  code: string;
  institutionType: InstitutionType | null;
  version: string;
  validFrom: Date;
  outputFormat: RegReportOutputFormat;
  definitionJson: Record<string, unknown>;
}> = [
  {
    id: "rrtpl_cbar_trial_balance_v1",
    code: "CBAR_TRIAL_BALANCE",
    institutionType: null,
    version: "v1",
    validFrom: new Date("2020-01-01T00:00:00.000Z"),
    outputFormat: RegReportOutputFormat.CSV,
    definitionJson: {
      assembly: { kind: "TRIAL_BALANCE" },
      controlRatios: [
        {
          code: "TB_DEBIT_EQ_CREDIT",
          path: "totals.balanced",
          operator: "eq",
          expected: true,
        },
      ],
    },
  },
  {
    id: "rrtpl_cbar_balance_sheet_v1",
    code: "CBAR_BALANCE_SHEET_STUB",
    institutionType: null,
    version: "v1",
    validFrom: new Date("2020-01-01T00:00:00.000Z"),
    outputFormat: RegReportOutputFormat.JSON,
    definitionJson: {
      assembly: { kind: "BALANCE_SHEET_STUB" },
      controlRatios: [
        {
          code: "BS_ASSET_EQ_LIAB_EQUITY",
          operator: "sum_eq_minor",
          leftPath: "aggregatedByType.ASSET",
          rightPaths: ["aggregatedByType.LIABILITY", "aggregatedByType.EQUITY"],
        },
      ],
    },
  },
  {
    id: "rrtpl_cbar_pnl_stub_v1",
    code: "CBAR_PNL_STUB",
    institutionType: null,
    version: "v1",
    validFrom: new Date("2020-01-01T00:00:00.000Z"),
    outputFormat: RegReportOutputFormat.JSON,
    definitionJson: {
      assembly: { kind: "PNL_STUB" },
      controlRatios: [
        {
          code: "PNL_NET_MATCHES",
          operator: "diff_eq_minor",
          leftPath: "incomeNetMinor",
          rightPath: "expenseNetMinor",
          resultPath: "computedNetMinor",
        },
      ],
    },
  },
  {
    id: "rrtpl_cbar_credit_portfolio_v1",
    code: "CBAR_CREDIT_PORTFOLIO_BY_CATEGORY",
    institutionType: null,
    version: "v2",
    validFrom: new Date("2020-01-01T00:00:00.000Z"),
    outputFormat: RegReportOutputFormat.JSON,
    definitionJson: {
      assembly: { kind: "CREDIT_PORTFOLIO_BY_CATEGORY" },
      placeholderNote:
        "Categories from latest COMPLETED prudential run; else GL 130* interim total.",
    },
  },
  {
    id: "rrtpl_bokt_trial_balance_v1",
    code: "CBAR_TRIAL_BALANCE",
    institutionType: InstitutionType.BOKT,
    version: "v1-bokt",
    validFrom: new Date("2020-01-01T00:00:00.000Z"),
    outputFormat: RegReportOutputFormat.CSV,
    definitionJson: {
      assembly: { kind: "TRIAL_BALANCE" },
      controlRatios: [
        {
          code: "TB_DEBIT_EQ_CREDIT",
          path: "totals.balanced",
          operator: "eq",
          expected: true,
        },
      ],
    },
  },
  {
    id: "rrtpl_cbar_lcr_stub_v1",
    code: "CBAR_LCR_STUB",
    institutionType: null,
    version: "v1",
    validFrom: new Date("2020-01-01T00:00:00.000Z"),
    outputFormat: RegReportOutputFormat.JSON,
    definitionJson: { assembly: { kind: "LCR_FROM_RISK_OR_GL" } },
  },
  {
    id: "rrtpl_cbar_car_stub_v1",
    code: "CBAR_CAR_STUB",
    institutionType: null,
    version: "v1",
    validFrom: new Date("2020-01-01T00:00:00.000Z"),
    outputFormat: RegReportOutputFormat.JSON,
    definitionJson: { assembly: { kind: "CAR_FROM_RISK" } },
  },
];