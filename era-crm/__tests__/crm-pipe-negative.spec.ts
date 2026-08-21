jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => undefined })),
  headers: jest.fn(async () => ({ get: () => null })),
}));

jest.mock("@era/satellite-kit", () => {
  class IndustryModuleInactiveError extends Error {
    readonly status = 403;
    readonly moduleKey: string;
    constructor(moduleKey: string) {
      super(`Industry module not active: ${moduleKey}`);
      this.name = "IndustryModuleInactiveError";
      this.moduleKey = moduleKey;
    }
  }
  return {
    IndustryModuleInactiveError,
    requireSatelliteModule: jest.fn(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    }),
    authCookieName: () => "era_session",
    getBearerOrCookieToken: () => null,
    verifySatelliteSession: jest.fn(),
  };
});

import { IndustryModuleInactiveError, requireSatelliteModule } from "@era/satellite-kit";

describe("CRM PIPE negative paths (AC-CRM-PIPE)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireSatelliteModule as jest.Mock).mockImplementation(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    });
  });

  describe("module gate", () => {
    it("assertCrmEntitled rejects when requireSatelliteModule throws", async () => {
      const { assertCrmEntitled } = await import("@/lib/api-utils");
      await expect(assertCrmEntitled()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_crm",
      });
      expect(requireSatelliteModule).toHaveBeenCalledWith("industry_crm");
    });

    it("requireCrmSatellite rejects on unbound/fallback org", async () => {
      const { requireCrmSatellite } = await import("@/lib/crm-module-gate");
      await expect(requireCrmSatellite()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_crm",
      });
    });

    it("handleRouteError maps IndustryModuleInactiveError to 403", async () => {
      const { handleRouteError } = await import("@/lib/api-utils");
      const res = handleRouteError(new IndustryModuleInactiveError("industry_crm"));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/industry_crm/);
    });
  });

  describe("domain deny", () => {
    it("refuses lead assign without SALES_LEAD or BUSINESS_OWNER", async () => {
      const { assignLeadDenied } = await import("@/lib/lead-assign-gates");
      expect(assignLeadDenied(null)).toMatch(/SALES_LEAD/);
      expect(assignLeadDenied("SALES_REP")).toMatch(/Forbidden/);
      expect(assignLeadDenied("SALES_LEAD")).toBeNull();
      expect(assignLeadDenied("BUSINESS_OWNER")).toBeNull();
    });

    it("blocks stage advance to QUALIFIED without party VÖEN", async () => {
      const { validatePartyForStage } = await import("@/lib/lead-party");
      const err = validatePartyForStage(
        {
          partyKind: "LEGAL_ENTITY",
          taxId: "123",
          companyName: "Test MMC",
          contactPhone: null,
          stage: "NEW",
        },
        "QUALIFIED",
      );
      expect(err).toMatch(/VÖEN/);
    });
  });
});
