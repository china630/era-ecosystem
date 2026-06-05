"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestInventoryService = exports.mockGovBudgetService = exports.mockContractsService = exports.createMockPostingJournalBuilder = exports.createMockPostingResolver = void 0;
const database_1 = require("@erafinance/database");
const posting_schema_registry_1 = require("../../src/accounting/posting/posting-schema-registry");
const inventory_service_1 = require("../../src/inventory/inventory.service");
const COMMERCIAL_BY_ROLE = {
    TRADE_RECEIVABLE: "211",
    SALES_REVENUE: "601",
    SUPPLIER_PAYABLE: "531",
    INVENTORY_GOODS: "201",
    COGS: "701",
    PAYROLL_EXPENSE: "721",
    PAYROLL_PAYABLE: "533",
    PAYROLL_TAX_PAYABLE: "521",
    CASH_AZN: "101.01",
    CASH_FOREIGN: "102.01",
    MISC_OPERATING_EXPENSE: "731",
    INVENTORY_SURPLUS_INCOME: "631",
    FINISHED_GOODS: "204",
    PREPAID_ASSET: "133",
    CHARTER_CAPITAL: "821",
    VAT_INPUT: "241",
    VAT_OUTPUT: "541",
    ACCOUNTABLE_PERSONS: "244",
    FX_GAIN: "662",
    FX_LOSS: "762",
    TRANSIT_TRANSFER: "231",
    CASH_IN_TRANSIT: "251",
    FOUNDER_FUNDS: "545",
    MAIN_BANK: "221",
    BANK_SETTLEMENT: "221",
    DEPRECIATION_EXPENSE: "713",
    ACCUMULATED_DEPRECIATION: "112",
    WIP_MANUFACTURING: "203",
    MANUFACTURING_OVERHEAD_CREDIT: "741",
};
function createMockPostingResolver() {
    return {
        resolveAccountCode: jest.fn(async (_orgId, role) => {
            const code = COMMERCIAL_BY_ROLE[role];
            if (!code)
                throw new Error(`mock posting: missing role ${role}`);
            return code;
        }),
        getOrganizationKind: jest.fn(),
        resolveMany: jest.fn(),
        commercialPresetCode: jest.fn((role) => {
            const code = COMMERCIAL_BY_ROLE[role];
            if (!code)
                throw new Error(`mock posting: missing role ${role}`);
            return code;
        }),
        warmCommercialTemplateCache: jest.fn(),
    };
}
exports.createMockPostingResolver = createMockPostingResolver;
function createMockPostingJournalBuilder(accounting, posting = createMockPostingResolver()) {
    return {
        postInTransaction: jest.fn(async (tx, params) => {
            if (accounting?.postJournalInTransaction) {
                const schema = (0, posting_schema_registry_1.getPostingSchema)(params.schemaId);
                const lines = [];
                for (const row of schema.lines) {
                    const raw = params.amounts[row.amountKey];
                    if (raw == null)
                        continue;
                    const amount = new database_1.Prisma.Decimal(raw);
                    if (amount.lte(0))
                        continue;
                    let accountCode;
                    if (row.useDynamicAccountKey &&
                        params.dynamicAccounts?.[row.useDynamicAccountKey]) {
                        accountCode = params.dynamicAccounts[row.useDynamicAccountKey].trim();
                    }
                    else {
                        accountCode = await posting.resolveAccountCode(params.organizationId, row.role, tx);
                    }
                    lines.push({
                        accountCode,
                        debit: row.side === "DEBIT" ? amount.toString() : 0,
                        credit: row.side === "CREDIT" ? amount.toString() : 0,
                    });
                }
                return accounting.postJournalInTransaction(tx, {
                    organizationId: params.organizationId,
                    date: params.date,
                    reference: params.reference,
                    description: params.description,
                    counterpartyId: params.counterpartyId,
                    lines,
                });
            }
            return { transactionId: "txn-schema-1" };
        }),
        buildLines: jest.fn(),
    };
}
exports.createMockPostingJournalBuilder = createMockPostingJournalBuilder;
exports.mockContractsService = {};
exports.mockGovBudgetService = { checkLimit: jest.fn() };
function createTestInventoryService(prisma, accounting, stock, access) {
    const posting = createMockPostingResolver();
    return new inventory_service_1.InventoryService(prisma, accounting, stock, access, exports.mockContractsService, exports.mockGovBudgetService, posting, createMockPostingJournalBuilder(accounting, posting));
}
exports.createTestInventoryService = createTestInventoryService;
