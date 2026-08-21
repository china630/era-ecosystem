import { mergeWhere, mergeWhereForUnique } from "@era/satellite-kit/tenancy";

describe("fnb SHARED-schema isolation (CI, not live pool)", () => {
  it("same Outlet.code is a different unique per org", () => {
    expect(mergeWhereForUnique({ code: "REST" }, "org-a")).toEqual({
      organizationId_code: { organizationId: "org-a", code: "REST" },
    });
    expect(mergeWhereForUnique({ code: "REST" }, "org-b")).toEqual({
      organizationId_code: { organizationId: "org-b", code: "REST" },
    });
  });

  it("list filters AND-merge organizationId", () => {
    expect(mergeWhere({ status: "OPEN" }, "org-a")).toEqual({
      AND: [{ organizationId: "org-a" }, { status: "OPEN" }],
    });
  });
});
