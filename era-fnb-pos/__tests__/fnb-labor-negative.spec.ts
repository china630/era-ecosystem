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
  };
});

import { IndustryModuleInactiveError, requireSatelliteModule } from "@era/satellite-kit";

describe("F&B LABOR negative paths (AC-FNB-LABOR)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireSatelliteModule as jest.Mock).mockImplementation(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    });
  });

  describe("module gate", () => {
    it("assertFnbEntitled rejects when module inactive", async () => {
      const { assertFnbEntitled } = await import("@/lib/api-utils");
      await expect(assertFnbEntitled()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_fnb_pos",
      });
    });

    it("requireFnbSatellite rejects on unbound/fallback org", async () => {
      const { requireFnbSatellite } = await import("@/lib/fnb-module-gate");
      await expect(requireFnbSatellite()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
      });
    });
  });

  describe("domain deny", () => {
    it("refuses clock when PIN hash does not match", async () => {
      const { hashStaffPin, pinMatches } = await import("@/lib/labor-pin");
      const stored = hashStaffPin("1234");
      expect(pinMatches(stored, "1234")).toBe(true);
      expect(pinMatches(stored, "9999")).toBe(false);
      expect(pinMatches(null, "1234")).toBe(false);
    });
  });
});
