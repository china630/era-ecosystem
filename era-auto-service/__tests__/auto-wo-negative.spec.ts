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

describe("Auto WO negative paths (AC-AUTO-WO)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireSatelliteModule as jest.Mock).mockImplementation(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    });
  });

  describe("module gate", () => {
    it("assertAutoEntitled rejects when requireSatelliteModule throws", async () => {
      const { assertAutoEntitled } = await import("@/lib/api-utils");
      await expect(assertAutoEntitled()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_auto_service",
      });
      expect(requireSatelliteModule).toHaveBeenCalledWith("industry_auto_service");
    });

    it("requireAutoSatellite rejects on unbound/fallback org", async () => {
      const { requireAutoSatellite } = await import("@/lib/auto-module-gate");
      await expect(requireAutoSatellite()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_auto_service",
      });
    });

    it("handleRouteError maps IndustryModuleInactiveError to 403", async () => {
      const { handleRouteError } = await import("@/lib/api-utils");
      const res = handleRouteError(new IndustryModuleInactiveError("industry_auto_service"));
      expect(res.status).toBe(403);
    });
  });

  describe("domain deny", () => {
    it("refuses labor/parts mutation on COMPLETED work order (no double-edit)", async () => {
      const { workOrderMutationDenied } = await import("@/lib/work-order-status");
      expect(workOrderMutationDenied("COMPLETED")).toBe("Work order is closed");
      expect(workOrderMutationDenied("OPEN")).toBeNull();
    });
  });
});
