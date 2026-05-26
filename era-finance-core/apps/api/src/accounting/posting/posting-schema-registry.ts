import { OrganizationKind } from "@erafinance/database";
import type { PostingRole } from "@erafinance/database";

export type PostingSchemaId =
  | "INVOICE_REVENUE_RECOGNITION"
  | "INVOICE_PAYMENT"
  | "PURCHASE_GOODS"
  | "PAYROLL_ACCRUAL"
  | "NETTING"
  | "COGS_ON_SALE"
  | "BUDGET_APPROPRIATION"
  | "BUDGET_EXPENSE_EXECUTION"
  | "NGO_GRANT_INCOME"
  | "FX_GAIN"
  | "FX_LOSS"
  | "INVENTORY_SURPLUS"
  | "INVENTORY_WRITE_OFF"
  | "INVENTORY_ACCOUNTABLE"
  | "DEPRECIATION"
  | "MANUFACTURING_WIP"
  | "MANUFACTURING_OVERHEAD"
  | "CASH_IN_TRANSIT"
  | "VAT_NETTING";

export type PostingLineSide = "DEBIT" | "CREDIT";

export type PostingSchemaLine = {
  role: PostingRole;
  side: PostingLineSide;
  amountKey: string;
  /** When set, use this NAS code instead of resolving the role (BudgetLine, explicit cash, etc.). */
  useDynamicAccountKey?: "debitAccountCode" | "creditAccountCode";
};

export type PostingSchemaDefinition = {
  id: PostingSchemaId;
  kinds: OrganizationKind[];
  lines: PostingSchemaLine[];
};

const ALL_KINDS = [
  OrganizationKind.COMMERCIAL,
  OrganizationKind.BUDGET,
  OrganizationKind.NGO,
] as const;

