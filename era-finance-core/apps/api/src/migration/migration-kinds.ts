import { MigrationDraftKind } from "@erafinance/database";

/** URL / UI kind codes (kebab). */
export const MIGRATION_MASTER_KINDS = [
  "counterparties",
  "products",
  "warehouses",
  "recipes",
] as const;

export const MIGRATION_DRAFT_KINDS = [
  "stock",
  "open-items",
  "advances",
  "cash-bank",
  "hr-balances",
  "payroll-liabilities",
  "fixed-assets",
  "capital",
  "vat-register",
] as const;

export type MigrationMasterKind = (typeof MIGRATION_MASTER_KINDS)[number];
export type MigrationDraftKindSlug = (typeof MIGRATION_DRAFT_KINDS)[number];
export type MigrationUploadKind = MigrationMasterKind | MigrationDraftKindSlug;

export const ALL_MIGRATION_UPLOAD_KINDS: MigrationUploadKind[] = [
  ...MIGRATION_MASTER_KINDS,
  ...MIGRATION_DRAFT_KINDS,
];

export function isMasterKind(kind: string): kind is MigrationMasterKind {
  return (MIGRATION_MASTER_KINDS as readonly string[]).includes(kind);
}

export function isDraftKindSlug(kind: string): kind is MigrationDraftKindSlug {
  return (MIGRATION_DRAFT_KINDS as readonly string[]).includes(kind);
}

export function draftSlugToEnum(kind: MigrationDraftKindSlug): MigrationDraftKind {
  const map: Record<MigrationDraftKindSlug, MigrationDraftKind> = {
    stock: MigrationDraftKind.STOCK,
    "open-items": MigrationDraftKind.OPEN_ITEMS,
    advances: MigrationDraftKind.ADVANCES,
    "cash-bank": MigrationDraftKind.CASH_BANK,
    "hr-balances": MigrationDraftKind.HR_BALANCES,
    "payroll-liabilities": MigrationDraftKind.PAYROLL_LIABILITIES,
    "fixed-assets": MigrationDraftKind.FIXED_ASSETS,
    capital: MigrationDraftKind.CAPITAL,
    "vat-register": MigrationDraftKind.VAT_REGISTER,
  };
  return map[kind];
}

export function draftEnumToSlug(kind: MigrationDraftKind): MigrationDraftKindSlug {
  const map: Record<MigrationDraftKind, MigrationDraftKindSlug> = {
    STOCK: "stock",
    OPEN_ITEMS: "open-items",
    ADVANCES: "advances",
    CASH_BANK: "cash-bank",
    HR_BALANCES: "hr-balances",
    PAYROLL_LIABILITIES: "payroll-liabilities",
    FIXED_ASSETS: "fixed-assets",
    CAPITAL: "capital",
    VAT_REGISTER: "vat-register",
  };
  return map[kind];
}

export type TemplateColumn = { key: string; sample: string | number | boolean };

export const TEMPLATE_SPECS: Record<
  MigrationUploadKind,
  { sheet: string; columns: TemplateColumn[]; howto: string[] }
