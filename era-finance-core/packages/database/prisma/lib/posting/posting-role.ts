/** Semantic posting roles — stable across OrganizationKind; mapped to NAS codes per kind. */
export const POSTING_ROLES = [
  "TRADE_RECEIVABLE",
  "TRADE_RECEIVABLE_GOODS",
  "TRADE_RECEIVABLE_SERVICES",
  "SUPPLIER_PAYABLE",
  "EMPLOYEE_PAYABLE",
  "PAYROLL_EXPENSE",
  "PAYROLL_PAYABLE",
  "PAYROLL_TAX_PAYABLE",
  "PAYROLL_SOCIAL_PAYABLE",
  "SALES_REVENUE",
  "SALES_REVENUE_GOODS",
  "SERVICE_REVENUE",
  "MEMBERSHIP_REVENUE",
  "DONATION_REVENUE",
  "GRANT_REVENUE",
  "TARGETED_FUNDING_REVENUE",
  "CASH_AZN",
  "CASH_FOREIGN",
  "CASH_IN_TRANSIT",
  "BANK_SETTLEMENT",
  "MAIN_BANK",
  "INVENTORY_GOODS",
  "FINISHED_GOODS",
  "WIP_MANUFACTURING",
  "COGS",
  "VAT_INPUT",
  "VAT_OUTPUT",
  "FX_GAIN",
  "FX_LOSS",
  "TRANSIT_TRANSFER",
  "ACCUMULATED_DEPRECIATION",
  "DEPRECIATION_EXPENSE",
  "MISC_OPERATING_EXPENSE",
  "MANUFACTURING_OVERHEAD_CREDIT",
  "INVENTORY_SURPLUS_INCOME",
  "FOUNDER_FUNDS",
  "ACCOUNTABLE_PERSONS",
  "BUDGET_FUNDING_RECEIVED",
  "BUDGET_PAYROLL_EXPENSE",
] as const;

export type PostingRole = (typeof POSTING_ROLES)[number];

const ROLE_SET = new Set<string>(POSTING_ROLES);

export function isPostingRole(value: string): value is PostingRole {
  return ROLE_SET.has(value);
}

export function assertPostingRole(value: string): PostingRole {
  if (!isPostingRole(value)) {
    throw new Error(`Unknown posting role: ${value}`);
  }
  return value;
}