export const POSTING_SCHEMAS: Record<PostingSchemaId, PostingSchemaDefinition> = {
  INVOICE_REVENUE_RECOGNITION: {
    id: "INVOICE_REVENUE_RECOGNITION",
    kinds: [...ALL_KINDS],
    lines: [
      { role: "TRADE_RECEIVABLE", side: "DEBIT", amountKey: "main" },
      { role: "SALES_REVENUE", side: "CREDIT", amountKey: "main" },
    ],
  },
  INVOICE_PAYMENT: {
    id: "INVOICE_PAYMENT",
    kinds: [...ALL_KINDS],
    lines: [
      {
        role: "CASH_AZN",
        side: "DEBIT",
        amountKey: "main",
        useDynamicAccountKey: "debitAccountCode",
      },
      { role: "TRADE_RECEIVABLE", side: "CREDIT", amountKey: "main" },
    ],
  },
  PURCHASE_GOODS: {
    id: "PURCHASE_GOODS",
    kinds: [...ALL_KINDS],
    lines: [
      {
        role: "INVENTORY_GOODS",
        side: "DEBIT",
        amountKey: "main",
        useDynamicAccountKey: "debitAccountCode",
      },
      { role: "SUPPLIER_PAYABLE", side: "CREDIT", amountKey: "main" },
    ],
  },
  PAYROLL_ACCRUAL: {
    id: "PAYROLL_ACCRUAL",
    kinds: [...ALL_KINDS],
    lines: [
      {
        role: "PAYROLL_EXPENSE",
        side: "DEBIT",
        amountKey: "gross",
        useDynamicAccountKey: "debitAccountCode",
      },
      { role: "PAYROLL_PAYABLE", side: "CREDIT", amountKey: "net" },
      { role: "PAYROLL_TAX_PAYABLE", side: "CREDIT", amountKey: "tax" },
    ],
  },
  NETTING: {
    id: "NETTING",
    kinds: [...ALL_KINDS],
    lines: [
      { role: "SUPPLIER_PAYABLE", side: "DEBIT", amountKey: "main" },
      { role: "TRADE_RECEIVABLE", side: "CREDIT", amountKey: "main" },
    ],
  },
  COGS_ON_SALE: {
    id: "COGS_ON_SALE",
    kinds: [...ALL_KINDS],
    lines: [
      { role: "COGS", side: "DEBIT", amountKey: "main" },
      { role: "INVENTORY_GOODS", side: "CREDIT", amountKey: "main" },
    ],
  },
  BUDGET_APPROPRIATION: {
    id: "BUDGET_APPROPRIATION",
    kinds: [OrganizationKind.BUDGET],
    lines: [
      { role: "BANK_SETTLEMENT", side: "DEBIT", amountKey: "main" },
      { role: "BUDGET_FUNDING_RECEIVED", side: "CREDIT", amountKey: "main" },
    ],
  },
  BUDGET_EXPENSE_EXECUTION: {
    id: "BUDGET_EXPENSE_EXECUTION",
    kinds: [OrganizationKind.BUDGET],
    lines: [
      {
        role: "BUDGET_PAYROLL_EXPENSE",
        side: "DEBIT",
        amountKey: "main",
        useDynamicAccountKey: "debitAccountCode",
      },
      { role: "BANK_SETTLEMENT", side: "CREDIT", amountKey: "main" },
    ],
  },
  NGO_GRANT_INCOME: {
    id: "NGO_GRANT_INCOME",
    kinds: [OrganizationKind.NGO],
    lines: [
      { role: "BANK_SETTLEMENT", side: "DEBIT", amountKey: "main" },
      { role: "GRANT_REVENUE", side: "CREDIT", amountKey: "main" },
    ],
  },
  FX_GAIN: {
    id: "FX_GAIN",
    kinds: [...ALL_KINDS],
    lines: [
      { role: "CASH_AZN", side: "DEBIT", amountKey: "main", useDynamicAccountKey: "debitAccountCode" },
      { role: "FX_GAIN", side: "CREDIT", amountKey: "main" },
    ],
  },
  FX_LOSS: {
    id: "FX_LOSS",
    kinds: [...ALL_KINDS],
    lines: [
      { role: "FX_LOSS", side: "DEBIT", amountKey: "main" },
      { role: "CASH_AZN", side: "CREDIT", amountKey: "main", useDynamicAccountKey: "creditAccountCode" },
    ],
  },
  INVENTORY_SURPLUS: {
    id: "INVENTORY_SURPLUS",
    kinds: [...ALL_KINDS],
    lines: [
      { role: "INVENTORY_GOODS", side: "DEBIT", amountKey: "main" },
      { role: "INVENTORY_SURPLUS_INCOME", side: "CREDIT", amountKey: "main" },
    ],
  },
  INVENTORY_WRITE_OFF: {
    id: "INVENTORY_WRITE_OFF",
    kinds: [...ALL_KINDS],
    lines: [
      { role: "MISC_OPERATING_EXPENSE", side: "DEBIT", amountKey: "main" },
      { role: "INVENTORY_GOODS", side: "CREDIT", amountKey: "main" },
    ],
  },
  INVENTORY_ACCOUNTABLE: {
    id: "INVENTORY_ACCOUNTABLE",
    kinds: [...ALL_KINDS],
    lines: [
      { role: "ACCOUNTABLE_PERSONS", side: "DEBIT", amountKey: "main" },
      { role: "INVENTORY_GOODS", side: "CREDIT", amountKey: "main" },
    ],
  },
  DEPRECIATION: {
    id: "DEPRECIATION",
    kinds: [...ALL_KINDS],
    lines: [
      { role: "DEPRECIATION_EXPENSE", side: "DEBIT", amountKey: "main" },
      { role: "ACCUMULATED_DEPRECIATION", side: "CREDIT", amountKey: "main" },
    ],
  },
  MANUFACTURING_WIP: {
    id: "MANUFACTURING_WIP",
    kinds: [...ALL_KINDS],
    lines: [
      { role: "WIP_MANUFACTURING", side: "DEBIT", amountKey: "main" },
      { role: "INVENTORY_GOODS", side: "CREDIT", amountKey: "main" },
    ],
  },
  MANUFACTURING_OVERHEAD: {
    id: "MANUFACTURING_OVERHEAD",
    kinds: [...ALL_KINDS],
    lines: [
      { role: "WIP_MANUFACTURING", side: "DEBIT", amountKey: "main" },
      { role: "MANUFACTURING_OVERHEAD_CREDIT", side: "CREDIT", amountKey: "main" },
    ],
  },
  CASH_IN_TRANSIT: {
    id: "CASH_IN_TRANSIT",
    kinds: [...ALL_KINDS],
    lines: [
      { role: "CASH_IN_TRANSIT", side: "DEBIT", amountKey: "main" },
      { role: "CASH_AZN", side: "CREDIT", amountKey: "main" },
    ],
  },
  VAT_NETTING: {
    id: "VAT_NETTING",
    kinds: [...ALL_KINDS],
    lines: [
      { role: "VAT_OUTPUT", side: "DEBIT", amountKey: "main" },
      { role: "VAT_INPUT", side: "CREDIT", amountKey: "main" },
    ],
  },
};

/** Commercial invoice pair 211+601 — forbidden for BUDGET auto-posting. */
export const BUDGET_FORBIDDEN_COMMERCIAL_INVOICE_CODES = new Set(["211", "601"]);

export function getPostingSchema(schemaId: PostingSchemaId): PostingSchemaDefinition {
  const schema = POSTING_SCHEMAS[schemaId];
  if (!schema) throw new Error(`Unknown posting schema: ${schemaId}`);
  return schema;
}

export function assertSchemaAllowedForKind(
  kind: OrganizationKind,
  schemaId: PostingSchemaId,
): void {
  const schema = getPostingSchema(schemaId);
  if (!schema.kinds.includes(kind)) {
    throw new Error(`Schema ${schemaId} is not allowed for organization kind ${kind}`);
  }
}
