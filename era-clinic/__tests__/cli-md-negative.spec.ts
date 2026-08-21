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

describe("Clinic MD negative paths (AC-CLI-MD)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireSatelliteModule as jest.Mock).mockImplementation(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    });
  });

  describe("module gate", () => {
    it("requireClinicModule rejects inactive submodule", async () => {
      const { requireClinicModule } = await import("@/lib/clinic-module-gate");
      await expect(requireClinicModule("clinic_master_data")).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "clinic_master_data",
      });
    });
  });

  describe("domain deny", () => {
    it("refuses booking against inactive practitioner", async () => {
      const { practitionerBookableDenied } = await import("@/lib/master-data-gates");
      expect(practitionerBookableDenied({ found: false })).toMatch(/not found/i);
      expect(practitionerBookableDenied({ found: true, active: false })).toMatch(/inactive/i);
      expect(practitionerBookableDenied({ found: true, active: true })).toBeNull();
    });

    it("refuses inactive catalog item for new use", async () => {
      const { inactiveCatalogDenied } = await import("@/lib/master-data-gates");
      expect(inactiveCatalogDenied(false, "Resource")).toMatch(/inactive/i);
      expect(inactiveCatalogDenied(true)).toBeNull();
    });
  });
});
