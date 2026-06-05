import { getSatelliteEventType } from "@era/contracts";

describe("hotel lifecycle idempotency contract", () => {
  it("extracts correlationId from lifecycle event body", () => {
    const body = {
      type: "SATELLITE_HOTEL_GUEST_CHECKED_IN",
      organizationId: "org-1",
      correlationId: "corr-dedupe-1",
      occurredAt: new Date().toISOString(),
      payload: { reservationId: "res-1" },
    };
    expect(getSatelliteEventType(body)).toBe("SATELLITE_HOTEL_GUEST_CHECKED_IN");
  });

  it("recognizes sanatorium booking created type", () => {
    const body = {
      type: "SATELLITE_HOTEL_SANATORIUM_BOOKING_CREATED",
      organizationId: "org-1",
      correlationId: "corr-book-1",
      occurredAt: new Date().toISOString(),
      payload: { reservationId: "res-2", programCode: "DETOX-7" },
    };
    expect(getSatelliteEventType(body)).toBe(
      "SATELLITE_HOTEL_SANATORIUM_BOOKING_CREATED",
    );
    expect((body as { correlationId: string }).correlationId).toBe("corr-book-1");
  });
});
