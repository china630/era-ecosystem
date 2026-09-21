import { payRolesForKafe } from "../src/lib/fnb-roles";
import { suggestDishes } from "../src/lib/dish-lexicon";

describe("ERA Kafe gap-pass helpers", () => {
  it("suggests khingal aliases", () => {
    expect(suggestDishes("khinkal").some((h) => h.name === "Xəngəl")).toBe(true);
  });

  it("kafe pay roles exclude waiter", () => {
    expect(payRolesForKafe(true)).toEqual(["FB_CASHIER", "FB_MANAGER"]);
    expect(payRolesForKafe(true)).not.toContain("FB_WAITER");
  });

  it("hotel pay roles still include waiter", () => {
    expect(payRolesForKafe(false)).toContain("FB_WAITER");
    expect(payRolesForKafe(false)).toContain("FB_CASHIER");
  });
});
