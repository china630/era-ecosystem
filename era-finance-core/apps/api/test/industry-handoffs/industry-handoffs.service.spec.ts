import { IndustryHandoffsService } from "../../src/industry-handoffs/industry-handoffs.service";

describe("IndustryHandoffsService", () => {
  const prisma = {
    product: { findFirst: jest.fn() },
    stockItem: { findMany: jest.fn() },
    industryStockCheckLog: { create: jest.fn() },
  };
  const inventory = { getInventorySettings: jest.fn().mockResolvedValue({}) };
  const service = new IndustryHandoffsService(prisma as never, inventory as never);

  it("stockCheck returns variance", async () => {
    prisma.product.findFirst.mockResolvedValue({
      id: "p1",
      sku: "SKU1",
      name: "Item",
    });
    prisma.stockItem.findMany.mockResolvedValue([
      { warehouseId: "w1", quantity: 10, warehouse: { id: "w1", name: "Main" } },
    ]);
    prisma.industryStockCheckLog.create.mockResolvedValue({ id: "c1" });

    const result = await service.stockCheck("org1", {
      sku: "SKU1",
      actualQty: 8,
    });

    expect(result.variance).toBe(-2);
    expect(result.match).toBe(false);
  });
});
