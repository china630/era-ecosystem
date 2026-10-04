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
  headers: jest.fn(async () => ({
    get: (name: string) => (name === "x-era-pathname" ? "/api/auth/me" : null),
  })),
}));

jest.mock("@/lib/prisma", () => ({ prisma: {} }));

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
    readSatelliteStaffSession: jest.fn(async () => null),
  };
});

import {
  IndustryModuleInactiveError,
  readSatelliteStaffSession,
  requireSatelliteModule,
} from "@era/satellite-kit";

describe("CRM PARTY negative paths (AC-CRM-PARTY)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireSatelliteModule as jest.Mock).mockImplementation(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    });
  });

  describe("module gate", () => {
    it("getSatelliteSession: no staff session -> null, module gate not reached", async () => {
      const { getSatelliteSession } = await import("@/lib/api-utils");
      await expect(getSatelliteSession()).resolves.toBeNull();
      expect(requireSatelliteModule).not.toHaveBeenCalled();
    });

    it("getSatelliteSession: inactive module -> IndustryModuleInactiveError for the token org", async () => {
      (readSatelliteStaffSession as jest.Mock).mockResolvedValueOnce({
        session: { sub: "u-1", login: "staff", role: "STAFF", organizationId: "org-1" },
        user: { organizationId: "org-1", active: true },
      });
      const { getSatelliteSession } = await import("@/lib/api-utils");
      await expect(getSatelliteSession()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_crm",
      });
      expect(requireSatelliteModule).toHaveBeenCalledWith("industry_crm", { organizationId: "org-1" });
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
