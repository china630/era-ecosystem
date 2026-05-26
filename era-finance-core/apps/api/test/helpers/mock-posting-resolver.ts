import { Prisma, type PostingRole } from "@erafinance/database";
import type { PostingAccountResolver } from "../../src/accounting/posting/posting-account-resolver.service";
import { getPostingSchema } from "../../src/accounting/posting/posting-schema-registry";
import type { PostingJournalBuilder } from "../../src/accounting/posting/posting-journal-builder.service";
import type { AccountingService } from "../../src/accounting/accounting.service";
import { InventoryService } from "../../src/inventory/inventory.service";
import type { PrismaService } from "../../src/prisma/prisma.service";
import type { StockService } from "../../src/stock/stock.service";
import type { AccessControlService } from "../../src/access/access-control.service";
import {
  COGS_ACCOUNT_CODE,
  CASH_IN_TRANSIT_ACCOUNT_CODE,
  FOUNDER_FUNDS_ACCOUNT_CODE,
  FX_GAIN_ACCOUNT_CODE,
  FX_LOSS_ACCOUNT_CODE,
  INVENTORY_GOODS_ACCOUNT_CODE,
  PAYABLE_SUPPLIERS_ACCOUNT_CODE,
  PAYROLL_EXPENSE_ACCOUNT_CODE,
  PAYROLL_PAYABLE_ACCOUNT_CODE,
  PAYROLL_TAX_PAYABLE_ACCOUNT_CODE,
  RECEIVABLE_ACCOUNT_CODE,
  REVENUE_ACCOUNT_CODE,
  TRANSIT_TRANSFER_ACCOUNT_CODE,
} from "../../src/ledger.constants";

const COMMERCIAL_BY_ROLE: Partial<Record<PostingRole, string>> = {
  TRADE_RECEIVABLE: RECEIVABLE_ACCOUNT_CODE,
  SALES_REVENUE: REVENUE_ACCOUNT_CODE,
  SUPPLIER_PAYABLE: PAYABLE_SUPPLIERS_ACCOUNT_CODE,
  INVENTORY_GOODS: INVENTORY_GOODS_ACCOUNT_CODE,
  COGS: COGS_ACCOUNT_CODE,
  PAYROLL_EXPENSE: PAYROLL_EXPENSE_ACCOUNT_CODE,
  PAYROLL_PAYABLE: PAYROLL_PAYABLE_ACCOUNT_CODE,
  PAYROLL_TAX_PAYABLE: PAYROLL_TAX_PAYABLE_ACCOUNT_CODE,
  CASH_AZN: "101.01",
  CASH_FOREIGN: "102.01",
  MISC_OPERATING_EXPENSE: "731",
  INVENTORY_SURPLUS_INCOME: "631",
  FINISHED_GOODS: "204",
  VAT_INPUT: "241",
  VAT_OUTPUT: "541",
  ACCOUNTABLE_PERSONS: "244",
  FX_GAIN: FX_GAIN_ACCOUNT_CODE,
  FX_LOSS: FX_LOSS_ACCOUNT_CODE,
  TRANSIT_TRANSFER: TRANSIT_TRANSFER_ACCOUNT_CODE,
  CASH_IN_TRANSIT: CASH_IN_TRANSIT_ACCOUNT_CODE,
  FOUNDER_FUNDS: FOUNDER_FUNDS_ACCOUNT_CODE,
  MAIN_BANK: "221",
  BANK_SETTLEMENT: "221",
  DEPRECIATION_EXPENSE: "713",
  ACCUMULATED_DEPRECIATION: "112",
  WIP_MANUFACTURING: "203",
  MANUFACTURING_OVERHEAD_CREDIT: "741",
};

/** Jest mock resolver returning COMMERCIAL preset codes (parity with legacy constants). */
export function createMockPostingResolver(): PostingAccountResolver {
  return {
    resolveAccountCode: jest.fn(async (_orgId: string, role: PostingRole) => {
      const code = COMMERCIAL_BY_ROLE[role];
      if (!code) throw new Error(`mock posting: missing role ${role}`);
      return code;
    }),
    getOrganizationKind: jest.fn(),
    resolveMany: jest.fn(),
    commercialPresetCode: jest.fn((role: PostingRole) => {
      const code = COMMERCIAL_BY_ROLE[role];
      if (!code) throw new Error(`mock posting: missing role ${role}`);
      return code;
    }),
    warmCommercialTemplateCache: jest.fn(),
  } as unknown as PostingAccountResolver;
}

/** Forwards schema posts to `accounting.postJournalInTransaction` when provided. */
export function createMockPostingJournalBuilder(
  accounting?: { postJournalInTransaction?: jest.Mock },
  posting: PostingAccountResolver = createMockPostingResolver(),
): PostingJournalBuilder {
  return {
    postInTransaction: jest.fn(async (tx, params) => {
      if (accounting?.postJournalInTransaction) {
        const schema = getPostingSchema(params.schemaId);
        const lines: Array<{
          accountCode: string;
          debit: string | number;
          credit: string | number;
        }> = [];
        for (const row of schema.lines) {
          const raw = params.amounts[row.amountKey];
          if (raw == null) continue;
          const amount = new Prisma.Decimal(raw);
          if (amount.lte(0)) continue;
          let accountCode: string;
          if (
            row.useDynamicAccountKey &&
            params.dynamicAccounts?.[row.useDynamicAccountKey]
          ) {
            accountCode = params.dynamicAccounts[row.useDynamicAccountKey]!.trim();
          } else {
            accountCode = await posting.resolveAccountCode(
              params.organizationId,
              row.role as PostingRole,
              tx,
            );
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
  } as unknown as PostingJournalBuilder;
}

export const mockContractsService = {} as Record<string, never>;
export const mockGovBudgetService = { checkLimit: jest.fn() } as Record<string, jest.Mock>;

export function createTestInventoryService(
  prisma: PrismaService,
  accounting: AccountingService,
  stock: StockService,
  access: AccessControlService,
): InventoryService {
  const posting = createMockPostingResolver();
  return new InventoryService(
    prisma,
    accounting,
    stock,
    access,
    mockContractsService as never,
    mockGovBudgetService as never,
    posting,
    createMockPostingJournalBuilder(
      accounting as unknown as { postJournalInTransaction?: jest.Mock },
      posting,
    ),
  );
}
