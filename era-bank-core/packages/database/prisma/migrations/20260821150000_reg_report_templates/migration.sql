-- CreateEnum
CREATE TYPE "RegReportOutputFormat" AS ENUM ('JSON', 'CSV', 'XML');

-- CreateTable
CREATE TABLE "reg_report_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "institution_type" "InstitutionType",
    "version" TEXT NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "definition_json" JSONB NOT NULL,
    "output_format" "RegReportOutputFormat" NOT NULL DEFAULT 'JSON',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reg_report_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reg_report_templates_code_institution_type_version_key" ON "reg_report_templates"("code", "institution_type", "version");

-- CreateIndex
CREATE INDEX "reg_report_templates_code_valid_from_idx" ON "reg_report_templates"("code", "valid_from");

-- AlterTable
ALTER TABLE "reg_report_runs" ADD COLUMN "reg_report_template_id" TEXT;

-- CreateIndex
CREATE INDEX "reg_report_runs_reg_report_template_id_idx" ON "reg_report_runs"("reg_report_template_id");

-- AddForeignKey
ALTER TABLE "reg_report_runs" ADD CONSTRAINT "reg_report_runs_reg_report_template_id_fkey" FOREIGN KEY ("reg_report_template_id") REFERENCES "reg_report_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed CBAR templates (global; institution_type NULL = all institution types)
INSERT INTO "reg_report_templates" ("id", "code", "institution_type", "version", "valid_from", "definition_json", "output_format", "created_at")
VALUES
  (
    'rrtpl_cbar_trial_balance_v1',
    'CBAR_TRIAL_BALANCE',
    NULL,
    'v1',
    '2020-01-01 00:00:00'::timestamp,
    '{"assembly":{"kind":"TRIAL_BALANCE"},"controlRatios":[{"code":"TB_DEBIT_EQ_CREDIT","path":"totals.balanced","operator":"eq","expected":true}]}'::jsonb,
    'CSV'::"RegReportOutputFormat",
    CURRENT_TIMESTAMP
  ),
  (
    'rrtpl_cbar_balance_sheet_v1',
    'CBAR_BALANCE_SHEET_STUB',
    NULL,
    'v1',
    '2020-01-01 00:00:00'::timestamp,
    '{"assembly":{"kind":"BALANCE_SHEET_STUB"},"controlRatios":[{"code":"BS_ASSET_EQ_LIAB_EQUITY","operator":"sum_eq_minor","leftPath":"aggregatedByType.ASSET","rightPaths":["aggregatedByType.LIABILITY","aggregatedByType.EQUITY"]}]}'::jsonb,
    'JSON'::"RegReportOutputFormat",
    CURRENT_TIMESTAMP
  ),
  (
    'rrtpl_cbar_pnl_stub_v1',
    'CBAR_PNL_STUB',
    NULL,
    'v1',
    '2020-01-01 00:00:00'::timestamp,
    '{"assembly":{"kind":"PNL_STUB"},"controlRatios":[{"code":"PNL_NET_MATCHES","operator":"diff_eq_minor","leftPath":"incomeNetMinor","rightPath":"expenseNetMinor","resultPath":"computedNetMinor"}]}'::jsonb,
    'JSON'::"RegReportOutputFormat",
    CURRENT_TIMESTAMP
  ),
  (
    'rrtpl_cbar_credit_portfolio_v1',
    'CBAR_CREDIT_PORTFOLIO_BY_CATEGORY',
    NULL,
    'v1',
    '2020-01-01 00:00:00'::timestamp,
    '{"assembly":{"kind":"CREDIT_PORTFOLIO_PLACEHOLDER"},"placeholderNote":"Loan category breakdown lands with P0-3; GL loan prefix 130* used as interim total."}'::jsonb,
    'JSON'::"RegReportOutputFormat",
    CURRENT_TIMESTAMP
  ),
  (
    'rrtpl_cbar_lcr_stub_v1',
    'CBAR_LCR_STUB',
    NULL,
    'v1',
    '2020-01-01 00:00:00'::timestamp,
    '{"assembly":{"kind":"LCR_FROM_RISK_OR_GL"}}'::jsonb,
    'JSON'::"RegReportOutputFormat",
    CURRENT_TIMESTAMP
  ),
  (
    'rrtpl_cbar_car_stub_v1',
    'CBAR_CAR_STUB',
    NULL,
    'v1',
    '2020-01-01 00:00:00'::timestamp,
    '{"assembly":{"kind":"CAR_FROM_RISK"}}'::jsonb,
    'JSON'::"RegReportOutputFormat",
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("code", "institution_type", "version") DO NOTHING;