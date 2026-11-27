import { readResourceBusyDetails } from "@/domain/procedure/resource-busy-message";

describe("readResourceBusyDetails", () => {
  it("reads nested details from check-in error body", () => {
    const details = readResourceBusyDetails({
      error: "Resource already has a checked-in procedure",
      code: "RESOURCE_BUSY",
      details: {
        resourceId: "r1",
        resourceName: "Kabina 6 (Halqa)",
        blockingOrderId: "o1",
        blockingGuestName: "Nicolae Postica",
        blockingActualEndsAt: "2026-11-27T07:31:57.000Z",
      },
    });
    expect(details?.resourceName).toBe("Kabina 6 (Halqa)");
    expect(details?.blockingGuestName).toBe("Nicolae Postica");
    expect(details?.blockingActualEndsAt).toContain("2026-11-27");
  });

  it("returns undefined for unrelated errors", () => {
    expect(
      readResourceBusyDetails({ error: "Guest QR required", code: "QR_REQUIRED" }),
    ).toBeUndefined();
  });

  it("unwraps Nest message object", () => {
    const details = readResourceBusyDetails({
      statusCode: 409,
      message: {
        error: "Resource already has a checked-in procedure",
        code: "RESOURCE_BUSY",
        details: {
          resourceName: "Kabina 6 (Halqa)",
          blockingGuestName: "Nicolae Postica",
          blockingActualEndsAt: "2026-11-27T07:31:57.000Z",
        },
      },
    });
    expect(details?.resourceName).toBe("Kabina 6 (Halqa)");
    expect(details?.blockingGuestName).toBe("Nicolae Postica");
  });
});
