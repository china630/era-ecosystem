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
});
