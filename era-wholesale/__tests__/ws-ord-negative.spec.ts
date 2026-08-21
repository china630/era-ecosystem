jest.mock("@era/satellite-kit", () => {
  class IndustryModuleInactiveError extends Error {
    status = 403;
    moduleKey: string;
    constructor(moduleKey: string) {
      super(`Industry module not active: ${moduleKey}`);
      this.name = "IndustryModuleInactiveError";
      this.moduleKey = moduleKey;
    }
  }
  return {
    IndustryModuleInactiveError,
    requireSatelliteModule: jest.fn(),
    authCookieName: () => "era_session",
    getBearerOrCookieToken: jest.fn(() => null),
    verifySatelliteSession: jest.fn(),
    satelliteOrganizationId: jest.fn(() => null),
  };
});

jest.mock("@/lib/wholesale-module-gate", () => {
  const { IndustryModuleInactiveError } = jest.requireMock("@era/satellite-kit") as {
    IndustryModuleInactiveError: new (k: string) => Error;
  };
  return {
    IndustryModuleInactiveError,
    requireWholesaleSatellite: jest.fn(),
  };
});

jest.mock("@/lib/prisma", () => ({
  prisma: {
    b2BOrder: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/dispatch-satellite-event", () => ({
  dispatchSatelliteEvent: jest.fn(),
}));

jest.mock("@/lib/platform-notify", () => ({
  trySendPlatformNotification: jest.fn(),
}));

jest.mock("@/integration/control-plane-platform.client", () => ({
  createPaymentLink: jest.fn(),
  createPortalLink: jest.fn(),
  createShipment: jest.fn(),
  createBookingSlot: jest.fn(),
  createPromotion: jest.fn(),
  createCustomDomain: jest.fn(),
}));

describe("Wholesale order negative paths (AC-WS-ORD)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("assertWholesaleEntitled / module gate", () => {
    it("denies order list when industry_wholesale inactive", async () => {
      const gate = jest.requireMock("@/lib/wholesale-module-gate") as {
        requireWholesaleSatellite: jest.Mock;
        IndustryModuleInactiveError: new (k: string) => Error;
      };
      gate.requireWholesaleSatellite.mockRejectedValue(
        new gate.IndustryModuleInactiveError("industry_wholesale"),
      );
      const { GET } = await import("../app/api/orders/route");
      const res = await GET();
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/Industry module not active/);
    });
  });

  describe("confirm order", () => {
    it("returns 404 for unknown order id", async () => {
      const { prisma } = jest.requireMock("@/lib/prisma") as {
        prisma: { b2BOrder: { findUnique: jest.Mock } };
      };
      prisma.b2BOrder.findUnique.mockResolvedValue(null);
      const { POST } = await import("../app/api/orders/[id]/confirm/route");
      const res = await POST(
        new Request("http://localhost/api/orders/missing/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
        { params: Promise.resolve({ id: "missing" }) },
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toMatch(/Order not found/);
    });
  });

  describe("create order validation", () => {
    it("rejects invalid create payload", async () => {
      const gate = jest.requireMock("@/lib/wholesale-module-gate") as {
        requireWholesaleSatellite: jest.Mock;
      };
      gate.requireWholesaleSatellite.mockResolvedValue(undefined);
      const { POST } = await import("../app/api/orders/route");
      const res = await POST(
        new Request("http://localhost/api/orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderNumber: "X1" }),
        }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Validation failed/);
    });
  });
});
