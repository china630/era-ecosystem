import { mergeWhere, mergeWhereForUnique } from "@era/satellite-kit/tenancy";

describe("retail SHARED-schema isolation (CI, not live pool)", () => {
  it("same ProductCache.sku is a different unique per org", () => {
    expect(mergeWhereForUnique({ sku: "SKU-1" }, "org-a")).toEqual({
      organizationId_sku: { organizationId: "org-a", sku: "SKU-1" },
    });
    expect(mergeWhereForUnique({ sku: "SKU-1" }, "org-b")).toEqual({
      organizationId_sku: { organizationId: "org-b", sku: "SKU-1" },
    });
  });

  it("list filters AND-merge organizationId", () => {
    expect(mergeWhere({ status: "OPEN" }, "org-a")).toEqual({
      AND: [{ organizationId: "org-a" }, { status: "OPEN" }],
    });
  });
});
