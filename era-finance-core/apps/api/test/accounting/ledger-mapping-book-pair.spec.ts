import { BadRequestException } from "@nestjs/common";
import { LedgerMappingSetStatus } from "@erafinance/database";
import { LedgerMappingService } from "../../src/accounting/ledger-mapping.service";
import type { PrismaService } from "../../src/prisma/prisma.service";

describe("LedgerMappingService arbitrary book pairs", () => {
  const organizationId = "00000000-0000-0000-0000-000000000001";
  const fromBookId = "00000000-0000-0000-0000-000000000101";
  const toBookId = "00000000-0000-0000-0000-000000000102";

  it("requires different active source and target books", async () => {
    const prisma = {
      accountingBook: { findMany: jest.fn() },
    } as unknown as PrismaService;
    const service = new LedgerMappingService(prisma);

    await expect(
      service.createDraftForPair(organizationId, fromBookId, fromBookId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.accountingBook.findMany).not.toHaveBeenCalled();
  });

  it("rejects mapping lines whose accounts do not belong to the set books", async () => {
    const sourceAccountId = "00000000-0000-0000-0000-000000000201";
    const targetAccountId = "00000000-0000-0000-0000-000000000202";
    const prisma = {
      ledgerMappingSet: {
        findFirst: jest.fn().mockResolvedValue({
          id: "00000000-0000-0000-0000-000000000301",
          organizationId,
          status: LedgerMappingSetStatus.DRAFT,
          fromBookId,
          toBookId,
        }),
      },
      accountingBook: {
        findMany: jest.fn().mockResolvedValue([
          { id: fromBookId, code: "MGMT" },
          { id: toBookId, code: "TAX" },
        ]),
      },
      account: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: sourceAccountId,
            accountingBookId: toBookId,
            type: "ASSET",
            deletedAt: null,
          },
          {
            id: targetAccountId,
            accountingBookId: toBookId,
            type: "ASSET",
            deletedAt: null,
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new LedgerMappingService(prisma);

    await expect(
      service.replaceDraftLines(
        organizationId,
        "00000000-0000-0000-0000-000000000301",
        [{ sourceAccountId, targetAccountId }],
      ),
    ).rejects.toThrow("sourceAccountId must be an active account in fromBookId");
  });
});
