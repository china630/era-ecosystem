import { mergeWhere, mergeWhereForUnique } from "@era/satellite-kit/tenancy";

describe("clinic SHARED-schema isolation (CI, not live pool)", () => {
  it("same PatientRef.refCode is a different unique per org", () => {
    expect(mergeWhereForUnique({ refCode: "P1" }, "org-a")).toEqual({
      organizationId_refCode: { organizationId: "org-a", refCode: "P1" },
    });
    expect(mergeWhereForUnique({ refCode: "P1" }, "org-b")).toEqual({
      organizationId_refCode: { organizationId: "org-b", refCode: "P1" },
    });
  });

  it("list filters AND-merge organizationId", () => {
    expect(mergeWhere({ status: "OPEN" }, "org-a")).toEqual({
      AND: [{ organizationId: "org-a" }, { status: "OPEN" }],
    });
  });
});
