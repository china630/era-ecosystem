import { OrganizationKind } from "@prisma/client";
import {
  loadPostingRolesJson,
  validatePostingRolesAgainstCharts,
} from "./posting-seed";
import { POSTING_ROLES } from "./posting-role";

describe("posting-seed", () => {
  it.each([
    OrganizationKind.COMMERCIAL,
    OrganizationKind.BUDGET,
    OrganizationKind.NGO,
  ] as const)("loads posting roles for %s", async (kind) => {
    const roles = await loadPostingRolesJson(kind);
    for (const role of POSTING_ROLES) {
      expect(roles[role]).toBeTruthy();
    }
  });

  it("contract: every preset account code exists in chart JSON (or runtime allowlist)", async () => {
    await expect(validatePostingRolesAgainstCharts()).resolves.toBeUndefined();
  });
});
