import { OrganizationKind } from "@erafinance/database";
import { GrantReceiptService } from "../../src/accounting/posting/grant-receipt.service";

describe("GrantReceiptService", () => {
  const postingJournal = {
    postInTransaction: jest.fn().mockResolvedValue({ transactionId: "txn-grant-1" }),
  };
  const resolver = {
    getOrganizationKind: jest.fn().mockResolvedValue(OrganizationKind.NGO),
  };
  const prisma = {
    account: { findFirst: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  };

  const svc = new GrantReceiptService(
    prisma as never,
    resolver as never,
    postingJournal as never,
  );

  it("posts NGO_GRANT_INCOME for NGO org", async () => {
    const out = await svc.record("org-ngo", { amount: 2500, description: "EU grant" });
    expect(out.transactionId).toBe("txn-grant-1");
    expect(postingJournal.postInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ schemaId: "NGO_GRANT_INCOME" }),
    );
  });

  it("rejects non-NGO org", async () => {
    resolver.getOrganizationKind.mockResolvedValueOnce(OrganizationKind.COMMERCIAL);
    await expect(svc.record("org-1", { amount: 100 })).rejects.toThrow(/NGO organizations/);
  });
});
