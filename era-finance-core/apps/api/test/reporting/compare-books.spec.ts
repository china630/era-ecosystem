import { AccountType, Decimal } from "@erafinance/database";

jest.mock("../../src/accounting/accounting.service", () => ({
  AccountingService: class AccountingService {},
}));

import { ReportingService } from "../../src/reporting/reporting.service";
import type { PrismaService } from "../../src/prisma/prisma.service";

describe("ReportingService compareBooks", () => {
  it("scopes accounts and journal totals by accountingBookId", async () => {
    const organizationId = "00000000-0000-0000-0000-000000000001";
    const bookA = "00000000-0000-0000-0000-000000000101";
    const bookB = "00000000-0000-0000-0000-000000000102";
    const accountA = "00000000-0000-0000-0000-000000000201";
    const accountB = "00000000-0000-0000-0000-000000000202";
    const groupBy = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          accountId: accountA,
          _sum: { debit: new Decimal(12), credit: new Decimal(12) },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          accountId: accountB,
          _sum: { debit: new Decimal(8), credit: new Decimal(8) },
        },
      ]);
    const prisma = {
      accountingBook: {
        findMany: jest.fn().mockResolvedValue([
          { id: bookA, code: "NAS", status: "ACTIVE" },
          { id: bookB, code: "MGMT", status: "ACTIVE" },
        ]),
      },
      account: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: accountA,
              code: "1000",
              nameAz: "A",
              nameRu: "A",
              nameEn: "A",
              type: AccountType.ASSET,
            },
          ])
          .mockResolvedValueOnce([
            {
              id: accountB,
              code: "M1000",
              nameAz: "M",
              nameRu: "M",
              nameEn: "M",
              type: AccountType.ASSET,
            },
          ]),
      },
      journalEntry: { groupBy },
    } as unknown as PrismaService;
    const service = new ReportingService(
      prisma,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      {
        resolveByIdOrLedgerAlias: jest.fn(),
      } as never,
    );

    const result = await service.compareBooks(
      organizationId,
      bookA,
      bookB,
      "2026-09-01",
      "2026-09-30",
    );

    expect(result.bookA.totals.periodDebit).toBe("12.0000");
    expect(result.bookB.totals.periodDebit).toBe("8.0000");
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountingBookId: bookA }),
      }),
    );
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountingBookId: bookB }),
      }),
    );
  });
});
