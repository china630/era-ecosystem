"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockGovBudgetService = exports.mockContractsService = void 0;
exports.createMockPostingResolver = createMockPostingResolver;
exports.createMockPostingJournalBuilder = createMockPostingJournalBuilder;
exports.createTestInventoryService = createTestInventoryService;
const database_1 = require("@erafinance/database");
const posting_schema_registry_1 = require("../../src/accounting/posting/posting-schema-registry");
const inventory_service_1 = require("../../src/inventory/inventory.service");
const ledger_constants_1 = require("../../src/ledger.constants");
const COMMERCIAL_BY_ROLE = {
    TRADE_RECEIVABLE: ledger_constants_1.RECEIVABLE_ACCOUNT_CODE,
    SALES_REVENUE: ledger_constants_1.REVENUE_ACCOUNT_CODE,
    SUPPLIER_PAYABLE: ledger_constants_1.PAYABLE_SUPPLIERS_ACCOUNT_CODE,
    INVENTORY_GOODS: ledger_constants_1.INVENTORY_GOODS_ACCOUNT_CODE,
    COGS: ledger_constants_1.COGS_ACCOUNT_CODE,
    PAYROLL_EXPENSE: ledger_constants_1.PAYROLL_EXPENSE_ACCOUNT_CODE,
    PAYROLL_PAYABLE: ledger_constants_1.PAYROLL_PAYABLE_ACCOUNT_CODE,
    PAYROLL_TAX_PAYABLE: ledger_constants_1.PAYROLL_TAX_PAYABLE_ACCOUNT_CODE,
    CASH_AZN: "101.01",
    CASH_FOREIGN: "102.01",
    MISC_OPERATING_EXPENSE: "731",
    INVENTORY_SURPLUS_INCOME: "631",
    FINISHED_GOODS: "204",
    VAT_INPUT: "241",
    VAT_OUTPUT: "541",
    ACCOUNTABLE_PERSONS: "244",
    FX_GAIN: ledger_constants_1.FX_GAIN_ACCOUNT_CODE,
    FX_LOSS: ledger_constants_1.FX_LOSS_ACCOUNT_CODE,
    TRANSIT_TRANSFER: ledger_constants_1.TRANSIT_TRANSFER_ACCOUNT_CODE,
    CASH_IN_TRANSIT: ledger_constants_1.CASH_IN_TRANSIT_ACCOUNT_CODE,
    FOUNDER_FUNDS: ledger_constants_1.FOUNDER_FUNDS_ACCOUNT_CODE,
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
exports.mockContractsService = {};
exports.mockGovBudgetService = { checkLimit: jest.fn() };
function createTestInventoryService(prisma, accounting, stock, access) {
    const posting = createMockPostingResolver();
    return new inventory_service_1.InventoryService(prisma, accounting, stock, access, exports.mockContractsService, exports.mockGovBudgetService, posting, createMockPostingJournalBuilder(accounting, posting));
}
//# sourceMappingURL=mock-posting-resolver.js.map