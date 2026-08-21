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
      // Simulate unbound / source=fallback (kit fail-closed).
      throw new IndustryModuleInactiveError(moduleKey);
    }),
  };
});

import { IndustryModuleInactiveError, requireSatelliteModule } from "@era/satellite-kit";

describe("F&B POS negative paths (AC-FNB-POS)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireSatelliteModule as jest.Mock).mockImplementation(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    });
  });

  describe("module gate", () => {
    it("assertFnbEntitled rejects when requireSatelliteModule throws IndustryModuleInactiveError", async () => {
      const { assertFnbEntitled } = await import("@/lib/api-utils");
      await expect(assertFnbEntitled()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_fnb_pos",
      });
      expect(requireSatelliteModule).toHaveBeenCalledWith("industry_fnb_pos");
    });

    it("requireFnbSatellite rejects on unbound/fallback org (source fallback)", async () => {
      const { requireFnbSatellite } = await import("@/lib/fnb-module-gate");
      await expect(requireFnbSatellite()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_fnb_pos",
      });
    });

    it("handleRouteError maps IndustryModuleInactiveError to 403", async () => {
      const { handleRouteError } = await import("@/lib/api-utils");
      const res = handleRouteError(new IndustryModuleInactiveError("industry_fnb_pos"));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/industry_fnb_pos/);
    });
  });

  describe("domain deny", () => {
    it("refuses mutations on CLOSED ticket", async () => {
      const { ticketMutationBlockedReason } = await import("@/lib/ticket-status-gates");
      expect(ticketMutationBlockedReason("CLOSED")).toMatch(/CLOSED/);
      expect(ticketMutationBlockedReason("OPEN")).toBeNull();
    });

    it("blocks cash pay for hotel folio settlement", async () => {
      const { payBlockedReason } = await import("@/lib/billing-router-core");
      expect(payBlockedReason("HOTEL_FOLIO")).toMatch(/room charge/i);
    });
  });
});
