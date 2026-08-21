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

describe("CRM PARTY negative paths (AC-CRM-PARTY)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireSatelliteModule as jest.Mock).mockImplementation(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    });
  });

  describe("module gate", () => {
    it("assertCrmEntitled rejects when module inactive", async () => {
      const { assertCrmEntitled } = await import("@/lib/api-utils");
      await expect(assertCrmEntitled()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_crm",
      });
    });

    it("requireCrmSatellite rejects on unbound/fallback org", async () => {
      const { requireCrmSatellite } = await import("@/lib/crm-module-gate");
      await expect(requireCrmSatellite()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
      });
    });

    it("handleRouteError maps IndustryModuleInactiveError to 403", async () => {
      const { handleRouteError } = await import("@/lib/api-utils");
      const res = handleRouteError(new IndustryModuleInactiveError("industry_crm"));
      expect(res.status).toBe(403);
    });
  });

  describe("domain deny", () => {
    it("requires company name for legal entity at QUALIFIED+", async () => {
      const { validatePartyForStage } = await import("@/lib/lead-party");
      const err = validatePartyForStage(
        {
          partyKind: "LEGAL_ENTITY",
          taxId: "1234567890",
          companyName: "  ",
          contactPhone: null,
          stage: "CONTACTED",
        },
        "PROPOSAL",
      );
      expect(err).toMatch(/Company name/);
    });

    it("requires phone for individual at QUALIFIED+", async () => {
      const { validatePartyForStage } = await import("@/lib/lead-party");
      const err = validatePartyForStage(
        {
          partyKind: "INDIVIDUAL",
          taxId: null,
          companyName: null,
          contactPhone: null,
          stage: "NEW",
        },
        "WON",
      );
      expect(err).toMatch(/phone/i);
    });

    it("rejects empty import rows as individual without phone", async () => {
      const { mapRowToImport } = await import("@/lib/lead-import");
      const result = mapRowToImport(["", "", ""], {}, 1);
      expect(result).toEqual({ error: "Individual row requires phone" });
    });

    it("rejects named individual import row without phone", async () => {
      const { mapRowToImport } = await import("@/lib/lead-import");
      const result = mapRowToImport(["Only Name"], { donor_names: 0 }, 2);
      expect(result).toEqual({ error: "Individual row requires phone" });
    });
  });
});
