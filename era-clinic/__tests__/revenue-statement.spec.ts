import { accumulateRevenue } from "@/domain/reports/revenue-statement";

describe("accumulateRevenue", () => {
  it("groups whatever article the resolver returned, including a new one", () => {
    const rows = accumulateRevenue([
      { revenueCode: "14", quantity: 2, amount: 20 },
      { revenueCode: "2004", quantity: 1, amount: 17 },
      { revenueCode: "14", quantity: 1, amount: 5 },
      { revenueCode: "NEW-9", quantity: 3, amount: 9 },
      { revenueCode: "  ", quantity: 1, amount: 4 },
      { revenueCode: "14", quantity: 1, amount: 0 },
    ]);
    expect(rows).toEqual([
      { revenueCode: "—", quantity: 1, amount: 4 },
      { revenueCode: "14", quantity: 3, amount: 25 },
      { revenueCode: "2004", quantity: 1, amount: 17 },
      { revenueCode: "NEW-9", quantity: 3, amount: 9 },
    ]);
  });
});
