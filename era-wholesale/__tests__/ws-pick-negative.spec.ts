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
    pickListLine: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    pickList: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    b2BOrder: {
      findUnique: jest.fn(),
    },
  },
}));

describe("Wholesale pick negative paths (AC-WS-PICK)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("pick line confirm", () => {
    it("refuses qtyPicked exceeding ordered qty", async () => {
      const { prisma } = jest.requireMock("@/lib/prisma") as {
        prisma: { pickListLine: { findFirst: jest.Mock } };
      };
      prisma.pickListLine.findFirst.mockResolvedValue({
        id: "line1",
        pickListId: "pl1",
        qtyOrdered: 5,
        qtyPicked: 0,
        pickList: { id: "pl1", status: "OPEN", lines: [] },
      });
      const { PATCH } = await import(
        "../app/api/pick-lists/[id]/lines/[lineId]/route"
      );
      const res = await PATCH(
        new Request("http://localhost/api/pick-lists/pl1/lines/line1", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ qtyPicked: 6 }),
        }),
        { params: Promise.resolve({ id: "pl1", lineId: "line1" }) },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/qtyPicked exceeds ordered qty/);
    });

    it("returns 404 for unknown pick line", async () => {
      const { prisma } = jest.requireMock("@/lib/prisma") as {
        prisma: { pickListLine: { findFirst: jest.Mock } };
      };
      prisma.pickListLine.findFirst.mockResolvedValue(null);
      const { PATCH } = await import(
        "../app/api/pick-lists/[id]/lines/[lineId]/route"
      );
      const res = await PATCH(
        new Request("http://localhost/api/pick-lists/pl1/lines/missing", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ qtyPicked: 1 }),
        }),
        { params: Promise.resolve({ id: "pl1", lineId: "missing" }) },
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toMatch(/Pick line not found/);
    });
  });

  describe("create pick list", () => {
    it("returns 404 when order number missing", async () => {
      const { prisma } = jest.requireMock("@/lib/prisma") as {
        prisma: { b2BOrder: { findUnique: jest.Mock } };
      };
      prisma.b2BOrder.findUnique.mockResolvedValue(null);
      const { POST } = await import("../app/api/pick-lists/route");
      const res = await POST(
        new Request("http://localhost/api/pick-lists", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            orderNumber: "NO-SUCH",
            lines: [{ skuCode: "SKU1", qtyOrdered: 2 }],
          }),
        }),
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toMatch(/Order not found/);
    });
  });
});
