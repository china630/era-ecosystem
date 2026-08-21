import { mergeWhere, mergeWhereForUnique } from "@era/satellite-kit/tenancy";

describe("era-bank-dbo SHARED-schema isolation (CI, not live pool)", () => {
  it("same CorporateApiKey.keyHash is a different unique per org", () => {
    expect(mergeWhereForUnique({ keyHash: "abc" }, "org-a")).toEqual({
      organizationId_keyHash: { organizationId: "org-a", keyHash: "abc" },
    });
    expect(mergeWhereForUnique({ keyHash: "abc" }, "org-b")).toEqual({
      organizationId_keyHash: { organizationId: "org-b", keyHash: "abc" },
    });
  });

  it("list filters AND-merge organizationId", () => {
    expect(mergeWhere({ status: "PENDING" }, "org-a")).toEqual({
      AND: [{ organizationId: "org-a" }, { status: "PENDING" }],
    });
  });
});
