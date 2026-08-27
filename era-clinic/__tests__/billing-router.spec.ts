jest.mock("@/lib/dispatch-satellite-event", () => ({
  dispatchSatelliteEvent: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    visit: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@era/satellite-kit", () => ({
  resolveOperatingMode: jest.fn().mockResolvedValue({
    mode: "STANDALONE",
    parentOrgId: null,
    fiscalRouting: "OWN",
    revenueRouting: "OWN",
  }),
  resolveSettlementPolicy: jest.fn().mockResolvedValue({
    settlementHub: "SATELLITE_OWN",
    pendingSettlementNaPolicy: "BLOCK",
    hubOrganizationId: null,
    deferWalkInToHub: false,
  }),
  shouldRouteRevenueToParent: jest.fn().mockReturnValue(false),
  shouldDeferWalkInToHub: jest.fn().mockReturnValue(false),
}));

jest.mock("@/lib/request-organization", () => ({
  requestOrganizationId: jest.fn().mockReturnValue("org1"),
}));

describe("billing-router", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("routes WALK_IN visit to finance event", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    const { dispatchSatelliteEvent } = jest.requireMock("@/lib/dispatch-satellite-event");
    prisma.visit.findUnique.mockResolvedValue({
      id: "v1",
      amountNet: 25,
      billingTarget: null,
      patientOrigin: "WALK_IN",
      reservationId: null,
      roomNumber: null,
      patientRef: { refCode: "P1", globalPersonId: "gp1" },
      serviceLines: [{ serviceCode: "CONSULT" }],
    });

    const { completeVisitBilling } = await import("@/lib/billing-router");
    const result = await completeVisitBilling("v1");
    expect(result.channel).toBe("finance");
    expect(dispatchSatelliteEvent).toHaveBeenCalled();
  });

  it("routes IN_HOUSE visit to hotel folio when configured", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;
    process.env.POS_BRIDGE_SECRET = "secret";

    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.visit.findUnique.mockResolvedValue({
      id: "v2",
      amountNet: 40,
      billingTarget: "HOTEL_FOLIO",
      patientOrigin: "IN_HOUSE",
      reservationId: "res1",
      roomNumber: "101",
      patientRef: { refCode: "P2", globalPersonId: "gp2" },
      serviceLines: [{ serviceCode: "PROC" }],
    });

    const { completeVisitBilling } = await import("@/lib/billing-router");
    const result = await completeVisitBilling("v2");
    expect(result.channel).toBe("hotel_folio");
  });
});
