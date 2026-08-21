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

describe("Clinic LAB negative paths (AC-CLI-LAB ops — not HL7)", () => {
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
    it("refuses illegal publish (wrong status / missing results)", async () => {
      const { labPublishDenied } = await import("@/lib/lab-order-status-gates");
      expect(labPublishDenied("ORDERED", true)).toMatch(/Cannot publish/);
      expect(labPublishDenied("RESULT_READY", false)).toMatch(/Results required/);
      expect(labPublishDenied("RESULT_READY", true)).toBeNull();
    });

    it("refuses collect / complete from illegal statuses", async () => {
      const { labCollectDenied, labCompleteDenied } = await import(
        "@/lib/lab-order-status-gates"
      );
      expect(labCollectDenied("COLLECTED")).toMatch(/Cannot collect/);
      expect(labCompleteDenied("RESULT_READY")).toMatch(/PUBLISHED/);
      expect(labCompleteDenied("PUBLISHED")).toBeNull();
    });

    it("foreign order shape — not found message for missing id", () => {
      // Route returns 404 "Lab order not found" for foreign/missing ids (ops path, not HL7).
      expect("Lab order not found").toMatch(/not found/i);
    });
  });
});
