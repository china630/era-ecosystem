import { BadRequestException } from "@nestjs/common";
import { LedgerType } from "@erafinance/database";
import { AccountingService } from "../../src/accounting/accounting.service";
import type { IfrsAutoMappingService } from "../../src/accounting/ifrs-auto-mapping.service";
import type { PostingAccountResolver } from "../../src/accounting/posting/posting-account-resolver.service";
import type { SubcontoService } from "../../src/accounting/subconto.service";
import type { PrismaService } from "../../src/prisma/prisma.service";
import type { SubscriptionAccessService } from "../../src/subscription/subscription-access.service";

jest.mock("../../src/subscription/subscription-access.service", () => ({
  SubscriptionAccessService: class SubscriptionAccessService {
    hasModule = jest.fn();
  },
}));

describe("AccountingService closed-period post guard (P1 hardening)", () => {
  function makeSvc(settings: unknown) {
    const tx = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          settings,
          kind: "COMMERCIAL",
        }),
      },
      account: {
        findMany: jest.fn().mockResolvedValue([
          { id: "a1", code: "1200" },
          { id: "a2", code: "4000" },
        ]),
      },
      transaction: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "tx-new" }),
      },
      journalEntry: {
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: "je1" })
          .mockResolvedValueOnce({ id: "je2" }),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    } as unknown as PrismaService;

    const svc = new AccountingService(
      prisma,
      {
        mirrorFromNas: jest.fn().mockResolvedValue({ status: "NONE" }),
        mirrorFromBook: jest.fn().mockResolvedValue({ status: "NONE" }),
      } as unknown as IfrsAutoMappingService,
      {} as PostingAccountResolver,
      {
        applyDimensionsToJournalEntries: jest.fn().mockResolvedValue(undefined),
      } as unknown as SubcontoService,
      {
        hasModule: jest.fn().mockResolvedValue(false),
      } as unknown as SubscriptionAccessService,
    );

    return { svc, tx };
  }

  const balancedLines = [
    { accountCode: "1200", debit: "100", credit: "0" },
    { accountCode: "4000", debit: "0", credit: "100" },
  ];

  it("blocks IFRS post when IFRS month is closed even if NAS is open", async () => {
    const { svc } = makeSvc({
      reporting: {
        closedPeriodsByLedger: { NAS: [], IFRS: ["2026-03"] },
      },
    });

    await expect(
      svc.postTransaction({
        organizationId: "org-1",
        date: new Date("2026-03-15T00:00:00.000Z"),
        ledgerType: LedgerType.IFRS,
        isFinal: true,
        lines: balancedLines,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows IFRS post when only NAS month is closed", async () => {
    const { svc, tx } = makeSvc({
      reporting: {
        closedPeriodsByLedger: { NAS: ["2026-03"], IFRS: [] },
      },
    });

    const out = await svc.postTransaction({
      organizationId: "org-1",
      date: new Date("2026-03-15T00:00:00.000Z"),
      ledgerType: LedgerType.IFRS,
      isFinal: true,
      lines: balancedLines,
    });

    expect(out.transactionId).toBe("tx-new");
    expect(tx.transaction.create).toHaveBeenCalled();
    expect(tx.journalEntry.create).toHaveBeenCalledTimes(2);
  });

  it("rejects reverse when original date falls in a closed period for that book", async () => {
    const { svc, tx } = makeSvc({
      reporting: { closedPeriodsByLedger: { IFRS: ["2026-03"] } },
    });
    tx.transaction.findFirst.mockResolvedValue({
      id: "orig",
      date: new Date("2026-03-10T00:00:00.000Z"),
    });

    await expect(
      svc.postTransaction({
        organizationId: "org-1",
        date: new Date("2026-04-01T00:00:00.000Z"),
        ledgerType: LedgerType.IFRS,
        isFinal: true,
        reversesTransactionId: "orig",
        lines: balancedLines.map((l) => ({
          accountCode: l.accountCode,
          debit: l.credit,
          credit: l.debit,
        })),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows reverse of isLocked tx when book period is open (shared lock no longer blocks)", async () => {
    const { svc, tx } = makeSvc({
      reporting: { closedPeriodsByLedger: { IFRS: [] } },
    });
    tx.transaction.findFirst.mockResolvedValue({
      id: "orig",
      date: new Date("2026-03-10T00:00:00.000Z"),
      isLocked: true,
    });

    const out = await svc.postTransaction({
      organizationId: "org-1",
      date: new Date("2026-04-01T00:00:00.000Z"),
      ledgerType: LedgerType.IFRS,
      isFinal: true,
      reversesTransactionId: "orig",
      lines: balancedLines.map((l) => ({
        accountCode: l.accountCode,
        debit: l.credit,
        credit: l.debit,
      })),
    });
    expect(out.transactionId).toBe("tx-new");
  });
});
