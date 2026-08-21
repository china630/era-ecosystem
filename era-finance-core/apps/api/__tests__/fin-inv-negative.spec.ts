import type { AccountingService } from "../src/accounting/accounting.service";
import type { AccessControlService } from "../src/access/access-control.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { StockService } from "../src/stock/stock.service";
import { UserRole } from "@erafinance/database";
import { Prisma } from "@erafinance/database";
import { createTestInventoryService } from "../test/helpers/mock-posting-resolver";
import { mockTxInventoryReconciliationClear } from "../test/helpers/mock-prisma-tx-reconciliation";

const Decimal = Prisma.Decimal;

describe("Finance inventory negative paths (AC-FIN-INV)", () => {
  it("adjustStock rolls back stock+GL when journal post fails inside transaction", async () => {
    let stockCommitted = false;
    const glError = new Error("GL post failed");

    const tx = {
      ...mockTxInventoryReconciliationClear(),
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wh-1",
          inventoryAccountCode: "201",
        }),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: "p-1",
          isService: false,
        }),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({ settings: {} }),
      },
      stockItem: {
        findUnique: jest.fn().mockResolvedValue({
          quantity: new Decimal(10),
          averageCost: new Decimal(5),
        }),
        upsert: jest.fn().mockImplementation(async () => {
          stockCommitted = true;
          return {};
        }),
      },
      stockMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
        try {
          return await fn(tx);
        } catch (err) {
          // Simulate Prisma transaction abort — stock mutations do not persist.
          stockCommitted = false;
          throw err;
        }
      }),
    } as unknown as PrismaService;

    const accounting = {
      postJournalInTransaction: jest.fn().mockRejectedValue(glError),
    } as unknown as AccountingService;
    const stock = {
      computeIssueUnitCost: jest.fn().mockResolvedValue(new Decimal(5)),
    } as unknown as StockService;
    const access = {
      assertMayPostAccounting: jest.fn().mockResolvedValue(undefined),
    } as unknown as AccessControlService;

    const service = createTestInventoryService(prisma, accounting, stock, access);

    await expect(
      service.adjustStock(
        "org-1",
        {
          warehouseId: "wh-1",
          productId: "p-1",
          type: "OUT",
          quantity: 2,
          inventoryAccountCode: "201",
        },
        UserRole.ACCOUNTANT,
      ),
    ).rejects.toBe(glError);

    expect(tx.stockItem.upsert).toHaveBeenCalled();
    expect(accounting.postJournalInTransaction).toHaveBeenCalled();
    expect(stockCommitted).toBe(false);
  });
});
