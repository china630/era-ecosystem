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

describe("Construction PLAT negative paths (AC-CON-PLAT)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireSatelliteModule as jest.Mock).mockImplementation(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    });
  });

  describe("module gate", () => {
    it("assertConstructionEntitled rejects when module inactive", async () => {
      const { assertConstructionEntitled } = await import("@/lib/api-utils");
      await expect(assertConstructionEntitled()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_construction",
      });
    });

    it("requireConstructionSatellite rejects on unbound/fallback org", async () => {
      const { requireConstructionSatellite } = await import("@/lib/construction-module-gate");
      await expect(requireConstructionSatellite()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
      });
    });
  });

  describe("domain deny", () => {
    it("refuses platform cron when secret set and Authorization missing", async () => {
      const { cronUnauthorized } = await import("@/lib/cron-auth");
      expect(cronUnauthorized(null, "secret-1")).toBe(true);
      expect(cronUnauthorized("Bearer wrong", "secret-1")).toBe(true);
      expect(cronUnauthorized("Bearer secret-1", "secret-1")).toBe(false);
    });
  });
});
