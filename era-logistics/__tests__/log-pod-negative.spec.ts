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
  };
});

jest.mock("@/lib/prisma", () => ({
  prisma: {
    trip: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe("Logistics POD / fuel negative paths (AC-LOG-POD)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POD capture", () => {
    it("rejects POD without recipient", async () => {
      const { POST } = await import("../app/api/trips/[id]/pod/route");
      const res = await POST(
        new Request("http://localhost/api/trips/t1/pod", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ notes: "left at door" }),
        }),
        { params: Promise.resolve({ id: "t1" }) },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Validation failed/);
    });

    it("returns 404 for unknown trip POD", async () => {
      const { prisma } = jest.requireMock("@/lib/prisma") as {
        prisma: { trip: { findUnique: jest.Mock } };
      };
      prisma.trip.findUnique.mockResolvedValue(null);
      const { POST } = await import("../app/api/trips/[id]/pod/route");
      const res = await POST(
        new Request("http://localhost/api/trips/missing/pod", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ recipient: "Ali" }),
        }),
        { params: Promise.resolve({ id: "missing" }) },
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toMatch(/Trip not found/);
    });
  });

  describe("fuel report", () => {
    it("rejects non-positive liters", async () => {
      const { POST } = await import("../app/api/trips/[id]/fuel-report/route");
      const res = await POST(
        new Request("http://localhost/api/trips/t1/fuel-report", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ liters: 0, cost: 10 }),
        }),
        { params: Promise.resolve({ id: "t1" }) },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Validation failed/);
    });

    it("returns 404 for fuel report on unknown trip", async () => {
      const { prisma } = jest.requireMock("@/lib/prisma") as {
        prisma: { trip: { findUnique: jest.Mock } };
      };
      prisma.trip.findUnique.mockResolvedValue(null);
      const { POST } = await import("../app/api/trips/[id]/fuel-report/route");
      const res = await POST(
        new Request("http://localhost/api/trips/missing/fuel-report", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ liters: 45.5, cost: 68.25 }),
        }),
        { params: Promise.resolve({ id: "missing" }) },
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toMatch(/Trip not found/);
    });
  });
});
