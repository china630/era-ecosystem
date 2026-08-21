import { mergeWhere, mergeWhereForUnique } from "@era/satellite-kit/tenancy";

describe("era-logistics SHARED-schema isolation (CI, not live pool)", () => {
  it("same Vehicle.plate is a different unique per org", () => {
    expect(mergeWhereForUnique({ plate: "X1" }, "org-a")).toEqual({
      organizationId_plate: { organizationId: "org-a", plate: "X1" },
    });
    expect(mergeWhereForUnique({ plate: "X1" }, "org-b")).toEqual({
      organizationId_plate: { organizationId: "org-b", plate: "X1" },
    });
  });

  it("list filters AND-merge organizationId", () => {
    expect(mergeWhere({ status: "OPEN" }, "org-a")).toEqual({
      AND: [{ organizationId: "org-a" }, { status: "OPEN" }],
    });
  });
});
