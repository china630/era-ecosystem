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

describe("Clinic CAP negative paths (AC-CLI-CAP)", () => {
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
    it("blocks booking when capacity risk is critical", async () => {
      const { capacityBookingDenied } = await import("@/lib/capacity-booking-gates");
      expect(
        capacityBookingDenied({ bookingAllowed: false, riskLevel: "critical" }),
      ).toMatch(/blocked/i);
      expect(capacityBookingDenied({ bookingAllowed: true, riskLevel: "ok" })).toBeNull();
    });

    it("assertCapacityBookingAllowed throws on critical", async () => {
      const { assertCapacityBookingAllowed } = await import("@/lib/capacity-booking-gates");
      expect(() =>
        assertCapacityBookingAllowed({ bookingAllowed: false, riskLevel: "critical" }),
      ).toThrow(/blocked/i);
    });
  });
});
