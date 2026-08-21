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

describe("Retail STOCK negative paths (AC-RET-STOCK)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireSatelliteModule as jest.Mock).mockImplementation(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    });
  });

  describe("module gate", () => {
    it("assertRetailEntitled rejects when module inactive", async () => {
      const { assertRetailEntitled } = await import("@/lib/api-utils");
      await expect(assertRetailEntitled()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_retail",
      });
    });

    it("requireRetailSatellite rejects on unbound/fallback org", async () => {
      const { requireRetailSatellite } = await import("@/lib/retail-module-gate");
      await expect(requireRetailSatellite()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_retail",
      });
    });

    it("handleRouteError maps IndustryModuleInactiveError to 403", async () => {
      const { handleRouteError } = await import("@/lib/api-utils");
      const res = handleRouteError(new IndustryModuleInactiveError("industry_retail"));
      expect(res.status).toBe(403);
    });
  });

  describe("domain deny", () => {
    it("refuses stock write-off with empty lines", async () => {
      const { stockWriteOffDenied } = await import("@/lib/stock-gates");
      expect(stockWriteOffDenied([])).toBe("lines required");
      expect(stockWriteOffDenied(null)).toBe("lines required");
      expect(stockWriteOffDenied([{ sku: "A", qty: 1 }])).toBeNull();
    });
  });
});
