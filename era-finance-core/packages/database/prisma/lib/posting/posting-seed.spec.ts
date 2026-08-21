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

  it("maps official kassa and bank per kind", async () => {
    const commercial = await loadPostingRolesJson(OrganizationKind.COMMERCIAL);
    expect(commercial.CASH_AZN).toBe("221.01");
    expect(commercial.CASH_FOREIGN).toBe("221.11");
    expect(commercial.CASH_IN_TRANSIT).toBe("222");
    expect(commercial.MAIN_BANK).toBe("223");
    expect(commercial.BANK_SETTLEMENT).toBe("223");

    const budget = await loadPostingRolesJson(OrganizationKind.BUDGET);
    expect(budget.CASH_AZN).toBe("101");
    expect(budget.CASH_IN_TRANSIT).toBe("102");
    expect(budget.MAIN_BANK).toBe("103");
    expect(budget.BANK_SETTLEMENT).toBe("103");

    const ngo = await loadPostingRolesJson(OrganizationKind.NGO);
    expect(ngo.CASH_AZN).toBe("221");
    expect(ngo.CASH_IN_TRANSIT).toBe("222");
    expect(ngo.MAIN_BANK).toBe("223");
    expect(ngo.BANK_SETTLEMENT).toBe("223");
  });
});
