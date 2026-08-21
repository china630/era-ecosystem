import { BadRequestException, ForbiddenException, HttpException } from "@nestjs/common";
import { UserRole } from "@erafinance/database";
import { AccountingService } from "../src/accounting/accounting.service";
import { ManualAdjustmentService } from "../src/accounting/manual-adjustment.service";
import type { PostingAccountResolver } from "../src/accounting/posting/posting-account-resolver.service";
import type { PrismaService } from "../src/prisma/prisma.service";

describe("Finance GL negative paths (AC-FIN-GL)", () => {
  const noop = {} as never;
  const posting = {
    resolveAccountCode: jest.fn(),
  } as unknown as PostingAccountResolver;

  function makeService(prisma: PrismaService): AccountingService {
    return new AccountingService(prisma, noop, posting, noop);
  }

  it("validateBalance refuses unbalanced journal lines", () => {
    const svc = makeService({} as PrismaService);
    expect(() =>
      svc.validateBalance([
        { accountCode: "211", debit: "100", credit: "0" },
        { accountCode: "601", debit: "0", credit: "50" },
      ]),
    ).toThrow(BadRequestException);
    try {
      svc.validateBalance([
        { accountCode: "211", debit: "100", credit: "0" },
        { accountCode: "601", debit: "0", credit: "50" },
      ]);
    } catch (err) {
      expect((err as BadRequestException).message).toMatch(/Unbalanced transaction/i);
    }
  });

  it("postJournalInTransaction refuses posting into a closed period", async () => {
    const tx = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          settings: { reporting: { closedPeriods: ["2026-01"] } },
          kind: "COMMERCIAL",
        }),
      },
    };
    const svc = makeService({} as PrismaService);
    await expect(
      svc.postJournalInTransaction(tx as never, {
        organizationId: "org-1",
        date: new Date(Date.UTC(2026, 0, 15)),
        lines: [
          { accountCode: "211", debit: "10", credit: "0" },
          { accountCode: "601", debit: "0", credit: "10" },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    try {
      await svc.postJournalInTransaction(tx as never, {
        organizationId: "org-1",
        date: new Date(Date.UTC(2026, 0, 15)),
        lines: [
          { accountCode: "211", debit: "10", credit: "0" },
          { accountCode: "601", debit: "0", credit: "10" },
        ],
      });
    } catch (err) {
      expect((err as BadRequestException).message).toMatch(/закрыт|closed/i);
    }
  });

  it("postJournalInTransaction refuses when ledger lockedPeriodUntil blocks date", async () => {
    const tx = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          settings: { ledger: { lockedPeriodUntil: "2026-03-31" } },
          kind: "COMMERCIAL",
        }),
      },
    };
    const svc = makeService({} as PrismaService);
    await expect(
      svc.postJournalInTransaction(tx as never, {
        organizationId: "org-1",
        date: new Date(Date.UTC(2026, 2, 1)),
        lines: [
          { accountCode: "211", debit: "10", credit: "0" },
          { accountCode: "601", debit: "0", credit: "10" },
        ],
      }),
    ).rejects.toBeInstanceOf(HttpException);
  });
});

describe("Finance GL manual adjustment negatives (AC-FIN-GL)", () => {
  const orgId = "00000000-0000-0000-0000-000000000001";
  const validBody = {
    date: "2026-08-20",
    reason: "Returned 5 AZN over-collection; original invoice not changed",
    template: "AR_OVERCOLLECTION_REFUND" as const,
    lines: [
      { accountCode: "211", debit: 5, credit: 0 },
      { accountCode: "101.01", debit: 0, credit: 5 },
    ],
  };

  function makeSvc(opts?: {
    postTransaction?: jest.Mock;
    prisma?: Partial<PrismaService>;
  }): ManualAdjustmentService {
    const accounting = {
      postTransaction:
        opts?.postTransaction ?? jest.fn().mockResolvedValue({ transactionId: "tx-1" }),
    } as unknown as AccountingService;
    const prisma = (opts?.prisma ?? {
      counterparty: { findFirst: jest.fn() },
      invoice: { findFirst: jest.fn() },
    }) as unknown as PrismaService;
    const posting = { resolveAccountCode: jest.fn() } as unknown as PostingAccountResolver;
    return new ManualAdjustmentService(prisma, accounting, posting);
  }

  it("create refuses short reason without posting", async () => {
    const postTransaction = jest.fn();
    const svc = makeSvc({ postTransaction });
    await expect(
      svc.create(orgId, { ...validBody, reason: "short" }, UserRole.ACCOUNTANT),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(postTransaction).not.toHaveBeenCalled();
  });

  it("create refuses USER role without posting", async () => {
    const postTransaction = jest.fn();
    const svc = makeSvc({ postTransaction });
    await expect(svc.create(orgId, validBody, UserRole.USER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(postTransaction).not.toHaveBeenCalled();
  });

  it("create refuses counterparty from another organization", async () => {
    const postTransaction = jest.fn();
    const prisma = {
      counterparty: { findFirst: jest.fn().mockResolvedValue(null) },
      invoice: { findFirst: jest.fn() },
    } as unknown as PrismaService;
    const svc = makeSvc({ postTransaction, prisma });
    await expect(
      svc.create(
        orgId,
        { ...validBody, counterpartyId: "00000000-0000-0000-0000-0000000000f1" },
        UserRole.ACCOUNTANT,
      ),
    ).rejects.toBeInstanceOf(HttpException);
    expect(postTransaction).not.toHaveBeenCalled();
  });

  it("create refuses AR template without counterparty", async () => {
    const postTransaction = jest.fn();
    const svc = makeSvc({ postTransaction });
    await expect(
      svc.create(
        orgId,
        {
          ...validBody,
          counterpartyId: undefined,
          template: "AR_WRITEOFF",
          lines: [
            { accountCode: "731", debit: 5, credit: 0 },
            { accountCode: "211", debit: 0, credit: 5 },
          ],
        },
        UserRole.ACCOUNTANT,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(postTransaction).not.toHaveBeenCalled();
  });
});
