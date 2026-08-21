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

describe("Auto APPT negative paths (AC-AUTO-APPT)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireSatelliteModule as jest.Mock).mockImplementation(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    });
  });

  describe("module gate", () => {
    it("assertAutoEntitled rejects when module inactive", async () => {
      const { assertAutoEntitled } = await import("@/lib/api-utils");
      await expect(assertAutoEntitled()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_auto_service",
      });
    });

    it("requireAutoSatellite rejects on unbound/fallback org", async () => {
      const { requireAutoSatellite } = await import("@/lib/auto-module-gate");
      await expect(requireAutoSatellite()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
      });
    });
  });

  describe("domain deny", () => {
    it("refuses appointment create without vehiclePlate", async () => {
      const { appointmentCreateDenied } = await import("@/lib/appointment-gates");
      expect(appointmentCreateDenied({ vehiclePlate: "" })).toMatch(/vehiclePlate/);
      expect(appointmentCreateDenied({ vehiclePlate: "   " })).toMatch(/vehiclePlate/);
      expect(appointmentCreateDenied({ vehiclePlate: "10-AA-100" })).toBeNull();
    });
  });
});
