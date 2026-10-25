import { BadRequestException } from "@nestjs/common";
import { CashOrderKind, CashOrderStatus, TransactionKind } from "@erafinance/database";
import { FactQueueService } from "./fact-queue.service";
import {
  assertFactQueueAllowsClose,
  bankLineInFactQueue,
  cashOrderInFactQueue,
  counterpartyMeaningAllowed,
  FactQueueNotEmptyError,
  manualJournalClearsFactQueue,
  openMonthPostingAllowed,
  type FactQueueItem,
} from "./fact-queue";

const gap: FactQueueItem = {
  source: "BANK",
  id: "line-1",
  date: "2026-06-02",
  amount: "40.00",
  direction: "OUT",
  label: "unmatched",
  counterpartyId: null,
  counterpartyRole: null,
  isFounder: false,
};

describe("fact queue membership", () => {
  it("holds an unmatched bank line and releases it once a meaning is chosen", () => {
    expect(bankLineInFactQueue({ isMatched: false, factMeaning: null, manualTransactionId: "manual-1" })).toBe(true);
    expect(bankLineInFactQueue({ isMatched: false, factMeaning: "BANK_COMMISSION" })).toBe(false);
    expect(bankLineInFactQueue({ isMatched: true, factMeaning: null })).toBe(false);
  });

  it("holds a posted cash order without an invoice and ignores a draft", () => {
    expect(
      cashOrderInFactQueue({
        status: "POSTED",
        sourceInvoiceId: null,
        factMeaning: null,
        manualTransactionId: "manual-1",
      }),
    ).toBe(true);
    expect(
      cashOrderInFactQueue({ status: "POSTED", sourceInvoiceId: "inv-1", factMeaning: null }),
    ).toBe(false);
    expect(
      cashOrderInFactQueue({
        status: "POSTED",
        sourceInvoiceId: null,
        sourceInvoicePaymentId: "pay-1",
        factMeaning: null,
      }),
    ).toBe(false);
    expect(
      cashOrderInFactQueue({ status: "POSTED", sourceInvoiceId: null, factMeaning: "DUPLICATE_OR_ERROR" }),
    ).toBe(false);
    expect(
      cashOrderInFactQueue({ status: "DRAFT", sourceInvoiceId: null, factMeaning: null }),
    ).toBe(false);
  });

  it("refuses close while the queue has rows and still allows an open-month posting", () => {
    expect(manualJournalClearsFactQueue()).toBe(false);
    expect(() => assertFactQueueAllowsClose([gap])).toThrow(FactQueueNotEmptyError);
    expect(openMonthPostingAllowed([gap])).toBe(true);
    expect(() => assertFactQueueAllowsClose([])).not.toThrow();
    expect(
      counterpartyMeaningAllowed({
        meaning: "FOUNDER_LOAN_IN",
        role: "SUPPLIER",
        isFounder: false,
        confirmMismatch: false,
      }),
    ).toBe(false);
    expect(
      counterpartyMeaningAllowed({
        meaning: "FOUNDER_LOAN_IN",
        role: "SUPPLIER",
        isFounder: false,
        confirmMismatch: true,
      }),
    ).toBe(true);
  });
});

