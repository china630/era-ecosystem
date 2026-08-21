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

jest.mock("@/lib/logistics-module-gate", () => {
  const { IndustryModuleInactiveError } = jest.requireMock("@era/satellite-kit") as {
    IndustryModuleInactiveError: new (k: string) => Error;
  };
  return {
    IndustryModuleInactiveError,
    requireLogisticsSatellite: jest.fn(),
  };
});

jest.mock("@/lib/prisma", () => ({
  prisma: {
    trip: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    vehicle: {
      findUnique: jest.fn(),
      create: jest.fn(),
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

describe("Logistics trip negative paths (AC-LOG-TRIP)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("assertLogisticsEntitled / module gate", () => {
    it("denies trip list when industry_logistics inactive", async () => {
      const gate = jest.requireMock("@/lib/logistics-module-gate") as {
        requireLogisticsSatellite: jest.Mock;
        IndustryModuleInactiveError: new (k: string) => Error;
      };
      gate.requireLogisticsSatellite.mockRejectedValue(
        new gate.IndustryModuleInactiveError("industry_logistics"),
      );
      const { GET } = await import("../app/api/trips/route");
      const res = await GET();
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/Industry module not active/);
    });
  });

  describe("status transitions", () => {
    it("refuses invalid transition from PLANNED to DELIVERED", async () => {
      const { prisma } = jest.requireMock("@/lib/prisma") as {
        prisma: { trip: { findUnique: jest.Mock } };
      };
      prisma.trip.findUnique.mockResolvedValue({
        id: "t1",
        status: "PLANNED",
        startedAt: null,
      });
      const { PATCH } = await import("../app/api/trips/[id]/route");
      const res = await PATCH(
        new Request("http://localhost/api/trips/t1", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "DELIVERED" }),
        }),
        { params: Promise.resolve({ id: "t1" }) },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Invalid transition/);
    });

    it("refuses status change on COMPLETED trip", async () => {
      const { prisma } = jest.requireMock("@/lib/prisma") as {
        prisma: { trip: { findUnique: jest.Mock } };
      };
      prisma.trip.findUnique.mockResolvedValue({
        id: "t1",
        status: "COMPLETED",
        startedAt: new Date(),
      });
      const { PATCH } = await import("../app/api/trips/[id]/route");
      const res = await PATCH(
        new Request("http://localhost/api/trips/t1", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "IN_TRANSIT" }),
        }),
        { params: Promise.resolve({ id: "t1" }) },
      );
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(/Trip cannot change status/);
    });
  });

  describe("foreign / missing trip", () => {
    it("returns 404 for unknown trip on complete", async () => {
      const { prisma } = jest.requireMock("@/lib/prisma") as {
        prisma: { trip: { findUnique: jest.Mock } };
      };
      prisma.trip.findUnique.mockResolvedValue(null);
      const { POST } = await import("../app/api/trips/[id]/complete/route");
      const res = await POST(
        new Request("http://localhost/api/trips/missing/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
        { params: Promise.resolve({ id: "missing" }) },
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toMatch(/Trip not found/);
    });
  });
});
