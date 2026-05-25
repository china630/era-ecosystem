import { SatelliteEventIdempotencyService } from "./satellite-event-idempotency.service";

describe("SatelliteEventIdempotencyService", () => {
  const prisma = {
    satelliteEventProcessed: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  let service: SatelliteEventIdempotencyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SatelliteEventIdempotencyService(prisma as never);
  });

  it("returns null when correlationId not seen", async () => {
    prisma.satelliteEventProcessed.findUnique.mockResolvedValue(null);
    const out = await service.findExisting("org-1", "corr-a");
    expect(out).toBeNull();
  });

  it("returns stored result on replay", async () => {
    prisma.satelliteEventProcessed.findUnique.mockResolvedValue({
      transactionId: "tx-1",
      invoiceId: "inv-1",
      resultJson: { shiftId: "s1" },
    });
    const out = await service.findExisting("org-1", "corr-a");
    expect(out).toEqual({
      transactionId: "tx-1",
      invoiceId: "inv-1",
      resultJson: { shiftId: "s1" },
    });
  });

  it("records processed event with meta", async () => {
    prisma.satelliteEventProcessed.create.mockResolvedValue({});
    await service.record("org-1", "corr-b", "SATELLITE_RETAIL_SHIFT_CLOSED", {
      meta: { shiftId: "s2", totalSales: 100 },
    });
    expect(prisma.satelliteEventProcessed.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        correlationId: "corr-b",
        eventType: "SATELLITE_RETAIL_SHIFT_CLOSED",
        transactionId: null,
        invoiceId: null,
        resultJson: { shiftId: "s2", totalSales: 100 },
      },
    });
  });
});
