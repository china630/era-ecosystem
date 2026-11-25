import { OrganizationKind, Prisma } from "@erafinance/database";
import { GovBudgetService } from "../../src/gov-budget/gov-budget.service";

describe("GovBudgetService ledger", () => {
  const postingJournal = {
    postInTransaction: jest.fn().mockResolvedValue({ transactionId: "txn-ledger-1" }),
  };
  const resolver = {
    getOrganizationKind: jest.fn().mockResolvedValue(OrganizationKind.BUDGET),
  };

  const txClient = {
    budgetCommitment: { create: jest.fn().mockResolvedValue({ id: "c-1" }) },
  };
  const prisma = {
    budgetYear: { findFirst: jest.fn() },
    budgetLine: {
      findFirst: jest.fn().mockResolvedValue({
        id: "line-1",
        accountCode: "711",
        budgetYear: { organizationId: "org-1", status: "APPROVED" },
      }),
    },
    budgetCommitment: { create: jest.fn().mockResolvedValue({ id: "c-1" }) },
    $transaction: jest.fn(async (fn: (tx: typeof txClient) => Promise<unknown>) =>
      fn(txClient),
    ),
  };

  const svc = new GovBudgetService(
    prisma as never,
    resolver as never,
    postingJournal as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("recordFundingReceipt posts BUDGET_APPROPRIATION", async () => {
    const out = await svc.recordFundingReceipt("org-1", { amount: 1000 });
    expect(out.transactionId).toBe("txn-ledger-1");
    expect(postingJournal.postInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ schemaId: "BUDGET_APPROPRIATION" }),
    );
  });

  it("recordExpenseExecution posts BUDGET_EXPENSE_EXECUTION with line account", async () => {
    jest.spyOn(svc, "checkLimit").mockResolvedValue({
      allowed: true,
      blocked: false,
      reason: null,
      limitAnnual: "10000",
      committed: "0",
      remaining: "10000",
      requested: "500",
    });

    await svc.recordExpenseExecution("org-1", {
      budgetLineId: "line-1",
      amount: 500,
    });

    expect(postingJournal.postInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        schemaId: "BUDGET_EXPENSE_EXECUTION",
        dynamicAccounts: { debitAccountCode: "711" },
      }),
    );
    expect(txClient.budgetCommitment.create).toHaveBeenCalled();
  });

  it("rejects ledger on COMMERCIAL org", async () => {
    resolver.getOrganizationKind.mockResolvedValueOnce(OrganizationKind.COMMERCIAL);
    await expect(
      svc.recordFundingReceipt("org-1", { amount: 100 }),
    ).rejects.toThrow(/BUDGET organization/);
  });

  it("reserveCommitment soft-links CONTRACT_COMMITMENT without NAS ledger", async () => {
    prisma.budgetLine.findFirst.mockResolvedValueOnce({
      id: "line-1",
      budgetYear: { organizationId: "org-1", status: "APPROVED", mode: "MANAGEMENT" },
    });
    const out = await svc.reserveCommitment("org-1", {
      budgetLineId: "line-1",
      amount: 250,
      referenceType: "CONTRACT_COMMITMENT",
      referenceId: "cc-9",
    });
    expect(out.id).toBe("c-1");
    expect(prisma.budgetCommitment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referenceType: "CONTRACT_COMMITMENT",
          referenceId: "cc-9",
        }),
      }),
    );
    expect(postingJournal.postInTransaction).not.toHaveBeenCalled();
  });

  it("reserveCommitment hardGate refuses when limit exceeded", async () => {
    prisma.budgetLine.findFirst.mockResolvedValue({
      id: "line-1",
      budgetYear: { organizationId: "org-1", status: "APPROVED", mode: "MANAGEMENT" },
    });
    jest.spyOn(svc, "checkLimit").mockResolvedValue({
      allowed: false,
      blocked: true,
      reason: "LIMIT_EXCEEDED",
      limitAnnual: "100",
      committed: "100",
      remaining: "0",
      requested: "50",
    });
    await expect(
      svc.reserveCommitment("org-1", {
        budgetLineId: "line-1",
        amount: 50,
        referenceType: "PAYMENT",
        referenceId: "pay-1",
        hardGate: true,
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: "LIMIT_EXCEEDED" }) });
  });
});
