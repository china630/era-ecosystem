import { mergeWhere, mergeWhereForUnique } from "@era/satellite-kit/tenancy";

describe("hotel SHARED-schema isolation (CI, not live pool)", () => {
  it("same roomNumber / externalRef is a different unique per org", () => {
    expect(mergeWhereForUnique({ roomNumber: "101" }, "org-a")).toEqual({
      organizationId_roomNumber: { organizationId: "org-a", roomNumber: "101" },
    });
    expect(mergeWhereForUnique({ externalRef: "EW-1" }, "org-b")).toEqual({
      organizationId_externalRef: { organizationId: "org-b", externalRef: "EW-1" },
    });
  });

  it("list filters AND-merge organizationId", () => {
    expect(mergeWhere({ status: "IN_HOUSE" }, "org-a")).toEqual({
      AND: [{ organizationId: "org-a" }, { status: "IN_HOUSE" }],
    });
  });
});
