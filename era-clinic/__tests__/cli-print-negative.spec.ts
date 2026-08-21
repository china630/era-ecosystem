jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
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
    it("assertClinicEntitled rejects when industry_clinic inactive", async () => {
      const { assertClinicEntitled } = await import("@/lib/clinic-module-gate");
      await expect(assertClinicEntitled()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_clinic",
      });
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
