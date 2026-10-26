import {
  legacyOpenEpisodeReusable,
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

  it("does not reuse a pax-scoped episode that only shares a surname", () => {
    expect(
      legacyOpenEpisodeReusable({
        reservationId: "res-1",
        hotelStayId: "res-1::pax:gulnara",
        patientFullName: "Gulnara GALMULLINA",
        guestName: "Süleyman GALMULLINA",
      }),
    ).toBe(false);
  });

  it("does not reuse the only legacy episode for a different full name", () => {
    expect(
      legacyOpenEpisodeReusable({
        reservationId: "res-1",
        hotelStayId: "res-1",
        patientFullName: "Gulnara GALMULLINA",
        guestName: "Süleyman GALMULLINA",
      }),
    ).toBe(false);
    expect(
      legacyOpenEpisodeReusable({
        reservationId: "res-1",
        hotelStayId: null,
        patientFullName: "Aliyev",
        guestName: "Ali",
      }),
    ).toBe(false);
  });

  it("reuses a legacy unbound episode only for the same full name", () => {
    expect(
      legacyOpenEpisodeReusable({
        reservationId: "res-1",
        hotelStayId: "res-1",
        patientFullName: "Gulnara  GALMULLINA",
        guestName: "gulnara galmullina",
      }),
    ).toBe(true);
  });
});
