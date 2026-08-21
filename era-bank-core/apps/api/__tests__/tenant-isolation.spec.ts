import { mergeWhere, mergeWhereForUnique } from "@era/satellite-kit/tenancy";

describe("era-bank-core SHARED-schema isolation (CI, not live pool)", () => {
  it("same Account.iban is a different unique per org", () => {
    expect(mergeWhereForUnique({ iban: "AZ00TEST" }, "org-a")).toEqual({
      organizationId_iban: { organizationId: "org-a", iban: "AZ00TEST" },
    });
    expect(mergeWhereForUnique({ iban: "AZ00TEST" }, "org-b")).toEqual({
      organizationId_iban: { organizationId: "org-b", iban: "AZ00TEST" },
    });
  });

  it("list filters AND-merge organizationId", () => {
    expect(mergeWhere({ status: "ACTIVE" }, "org-a")).toEqual({
      AND: [{ organizationId: "org-a" }, { status: "ACTIVE" }],
    });
  });
});
