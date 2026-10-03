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

describe("F&B INV negative paths (AC-FNB-INV)", () => {
  const prevStock = process.env.STOCK_CONSUMPTION_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.STOCK_CONSUMPTION_ENABLED;
    (requireSatelliteModule as jest.Mock).mockImplementation(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    });
  });

  afterAll(() => {
    if (prevStock === undefined) delete process.env.STOCK_CONSUMPTION_ENABLED;
    else process.env.STOCK_CONSUMPTION_ENABLED = prevStock;
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
    it("stock consumption stays off unless STOCK_CONSUMPTION_ENABLED=true", async () => {
      const { isStockConsumptionEnabled } = await import("@/lib/stock-consumption");
      expect(isStockConsumptionEnabled()).toBe(false);
      process.env.STOCK_CONSUMPTION_ENABLED = "true";
      expect(isStockConsumptionEnabled()).toBe(true);
    });

    it("excludes VOID lines from recipe depletion payload", async () => {
      const { buildStockConsumptionLines } = await import("@/lib/stock-consumption");
      const lines = buildStockConsumptionLines([
        {
          id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          kitchenStatus: "VOID",
          qty: 2,
          description: "Soup",
          menuItem: { recipeSku: "SKU-SOUP", plu: "P1" },
        },
        {
          id: "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee",
          kitchenStatus: "DONE",
          qty: 1,
          description: "Salad",
          menuItem: { recipeSku: "SKU-SALAD", plu: null },
        },
      ]);
      expect(lines).toEqual([{ sku: "SKU-SALAD", qty: 1, description: "Salad" }]);
    });
  });
});
