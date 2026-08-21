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

describe("Retail POS negative paths (AC-RET-POS)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireSatelliteModule as jest.Mock).mockImplementation(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    });
  });

  describe("module gate", () => {
    it("assertRetailEntitled rejects when requireSatelliteModule throws", async () => {
      const { assertRetailEntitled } = await import("@/lib/api-utils");
      await expect(assertRetailEntitled()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_retail",
      });
      expect(requireSatelliteModule).toHaveBeenCalledWith("industry_retail");
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
      const body = await res.json();
      expect(body.error).toMatch(/industry_retail/);
    });
  });

  describe("domain deny", () => {
    it("refuses void on PAID receipt (must return instead)", async () => {
      const { receiptVoidDenied } = await import("@/lib/receipt-status-gates");
      expect(receiptVoidDenied("PAID")).toBe("Paid receipts must be returned, not voided");
      expect(receiptVoidDenied("OPEN")).toBeNull();
    });

    it("refuses promo on non-OPEN receipt", async () => {
      const { receiptPromoDenied } = await import("@/lib/receipt-status-gates");
      expect(receiptPromoDenied("PAID")).toMatch(/OPEN/);
      expect(receiptPromoDenied("OPEN")).toBeNull();
    });

    it("refuses line void on non-OPEN receipt", async () => {
      const { receiptLineVoidDenied } = await import("@/lib/receipt-status-gates");
      expect(receiptLineVoidDenied("PAID")).toMatch(/open/i);
      expect(receiptLineVoidDenied("OPEN")).toBeNull();
    });

    it("rejects apparel line missing size/color", async () => {
      const { validateReceiptLine } = await import("@/lib/receipt-line-validation");
      const err = validateReceiptLine(
        "apparel",
        {
          description: "Shirt",
          qty: 1,
          unitPrice: 10,
          plu: "SKU-1",
        },
        0,
      );
      expect(err).toMatch(/size/i);
    });
  });
});
