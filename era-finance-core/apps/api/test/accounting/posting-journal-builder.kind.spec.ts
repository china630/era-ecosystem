import { OrganizationKind, Prisma } from "@erafinance/database";
import { PostingJournalBuilder } from "../../src/accounting/posting/posting-journal-builder.service";
import type { PostingAccountResolver } from "../../src/accounting/posting/posting-account-resolver.service";
import type { AccountingService } from "../../src/accounting/accounting.service";

const BUDGET_CODES: Record<string, string> = {
  TRADE_RECEIVABLE: "111-1",
  SALES_REVENUE: "611-1",
  BANK_SETTLEMENT: "103",
  BUDGET_FUNDING_RECEIVED: "334",
  BUDGET_PAYROLL_EXPENSE: "711",
  GRANT_REVENUE: "603",
};

function mockResolver(kind: OrganizationKind): PostingAccountResolver {
  return {
    getOrganizationKind: jest.fn().mockResolvedValue(kind),
    resolveAccountCode: jest.fn(async (_org: string, role: string) => {
      const code = BUDGET_CODES[role];
      if (!code) throw new Error(`missing ${role}`);
      return code;
    }),
  } as unknown as PostingAccountResolver;
}

describe("PostingJournalBuilder per kind", () => {
  it("BUDGET INVOICE_REVENUE resolves to 111-1 / 611-1", async () => {
    const posted: Array<{ lines: { accountCode: string }[] }> = [];
    const accounting = {
      validateBalance: jest.fn(),
      postJournalInTransaction: jest.fn(async (_tx, params) => {
        posted.push(params);
        return { transactionId: "txn-1" };
      }),
    } as unknown as AccountingService;

    const builder = new PostingJournalBuilder(
      mockResolver(OrganizationKind.BUDGET),
      accounting,
    );

    await builder.postInTransaction({} as Prisma.TransactionClient, {
      organizationId: "org-budget",
      schemaId: "INVOICE_REVENUE_RECOGNITION",
      amounts: { main: 100 },
      date: new Date("2026-05-01T12:00:00.000Z"),
      description: "test",
    });

    expect(posted[0]?.lines.map((l) => l.accountCode).sort()).toEqual([
      "111-1",
      "611-1",
    ]);
  });

  it("BUDGET rejects commercial codes on INVOICE_REVENUE", async () => {
    const resolver = {
      getOrganizationKind: jest.fn().mockResolvedValue(OrganizationKind.BUDGET),
      resolveAccountCode: jest.fn(async () => "211"),
    } as unknown as PostingAccountResolver;
    const accounting = {
      validateBalance: jest.fn(),
      postJournalInTransaction: jest.fn(),
    } as unknown as AccountingService;
    const builder = new PostingJournalBuilder(resolver, accounting);

    await expect(
      builder.postInTransaction({} as Prisma.TransactionClient, {
        organizationId: "org-budget",
        schemaId: "INVOICE_REVENUE_RECOGNITION",
        amounts: { main: 50 },
        date: new Date(),
        description: "bad",
      }),
    ).rejects.toThrow(/cannot post to commercial accounts/);
  });

  it("NGO NGO_GRANT_INCOME uses grant revenue role", async () => {
    const posted: Array<{ lines: { accountCode: string }[] }> = [];
    const ngoCodes = {
      ...BUDGET_CODES,
      BANK_SETTLEMENT: "221",
      GRANT_REVENUE: "603",
    };
    const resolver = {
      getOrganizationKind: jest.fn().mockResolvedValue(OrganizationKind.NGO),
      resolveAccountCode: jest.fn(async (_o, role: string) => ngoCodes[role as keyof typeof ngoCodes] ?? "000"),
    } as unknown as PostingAccountResolver;
    const accounting = {
      validateBalance: jest.fn(),
      postJournalInTransaction: jest.fn(async (_tx, params) => {
        posted.push(params);
        return { transactionId: "txn-grant" };
      }),
    } as unknown as AccountingService;

    const builder = new PostingJournalBuilder(resolver, accounting);
    await builder.postInTransaction({} as Prisma.TransactionClient, {
      organizationId: "org-ngo",
      schemaId: "NGO_GRANT_INCOME",
      amounts: { main: 5000 },
      date: new Date(),
      description: "grant",
    });

    expect(posted[0]?.lines.map((l) => l.accountCode).sort()).toEqual(["221", "603"]);
  });
});
