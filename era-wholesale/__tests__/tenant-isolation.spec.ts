import { mergeWhere, mergeWhereForUnique } from "@era/satellite-kit/tenancy";

describe("era-wholesale SHARED-schema isolation (CI, not live pool)", () => {
  it("same B2BOrder.orderNumber is a different unique per org", () => {
    expect(mergeWhereForUnique({ orderNumber: "X1" }, "org-a")).toEqual({
      organizationId_orderNumber: { organizationId: "org-a", orderNumber: "X1" },
    });
    expect(mergeWhereForUnique({ orderNumber: "X1" }, "org-b")).toEqual({
      organizationId_orderNumber: { organizationId: "org-b", orderNumber: "X1" },
    });
  });

  it("list filters AND-merge organizationId", () => {
    expect(mergeWhere({ status: "OPEN" }, "org-a")).toEqual({
      AND: [{ organizationId: "org-a" }, { status: "OPEN" }],
    });
  });
});
