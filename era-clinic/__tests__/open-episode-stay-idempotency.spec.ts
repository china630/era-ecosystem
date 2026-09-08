import {
  resolveHotelPatientRefCode,
  resolveHotelStayId,
} from "@/lib/services/sanatorium.service";

describe("openEpisodeFromStay stay identity (idempotency)", () => {
  it("resolveHotelStayId is stable for primary guest without MDM/pax", () => {
    expect(
      resolveHotelStayId({
        reservationId: "res-abc",
        hotelStayId: "res-abc",
      }),
    ).toBe("res-abc");
  });

  it("resolveHotelStayId scopes MDM and pax on same reservation", () => {
    const resId = "res-share-1";
    const husband = resolveHotelStayId({
      reservationId: resId,
      paxKey: "pax-h",
    });
    const wife = resolveHotelStayId({
      reservationId: resId,
      paxKey: "pax-w",
    });
    const mdm = resolveHotelStayId({
      reservationId: resId,
      globalPersonId: "gp-wife",
      paxKey: "pax-ignored",
    });
    expect(husband).not.toBe(wife);
    expect(mdm).toContain("::mdm:gp-wife");
    expect(husband).toContain("::pax:pax-h");
  });

  it("legacy HOTEL ref still differs from clinic-native P-* allocation path", () => {
    const legacy = resolveHotelPatientRefCode({
      reservationId: "res-1",
      passportNumber: "res-1",
    });
    expect(legacy.startsWith("HOTEL-")).toBe(true);
    // New creates use allocatePatientRefCode (P-*); stay idempotency must key off
    // hotelStayId / OPEN episode, not legacyRef alone.
    expect(legacy).not.toMatch(/^P-/);
  });

  it("two concurrent primary check-ins share the same stay id (Şirinov case)", () => {
    const a = resolveHotelStayId({ reservationId: "uuid-res-77" });
    const b = resolveHotelStayId({ reservationId: "uuid-res-77" });
    expect(a).toBe(b);
    expect(a).toBe("uuid-res-77");
  });
});
