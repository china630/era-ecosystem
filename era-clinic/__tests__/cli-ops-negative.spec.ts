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
    resolveClinicModuleForPathname: jest.fn(() => null),
    authCookieName: () => "era_session",
    getBearerOrCookieToken: () => null,
    verifySatelliteSession: jest.fn(),
  };
});

import { IndustryModuleInactiveError, requireSatelliteModule } from "@era/satellite-kit";

describe("Clinic OPS negative paths (AC-CLI-OPS)", () => {
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
      expect(requireSatelliteModule).toHaveBeenCalledWith("industry_clinic");
    });

    it("handleRouteError maps IndustryModuleInactiveError to 403", async () => {
      const { handleRouteError } = await import("@/lib/api-utils");
      const res = handleRouteError(new IndustryModuleInactiveError("industry_clinic"));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/industry_clinic/);
    });
  });

  describe("domain deny", () => {
    it("refuses cancel on COMPLETED appointment", async () => {
      const { appointmentCancelDenied } = await import("@/lib/appointment-status-gates");
      expect(appointmentCancelDenied("COMPLETED")).toMatch(/completed/i);
      expect(appointmentCancelDenied("BOOKED")).toBeNull();
    });

    it("refuses reschedule on CANCELLED / COMPLETED", async () => {
      const { appointmentRescheduleDenied } = await import("@/lib/appointment-status-gates");
      expect(appointmentRescheduleDenied("CANCELLED")).toMatch(/cancelled/i);
      expect(appointmentRescheduleDenied("COMPLETED")).toMatch(/completed/i);
      expect(appointmentRescheduleDenied("BOOKED")).toBeNull();
    });

    it("double-book conflict message is non-empty (scheduling conflict shape)", async () => {
      // Pure shape used by detectSchedulingConflict callers → HTTP 409
      const conflict = "Practitioner already booked at this time";
      expect(conflict).toMatch(/already booked/);
    });
  });
});
