import { discountedLineAmounts } from "../src/lib/ticket-line-amounts";
import { planMenuCards } from "../src/lib/menu-card-import";

describe("discounted ticket lines", () => {
  it("scales lines onto the ticket total and keeps a zero total at zero", () => {
    const scaled = discountedLineAmounts(
      [
        { id: "a", qty: 2, unitPriceAzn: 10 },
        { id: "b", qty: 1, unitPriceAzn: 5 },
      ],
      20,
    );
    expect(scaled.get("a")).toBe(16);
    expect(scaled.get("b")).toBe(4);
    const included = discountedLineAmounts(
      [{ id: "a", qty: 1, unitPriceAzn: 8 }],
      0,
    );
    expect(included.get("a")).toBe(0);
  });
});

describe("menu card import", () => {
  it("puts the revenue code on the category and skips laundry and clinic", () => {
    const plan = planMenuCards([
      {
        productCode: "F1",
        productGroup: "Hot food",
        name: "Soup",
        price: 6,
        revenueGroup: "FOOD",
      },
      {
        productCode: "W1",
        productGroup: "Wine",
        name: "Savalan Chardonnay glass",
        price: 8,
        revenueGroup: "BEVERAGE",
      },
      {
        productCode: "W2",
        productGroup: "Wine",
        name: "Savalan Chardonnay bottle 0.75",
        price: 40,
        revenueGroup: "ALCOLIC BEVERAGE",
      },
      {
        productCode: "L1",
        productGroup: "Laundry",
        name: "Shirt",
        price: 3,
        revenueGroup: "LAUNDRY",
      },
      {
        productCode: "S1",
        productGroup: "SPA MEDIKAL",
        name: "Vibro-laser",
        price: 20,
        revenueGroup: "SPA MEDIKAL",
      },
    ]);
    expect(plan.categories.map((category) => category.revenueCode).sort()).toEqual(["4101", "4103"]);
    expect(plan.dishes.map((dish) => dish.plu).sort()).toEqual(["F1", "W1", "W2"]);
    expect(plan.dishes.every((dish) => !("revenueCode" in dish && dish.revenueCode))).toBe(true);
    const glass = plan.dishes.find((dish) => dish.plu === "W1");
    expect(glass?.recipeSku).toBe("W2");
    expect(plan.skipped.map((row) => row.split(" ")[0]).sort()).toEqual(["L1", "S1"]);
  });
});
