jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

jest.mock("@/lib/prisma", () => ({ prisma: {} }));

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
    it("getSatelliteSession: no staff session -> null, module gate not reached", async () => {
      const { getSatelliteSession } = await import("@/lib/session");
      await expect(getSatelliteSession()).resolves.toBeNull();
      expect(requireSatelliteModule).not.toHaveBeenCalled();
    });

    it("requireFnbSatellite checks the module for the session org", async () => {
      const { requireFnbSatellite } = await import("@/lib/fnb-module-gate");
      await expect(requireFnbSatellite("org-1")).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_fnb_pos",
      });
      expect(requireSatelliteModule).toHaveBeenCalledWith("industry_fnb_pos", { organizationId: "org-1" });
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