> = {
  counterparties: {
    sheet: "counterparties",
    columns: [
      { key: "partyKind", sample: "company" },
      { key: "voen", sample: "1234567890" },
      { key: "name", sample: "Nafta LLC" },
      { key: "legalForm", sample: "LLC" },
    ],
    howto: [
      "Key: voen (10 digits). Existing VÖEN is not updated.",
      "partyKind: company or agency only.",
      "legalForm: LLC, OJSC, etc. INDIVIDUAL is rejected.",
    ],
  },
  products: {
    sheet: "products",
    columns: [
      { key: "sku", sample: "TEA-01" },
      { key: "name", sample: "Tea" },
      { key: "price", sample: 4 },
      { key: "vatRate", sample: 18 },
      { key: "isService", sample: "false" },
      { key: "revenueAccountCode", sample: "601" },
      { key: "category", sample: "Drinks" },
    ],
    howto: [
      "Key: sku. Existing SKU is not updated.",
      "isService: true/false. Services must not appear in stock drafts.",
    ],
  },
  warehouses: {
    sheet: "warehouses",
    columns: [
      { key: "code", sample: "MAIN" },
      { key: "name", sample: "Main warehouse" },
    ],
    howto: ["Key: code. Existing code is not updated."],
  },
  recipes: {
    sheet: "recipes",
    columns: [
      { key: "dishSku", sample: "MENU-TEA" },
      { key: "componentSku", sample: "TEA-01" },
      { key: "quantity", sample: 1 },
    ],
    howto: [
      "Key: dishSku. Before assemble, upload replaces the full BOM for that dish.",
      "After assemble, existing dish BOM is not overwritten.",
    ],
  },
  stock: {
    sheet: "stock",
    columns: [
      { key: "sku", sample: "TEA-01" },
      { key: "warehouseCode", sample: "MAIN" },
      { key: "quantity", sample: 100 },
      { key: "costPrice", sample: 2.5 },
    ],
    howto: ["Staging only until Assemble. Services are rejected on validate."],
  },
  "open-items": {
    sheet: "open_items",
    columns: [
      { key: "side", sample: "ar" },
      { key: "documentNumber", sample: "INV-100" },
      { key: "documentDate", sample: "2026-01-01" },
      { key: "dueDate", sample: "2026-01-31" },
      { key: "voen", sample: "1234567890" },
      { key: "amount", sample: 500 },
      { key: "accountCode", sample: "211" },
    ],
    howto: [
      "side: ar (receivable → Invoice) or ap (payable → JE + opening Transaction with counterparty).",
      "Key: side + documentNumber.",
    ],
  },
  advances: {
    sheet: "advances",
    columns: [
      { key: "kind", sample: "city_ledger" },
      { key: "partyCode", sample: "AG-01" },
      { key: "stayRef", sample: "RES-1" },
      { key: "amount", sample: 120 },
      { key: "accountCode", sample: "171" },
    ],
    howto: [
      "PARTIAL / GL-only: posts opening JE; does not create hotel City Ledger entities in Finance.",
      "kind: guest_deposit or city_ledger. partyCode = agency code or VÖEN.",
    ],
  },
  "cash-bank": {
    sheet: "cash_bank",
    columns: [
      { key: "accountCode", sample: "221" },
      { key: "iban", sample: "AZ21NABZ00000000137010001944" },
      { key: "amount", sample: 10000 },
    ],
    howto: ["Cash: leave iban empty. Bank: iban must match an org bank account."],
  },
  "hr-balances": {
    sheet: "hr_balances",
    columns: [
      { key: "cpEmploymentId", sample: "00000000-0000-0000-0000-000000000001" },
      { key: "salaryDebt", sample: 800 },
      { key: "vacationDays", sample: 10 },
      { key: "avgMonthlySalary", sample: 1200 },
    ],
    howto: ["Does not create employees. Pull workforce first. Key: cpEmploymentId."],
  },
  "payroll-liabilities": {
    sheet: "payroll_liabilities",
    columns: [
      { key: "liabilityKind", sample: "income_tax" },
      { key: "cpEmploymentId", sample: "" },
      { key: "amount", sample: 200 },
      { key: "accountCode", sample: "522" },
    ],
    howto: [
      "liabilityKind: income_tax | dsmf | medical | accountable_advance",
      "cpEmploymentId optional for org-level tax totals.",
    ],
  },
  "fixed-assets": {
    sheet: "fixed_assets",
    columns: [
      { key: "inventoryNumber", sample: "FA-001" },
      { key: "name", sample: "Laptop" },
      { key: "accountCode", sample: "111" },
      { key: "originalCost", sample: 2000 },
      { key: "accumulatedDepreciation", sample: 400 },
      { key: "method", sample: "STRAIGHT_LINE" },
      { key: "remainingLifeMonths", sample: 36 },
      { key: "lastDepreciationYearMonth", sample: "2025-12" },
    ],
    howto: ["Key: inventoryNumber. method: STRAIGHT_LINE | REDUCING_BALANCE | UNITS_OF_PRODUCTION."],
  },
  capital: {
    sheet: "capital",
    columns: [
      { key: "accountCode", sample: "301" },
      { key: "amount", sample: 50000 },
    ],
    howto: ["Closes technical account 000 on assemble."],
  },
  "vat-register": {
    sheet: "vat_register",
    columns: [
      { key: "direction", sample: "purchase" },
      { key: "period", sample: "2026-Q1" },
      { key: "voen", sample: "1234567890" },
      { key: "documentNumber", sample: "EQ-1" },
      { key: "netAmount", sample: 100 },
      { key: "vatAmount", sample: 18 },
    ],
    howto: [
      "Evidence only: rows stay as draft evidence; assemble does not post GL.",
      "direction: purchase or sale. Transitional VAT register archive.",
    ],
  },
};
