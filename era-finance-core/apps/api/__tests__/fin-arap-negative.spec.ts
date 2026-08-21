import { BadRequestException, NotFoundException } from "@nestjs/common";
import { InvoiceStatus, LedgerType, Prisma, UserRole } from "@erafinance/database";
import { NettingService } from "../src/accounting/netting.service";
import type { AccountingService } from "../src/accounting/accounting.service";
import type { PostingAccountResolver } from "../src/accounting/posting/posting-account-resolver.service";
import { InvoicesService } from "../src/invoices/invoices.service";
import type { PrismaService } from "../src/prisma/prisma.service";

const Decimal = Prisma.Decimal;

function mockPosting(): PostingAccountResolver {
  return {
    resolveAccountCode: jest.fn(async (_org: string, role: string) => {
      const map: Record<string, string> = {
        TRADE_RECEIVABLE: "211",
        SUPPLIER_PAYABLE: "531",
        VAT_INPUT: "191",
        VAT_OUTPUT: "545",
      };
      return map[role] ?? "999";
    }),
  } as unknown as PostingAccountResolver;
}

describe("Finance AR/AP negative paths (AC-FIN-ARAP)", () => {
  const orgId = "00000000-0000-0000-0000-000000000001";
  const foreignCpId = "00000000-0000-0000-0000-0000000000f1";
  const invId = "00000000-0000-0000-0000-0000000000d1";

  it("createNetting refuses foreign counterparty (other organization)", async () => {
    const prisma = {
      counterparty: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const accounting = {
      postJournalInTransaction: jest.fn(),
    } as unknown as AccountingService;
    const svc = new NettingService(prisma, accounting, mockPosting());

    await expect(
      svc.createNetting(orgId, foreignCpId, 10, LedgerType.NAS, UserRole.ACCOUNTANT),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(accounting.postJournalInTransaction).not.toHaveBeenCalled();
  });

  it("createNetting refuses amount above max receivable/payable net", async () => {
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({ settings: {} }),
      },
      counterparty: {
        findFirst: jest.fn().mockResolvedValue({
          id: foreignCpId,
          nameCipher: null,
          isVatPayer: false,
        }),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: invId,
            totalAmount: new Decimal(50),
            revenueRecognized: true,
            status: InvoiceStatus.SENT,
            payments: [],
          },
        ]),
      },
      account: {
        findFirst: jest.fn().mockResolvedValue({ id: "acc-531" }),
      },
      journalEntry: {
        findMany: jest.fn().mockResolvedValue([
          { debit: new Decimal(0), credit: new Decimal(50) },
        ]),
      },
    } as unknown as PrismaService;
    const accounting = {
      postJournalInTransaction: jest.fn(),
    } as unknown as AccountingService;
    const svc = new NettingService(prisma, accounting, mockPosting());

    await expect(
      svc.createNetting(orgId, foreignCpId, 100, LedgerType.NAS, UserRole.ACCOUNTANT),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accounting.postJournalInTransaction).not.toHaveBeenCalled();
  });

  it("recordPayment refuses overpay beyond remaining AZN balance", async () => {
    const noop = {} as never;
    const posting = mockPosting();
    const invoiceRow = {
      id: invId,
      number: "INV-1",
      totalAmount: new Decimal(100),
      paidAmount: new Decimal(80),
      status: InvoiceStatus.SENT,
      revenueRecognized: true,
      debitAccountCode: "221",
      counterpartyId: foreignCpId,
      currency: "AZN",
      counterparty: { taxIdCipher: null },
    };

    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: invId, status: "SENT" }]),
      invoice: {
        findFirst: jest.fn().mockResolvedValue(invoiceRow),
      },
    };

    const prisma = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue({ status: InvoiceStatus.SENT }),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as PrismaService;

    const service = new InvoicesService(
      prisma,
      noop,
      posting,
      noop,
      { maybeRouteFromInvoicePayment: jest.fn() } as never,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
    );

    await expect(
      service.recordPayment(
        orgId,
        invId,
        { amount: 50 },
        UserRole.ACCOUNTANT,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    try {
      await service.recordPayment(
        orgId,
        invId,
        { amount: 50 },
        UserRole.ACCOUNTANT,
      );
    } catch (err) {
      expect((err as BadRequestException).message).toMatch(/превышает остаток|exceed/i);
    }
  });

  function creditAdjustmentServiceMocks(invoiceRow: Record<string, unknown>) {
    const posting = mockPosting();
    (posting.resolveAccountCode as jest.Mock).mockImplementation(
      async (_org: string, role: string) => {
        const map: Record<string, string> = {
          TRADE_RECEIVABLE: "211",
          SALES_REVENUE: "601",
          MISC_OPERATING_EXPENSE: "731",
          VAT_OUTPUT: "545",
        };
        return map[role] ?? "999";
      },
    );
    const accounting = {
      postJournalInTransaction: jest.fn().mockResolvedValue({ transactionId: "tx-cr" }),
    };
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: invId, status: "SENT" }]),
      organization: {
        findUnique: jest.fn().mockResolvedValue({ settings: { tax: { isVatPayer: true } } }),
      },
      invoice: {
        findFirst: jest.fn().mockResolvedValue(invoiceRow),
        findFirstOrThrow: jest.fn().mockResolvedValue({
          totalAmount: invoiceRow.totalAmount,
          paidAmount: invoiceRow.paidAmount,
          status: invoiceRow.status,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      invoicePayment: {
        create: jest.fn().mockResolvedValue({ id: "pay-cr" }),
      },
    };
    const prisma = {
      invoice: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ status: invoiceRow.status })
          .mockResolvedValue({
            ...invoiceRow,
            currency: "AZN",
            dueDate: new Date("2026-08-20"),
            counterparty: { name: "CP", taxId: "1234567890", email: null },
            items: (invoiceRow.items as unknown[]) ?? [],
            payments: [],
          }),
      },
      digitalSignatureLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as PrismaService;
    const noop = {} as never;
    const service = new InvoicesService(
      prisma,
      accounting as never,
      posting,
      noop,
      { maybeRouteFromInvoicePayment: jest.fn() } as never,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
    );
    return { service, accounting, tx };
  }

  it("applyCreditAdjustment refuses amount above remaining", async () => {
    const { service, accounting } = creditAdjustmentServiceMocks({
      id: invId,
      number: "INV-CR",
      totalAmount: new Decimal(100),
      paidAmount: new Decimal(80),
      status: InvoiceStatus.SENT,
      revenueRecognized: true,
      counterpartyId: foreignCpId,
    });
    await expect(
      service.applyCreditAdjustment(
        orgId,
        invId,
        {
          amount: 50,
          date: "2026-08-20",
          reason: "Correcting billed amount per agreement",
          offset: "REVENUE" as never,
        },
        UserRole.ACCOUNTANT,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accounting.postJournalInTransaction).not.toHaveBeenCalled();
  });

  it("applyCreditAdjustment refuses when remaining is zero (PAID)", async () => {
    const { service, accounting } = creditAdjustmentServiceMocks({
      id: invId,
      number: "INV-PAID",
      totalAmount: new Decimal(100),
      paidAmount: new Decimal(100),
      status: InvoiceStatus.PAID,
      revenueRecognized: true,
      counterpartyId: foreignCpId,
    });
    await expect(
      service.applyCreditAdjustment(
        orgId,
        invId,
        {
          amount: 5,
          date: "2026-08-20",
          reason: "Should use adjustments refund instead",
          offset: "REVENUE" as never,
        },
        UserRole.ACCOUNTANT,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accounting.postJournalInTransaction).not.toHaveBeenCalled();
  });

  it("applyCreditAdjustment refuses short reason", async () => {
    const { service, accounting } = creditAdjustmentServiceMocks({
      id: invId,
      number: "INV-CR2",
      totalAmount: new Decimal(100),
      paidAmount: new Decimal(0),
      status: InvoiceStatus.SENT,
      revenueRecognized: true,
      counterpartyId: foreignCpId,
    });
    await expect(
      service.applyCreditAdjustment(
        orgId,
        invId,
        {
          amount: 5,
          date: "2026-08-20",
          reason: "short",
          offset: "REVENUE" as never,
        },
        UserRole.ACCOUNTANT,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accounting.postJournalInTransaction).not.toHaveBeenCalled();
  });

  it("applyCreditAdjustment refuses CANCELLED invoice", async () => {
    const { service, accounting } = creditAdjustmentServiceMocks({
      id: invId,
      number: "INV-CAN",
      totalAmount: new Decimal(100),
      paidAmount: new Decimal(0),
      status: InvoiceStatus.CANCELLED,
      revenueRecognized: true,
      counterpartyId: foreignCpId,
    });
    await expect(
      service.applyCreditAdjustment(
        orgId,
        invId,
        {
          amount: 5,
          date: "2026-08-20",
          reason: "Cancelled invoice must not adjust",
          offset: "REVENUE" as never,
        },
        UserRole.ACCOUNTANT,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accounting.postJournalInTransaction).not.toHaveBeenCalled();
  });

  it("applyCreditAdjustment REVENUE with VAT posts 601/545/211 split", async () => {
    const { service, accounting } = creditAdjustmentServiceMocks({
      id: invId,
      number: "INV-VAT",
      totalAmount: new Decimal(118),
      paidAmount: new Decimal(0),
      status: InvoiceStatus.SENT,
      revenueRecognized: true,
      counterpartyId: foreignCpId,
      items: [
        { lineTotal: new Decimal(118), vatRate: new Decimal(18) },
      ],
    });
    await service.applyCreditAdjustment(
      orgId,
      invId,
      {
        amount: 59,
        date: "2026-08-20",
        reason: "Partial credit per agreement with client",
        offset: "REVENUE" as never,
      },
      UserRole.ACCOUNTANT,
    );
    expect(accounting.postJournalInTransaction).toHaveBeenCalled();
    const lines = (accounting.postJournalInTransaction as jest.Mock).mock.calls[0][1].lines;
    expect(lines).toHaveLength(3);
    expect(lines.map((l: { accountCode: string }) => l.accountCode).sort()).toEqual([
      "211",
      "545",
      "601",
    ]);
  });

  it("applyCreditAdjustment EXPENSE does not post VAT_OUTPUT line", async () => {
    const { service, accounting } = creditAdjustmentServiceMocks({
      id: invId,
      number: "INV-EXP",
      totalAmount: new Decimal(118),
      paidAmount: new Decimal(0),
      status: InvoiceStatus.SENT,
      revenueRecognized: true,
      counterpartyId: foreignCpId,
      items: [
        { lineTotal: new Decimal(118), vatRate: new Decimal(18) },
      ],
    });
    await service.applyCreditAdjustment(
      orgId,
      invId,
      {
        amount: 10,
        date: "2026-08-20",
        reason: "Write-off portion as operating expense",
        offset: "EXPENSE" as never,
      },
      UserRole.ACCOUNTANT,
    );
    const lines = (accounting.postJournalInTransaction as jest.Mock).mock.calls[0][1].lines;
    expect(lines).toHaveLength(2);
    expect(lines.some((l: { accountCode: string }) => l.accountCode === "545")).toBe(false);
  });
});
