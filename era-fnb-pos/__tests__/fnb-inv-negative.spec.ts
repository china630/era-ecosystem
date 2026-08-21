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
