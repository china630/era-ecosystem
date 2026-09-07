import {
  LedgerMappingSetStatus,
  LedgerType,
} from "@erafinance/database";
import { CashFlowService } from "../../src/reports/cash-flow.service";
import type { PrismaService } from "../../src/prisma/prisma.service";
import type { ReportsCacheService } from "../../src/reports/reports-cache.service";

describe("CashFlowService IFRS bank include (P1 hardening)", () => {
  function makeSvc(opts: { publishedMapping: boolean }) {
    const ledgerMappingSet = {
      findFirst: jest.fn().mockResolvedValue(
        opts.publishedMapping
          ? { id: "set-1", status: LedgerMappingSetStatus.PUBLISHED }
          : null,
      ),
    };
    const cashOrder = {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    };
    const bankStatementLine = {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    };

    const prisma = {
      ledgerMappingSet,
      cashOrder,
      bankStatementLine,
    } as unknown as PrismaService;

    const cache = {
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn().mockResolvedValue(undefined),
    } as unknown as ReportsCacheService;

    const svc = new CashFlowService(prisma, cache, {
      resolveByIdOrLedgerAlias: jest.fn(async (_org, bookId, ledger) => ({
        id: bookId ?? "book-nas",
        gaapKind: ledger === "IFRS" ? "IFRS" : "NAS",
      })),
    } as never);
    return { svc, ledgerMappingSet, bankStatementLine, cashOrder };
  }

  it("skips bank statement lines for IFRS when no PUBLISHED NAS_TO_IFRS set", async () => {
    const { svc, ledgerMappingSet, bankStatementLine } = makeSvc({
      publishedMapping: false,
    });

    const out = await svc.getDirectCashFlow("org-1", {
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      ledgerType: LedgerType.IFRS,
    });

    expect(ledgerMappingSet.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          code: "NAS_TO_IFRS",
          status: LedgerMappingSetStatus.PUBLISHED,
        }),
      }),
    );
    expect(bankStatementLine.count).not.toHaveBeenCalled();
    expect(bankStatementLine.findMany).not.toHaveBeenCalled();
    expect(out.methodologyNote).toMatch(/Publish a NAS_TO_IFRS/i);
  });

  it("includes bank statement lines for IFRS when PUBLISHED mapping exists", async () => {
    const { svc, bankStatementLine } = makeSvc({ publishedMapping: true });
    bankStatementLine.count.mockResolvedValue(0);
    bankStatementLine.findMany.mockResolvedValue([]);

    const out = await svc.getDirectCashFlow("org-1", {
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      ledgerType: LedgerType.IFRS,
    });

    expect(bankStatementLine.count).toHaveBeenCalled();
    expect(bankStatementLine.findMany).toHaveBeenCalled();
    expect(out.methodologyNote).toMatch(/bank statement lines included/i);
  });

  it("always considers bank lines for NAS ledger", async () => {
    const { svc, ledgerMappingSet, bankStatementLine } = makeSvc({
      publishedMapping: false,
    });

    await svc.getDirectCashFlow("org-1", {
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      ledgerType: LedgerType.NAS,
    });

    expect(ledgerMappingSet.findFirst).not.toHaveBeenCalled();
    expect(bankStatementLine.count).toHaveBeenCalled();
  });
});