describe("FactQueueService.classify", () => {
  const line = {
    id: "line-1",
    organizationId: "org-1",
    factMeaning: null,
    factTransactionId: null,
    type: "OUTFLOW",
    amount: { toString: () => "15.00" },
    valueDate: new Date("2026-06-02T00:00:00.000Z"),
    description: "fee",
    isMatched: false,
    bankStatement: { date: new Date("2026-06-02T00:00:00.000Z") },
  };

  function service(overrides?: {
    purchase?: Record<string, unknown> | null;
    counterparty?: { role: string; isFounder: boolean } | null;
  }) {
    const update = jest.fn().mockResolvedValue({});
    const postTransaction = jest.fn().mockResolvedValue({ transactionId: "posted-1" });
    const prisma = {
      bankStatementLine: {
        findFirst: jest.fn().mockResolvedValue(line),
        update,
      },
      cashOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "cash-1",
          status: CashOrderStatus.POSTED,
          factMeaning: null,
          factTransactionId: null,
          postedTransactionId: "already-posted",
          kind: CashOrderKind.KXO,
          amount: { toString: () => "20.00" },
          date: new Date("2026-06-03T00:00:00.000Z"),
          counterpartyId: "cp-founder",
          orderNumber: "KXO-1",
          counterparty: { id: "cp-founder", role: "OTHER", isFounder: true },
        }),
        update,
      },
      invoice: { findFirst: jest.fn() },
      transaction: {
        findFirst: jest.fn().mockImplementation(({ where }: { where: { id?: string; reference?: string } }) => {
          if (where.reference) return Promise.resolve(null);
          if (overrides && "purchase" in overrides) return Promise.resolve(overrides.purchase);
          return Promise.resolve({
            id: "purchase-1",
            kind: TransactionKind.SYSTEM,
            counterpartyId: "cp-founder",
            purchaseSnapshot: { version: 1 },
          });
        }),
      },
      counterparty: {
        findFirst: jest.fn().mockResolvedValue(
          overrides?.counterparty ?? { role: "OTHER", isFounder: true },
        ),
      },
    };
    const posting = {
      resolveAccountCode: jest.fn(async (_org: string, role: string) =>
        role === "MAIN_BANK" ? "223" : "731",
      ),
    };
    const accounting = { postTransaction };
    return {
      update,
      postTransaction,
      svc: new FactQueueService(prisma as never, accounting as never, posting as never),
    };
  }

  it("does not post a duplicate and does not call the journal", async () => {
    const { svc, postTransaction, update } = service();
    const out = await svc.classify("org-1", {
      source: "BANK",
      id: "line-1",
      meaning: "DUPLICATE_OR_ERROR",
    });
    expect(out.posted).toBe(false);
    expect(postTransaction).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ factMeaning: "DUPLICATE_OR_ERROR" }),
      }),
    );
  });

  it("posts a bank commission through the expense and bank roles", async () => {
    const { svc, postTransaction } = service();
    const out = await svc.classify("org-1", {
      source: "BANK",
      id: "line-1",
      meaning: "BANK_COMMISSION",
    });
    expect(out.posted).toBe(true);
    expect(postTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: TransactionKind.SYSTEM,
        reference: "FACT:BANK:line-1",
        lines: [
          { accountCode: "731", debit: "15.00", credit: "0" },
          { accountCode: "223", debit: "0", credit: "15.00" },
        ],
      }),
    );
  });

  it("does not offer a founder as a supplier until the mismatch is confirmed", async () => {
    const { svc, update, postTransaction } = service();
    await expect(
      svc.classify("org-1", {
        source: "CASH",
        id: "cash-1",
        meaning: "SUPPLIER_PAYMENT",
        purchaseTransactionId: "purchase-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
    expect(postTransaction).not.toHaveBeenCalled();

    const confirmed = service();
    await confirmed.svc.classify("org-1", {
      source: "CASH",
      id: "cash-1",
      meaning: "SUPPLIER_PAYMENT",
      purchaseTransactionId: "purchase-1",
      confirmMismatch: true,
    });
    expect(confirmed.update).toHaveBeenCalled();
    expect(confirmed.postTransaction).not.toHaveBeenCalled();
  });

  it("does not let a manual journal stand in for a purchase", async () => {
    const { svc, update } = service({
      purchase: {
        id: "manual-1",
        kind: TransactionKind.MANUAL_ADJUSTMENT,
        counterpartyId: null,
        purchaseSnapshot: { version: 1 },
      },
    });
    await expect(
      svc.classify("org-1", {
        source: "CASH",
        id: "cash-1",
        meaning: "SUPPLIER_PAYMENT",
        purchaseTransactionId: "manual-1",
        confirmMismatch: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});
