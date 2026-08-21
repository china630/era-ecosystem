import { mergeWhere, mergeWhereForUnique } from "@era/satellite-kit/tenancy";

describe("era-construction SHARED-schema isolation (CI, not live pool)", () => {
  it("same Project.code is a different unique per org", () => {
    expect(mergeWhereForUnique({ code: "X1" }, "org-a")).toEqual({
      organizationId_code: { organizationId: "org-a", code: "X1" },
    });
    expect(mergeWhereForUnique({ code: "X1" }, "org-b")).toEqual({
      organizationId_code: { organizationId: "org-b", code: "X1" },
    });
  });

  it("list filters AND-merge organizationId", () => {
    expect(mergeWhere({ status: "OPEN" }, "org-a")).toEqual({
      AND: [{ organizationId: "org-a" }, { status: "OPEN" }],
    });
  });
});
