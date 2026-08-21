import { OrganizationKind, Prisma, type PostingRole } from "@erafinance/database";
import type { PostingAccountResolver } from "../../src/accounting/posting/posting-account-resolver.service";
import { getPostingSchema } from "../../src/accounting/posting/posting-schema-registry";
import type { PostingJournalBuilder } from "../../src/accounting/posting/posting-journal-builder.service";
import type { AccountingService } from "../../src/accounting/accounting.service";
import { InventoryService } from "../../src/inventory/inventory.service";
import type { PrismaService } from "../../src/prisma/prisma.service";
import type { StockService } from "../../src/stock/stock.service";
import type { AccessControlService } from "../../src/access/access-control.service";

const COMMERCIAL_BY_ROLE: Partial<Record<PostingRole, string>> = {
  TRADE_RECEIVABLE: "211",
  SALES_REVENUE: "601",
  SUPPLIER_PAYABLE: "531",
  INVENTORY_GOODS: "201",
  COGS: "701",
  PAYROLL_EXPENSE: "721",
  PAYROLL_PAYABLE: "533",
  PAYROLL_TAX_PAYABLE: "521",
  CASH_AZN: "221.01",
  CASH_FOREIGN: "221.11",
  MISC_OPERATING_EXPENSE: "731",
  INVENTORY_SURPLUS_INCOME: "631",
  FINISHED_GOODS: "204",
  PREPAID_ASSET: "133",
  CHARTER_CAPITAL: "821",
  VAT_INPUT: "191",
  VAT_OUTPUT: "545",
  ACCOUNTABLE_PERSONS: "244",
  FX_GAIN: "662",
  FX_LOSS: "762",
  TRANSIT_TRANSFER: "231",
  CASH_IN_TRANSIT: "222",
  FOUNDER_FUNDS: "561",
  MAIN_BANK: "223",
  BANK_SETTLEMENT: "223",
  DEPRECIATION_EXPENSE: "713",
  ACCUMULATED_DEPRECIATION: "112",
  WIP_MANUFACTURING: "203",
  MANUFACTURING_OVERHEAD_CREDIT: "741",
};

/** Jest mock resolver returning COMMERCIAL preset codes. */
export function createMockPostingResolver(): PostingAccountResolver {
  return {
    resolveAccountCode: jest.fn(async (_orgId: string, role: PostingRole) => {
      const code = COMMERCIAL_BY_ROLE[role];
      if (!code) throw new Error(`mock posting: missing role ${role}`);
      return code;
    }),
    getOrganizationKind: jest.fn().mockResolvedValue(OrganizationKind.COMMERCIAL),
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
