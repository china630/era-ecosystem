import { Test } from "@nestjs/testing";
import { AuditHubNasIfrsService } from "../../src/audit-hub/audit-hub-nas-ifrs.service";
import { PrismaService } from "../../src/prisma/prisma.service";

describe("AuditHubNasIfrsService", () => {
  it("maps asymmetry rows and skips totals query when flag off", async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            transactionId: "t1",
            date: new Date("2024-06-15"),
            reference: "REF-1",
            opsBookId: "00000000-0000-0000-0000-000000000010",
            opsBookCode: "NAS",
            targetBookId: "00000000-0000-0000-0000-000000000011",
            targetBookCode: "MGMT",
            targetBookName: "Management",
            hasOps: true,
            hasTarget: false,
          },
        ])
        .mockResolvedValueOnce([{ count: 2 }])
        .mockResolvedValueOnce([
          {
            accountingBookId: "00000000-0000-0000-0000-000000000099",
            bookCode: "MGMT",
            bookName: "Management",
            transactionCount: 3,
          },
        ]),
      transaction: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const mod = await Test.createTestingModule({
      providers: [
        AuditHubNasIfrsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const svc = mod.get(AuditHubNasIfrsService);
    const out = await svc.report("00000000-0000-0000-0000-000000000001", {
      from: "2024-06-01",
      to: "2024-06-30",
      take: 50,
      includeTotalsMismatch: false,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    expect(out.includeTotalsMismatch).toBe(false);
    expect(out.items).toHaveLength(1);
    expect(out.items[0]).toMatchObject({
      transactionId: "t1",
      date: "2024-06-15",
      reference: "REF-1",
      opsBookCode: "NAS",
      targetBookCode: "MGMT",
      issue: "MISSING_TARGET_BOOK",
    });
    expect(out.totalsMismatchItems).toEqual([]);
    expect(out.intentionalIfrsOnlyCount).toBe(2);
    expect(out.intentionalNonOpsBookCount).toBe(3);
    expect(out.intentionalNonOpsBookBreakdown[0]).toMatchObject({
      bookCode: "MGMT",
      transactionCount: 3,
    });
  });

  it("runs second query when includeTotalsMismatch is true", async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            transactionId: "t2",
            date: new Date("2024-05-01"),
            reference: null,
            opsBookId: "00000000-0000-0000-0000-000000000010",
            opsBookCode: "NAS",
            targetBookId: "00000000-0000-0000-0000-000000000011",
            targetBookCode: "IFRS",
            opsDebitSum: "100.5",
            targetDebitSum: "200.1",
          },
        ])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([]),
      transaction: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const mod = await Test.createTestingModule({
      providers: [
        AuditHubNasIfrsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const svc = mod.get(AuditHubNasIfrsService);
    const out = await svc.report("00000000-0000-0000-0000-000000000001", {
      from: "2024-05-01",
      to: "2024-05-31",
      take: 20,
      includeTotalsMismatch: true,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
    expect(out.totalsMismatchItems).toHaveLength(1);
    expect(out.totalsMismatchItems[0]).toMatchObject({
      transactionId: "t2",
      issue: "TOTAL_DEBIT_MISMATCH",
      nasDebitSum: "100.5",
      ifrsDebitSum: "200.1",
    });
  });
});
