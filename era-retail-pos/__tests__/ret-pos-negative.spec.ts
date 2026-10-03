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
  headers: jest.fn(async () => ({
    get: (name: string) => (name === "x-era-pathname" ? "/api/auth/me" : null),
  })),
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
    readSatelliteStaffSession: jest.fn(async () => null),
  };
});

import {
  IndustryModuleInactiveError,
  readSatelliteStaffSession,
  requireSatelliteModule,
} from "@era/satellite-kit";

describe("Retail POS negative paths (AC-RET-POS)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireSatelliteModule as jest.Mock).mockImplementation(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    });
  });

  describe("module gate", () => {
    it("getSatelliteSession: no staff session -> null, module gate not reached", async () => {
      const { getSatelliteSession } = await import("@/lib/api-utils");
      await expect(getSatelliteSession()).resolves.toBeNull();
      expect(requireSatelliteModule).not.toHaveBeenCalled();
    });

    it("getSatelliteSession: inactive module -> IndustryModuleInactiveError for the token org", async () => {
      (readSatelliteStaffSession as jest.Mock).mockResolvedValueOnce({
        session: { sub: "u-1", login: "staff", role: "STAFF", organizationId: "org-1" },
        user: { organizationId: "org-1", active: true },
      });
      const { getSatelliteSession } = await import("@/lib/api-utils");
      await expect(getSatelliteSession()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_retail",
      });
      expect(requireSatelliteModule).toHaveBeenCalledWith("industry_retail", { organizationId: "org-1" });
    });

    it("requireRetailSatellite checks the module for the given org", async () => {
      const { requireRetailSatellite } = await import("@/lib/retail-module-gate");
      await expect(requireRetailSatellite("org-1")).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_retail",
      });
      expect(requireSatelliteModule).toHaveBeenCalledWith("industry_retail", { organizationId: "org-1" });
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
