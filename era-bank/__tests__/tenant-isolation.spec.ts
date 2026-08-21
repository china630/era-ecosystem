import { mergeWhere, mergeWhereForUnique } from "@era/satellite-kit/tenancy";

describe("era-bank SHARED-schema isolation (CI, not live pool)", () => {
  it("same OpsRole.code is a different unique per org", () => {
    expect(mergeWhereForUnique({ code: "TELLER" }, "org-a")).toEqual({
      organizationId_code: { organizationId: "org-a", code: "TELLER" },
    });
    expect(mergeWhereForUnique({ code: "TELLER" }, "org-b")).toEqual({
      organizationId_code: { organizationId: "org-b", code: "TELLER" },
    });
  });

  it("same OpsUser.username is a different unique per org", () => {
    expect(mergeWhereForUnique({ username: "alice" }, "org-a")).toEqual({
      organizationId_username: { organizationId: "org-a", username: "alice" },
    });
  });

  it("list filters AND-merge organizationId", () => {
    expect(mergeWhere({ status: "ACTIVE" }, "org-a")).toEqual({
      AND: [{ organizationId: "org-a" }, { status: "ACTIVE" }],
    });
  });
});
