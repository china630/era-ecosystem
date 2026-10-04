jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
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
    resolveClinicModuleForPathname: jest.fn(() => null),
  };
});

import { IndustryModuleInactiveError, requireSatelliteModule } from "@era/satellite-kit";

describe("Clinic PRINT negative paths (AC-CLI-PRINT)", () => {
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

    it("requireClinicSatellite checks the module for the session org", async () => {
      const { requireClinicSatellite } = await import("@/lib/clinic-module-gate");
      await expect(requireClinicSatellite("org-1")).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_clinic",
      });
      expect(requireSatelliteModule).toHaveBeenCalledWith("industry_clinic", { organizationId: "org-1" });
    });
  });

  describe("domain deny", () => {
    it("refuses print when source entity missing", async () => {
      const { printDocumentDenied } = await import("@/lib/print-form-gates");
      expect(printDocumentDenied({ entityFound: false })).toMatch(/not found/i);
      expect(printDocumentDenied({ entityFound: true, lang: "en" })).toBeNull();
    });

    it("refuses unsupported print language", async () => {
      const { printDocumentDenied } = await import("@/lib/print-form-gates");
      expect(printDocumentDenied({ entityFound: true, lang: "de" })).toMatch(/language/i);
    });
  });
});
