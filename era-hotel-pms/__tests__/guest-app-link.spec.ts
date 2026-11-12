import {
  assertChallengeUsable,
  buildTripPack,
  mintSessionToken,
  organizationIdFromGuestToken,
  questionnaireGaps,
  statusForLinkError,
} from "@/lib/services/guest-app-link.service";

describe("guest-app-link", () => {
  const now = new Date("2026-11-11T12:00:00.000Z");
  const org = "org-a";
  const guest = "pax-1";

  it("embeds organizationId in the guest session token", () => {
    const token = mintSessionToken(org);
    expect(organizationIdFromGuestToken(token)).toBe(org);
    expect(organizationIdFromGuestToken("no-dot")).toBeNull();
  });

  it("rejects expired and consumed codes", () => {
    expect(
      assertChallengeUsable({
        now,
        organizationId: org,
        challenge: {
          organizationId: org,
          reservationGuestId: guest,
          expiresAt: new Date("2026-11-11T11:59:00.000Z"),
          consumedAt: null,
        },
      }),
    ).toBe("EXPIRED");
    expect(
      assertChallengeUsable({
        now,
        organizationId: org,
        challenge: {
          organizationId: org,
          reservationGuestId: guest,
          expiresAt: new Date("2026-11-11T12:05:00.000Z"),
          consumedAt: now,
        },
      }),
    ).toBe("CONSUMED");
    expect(statusForLinkError("EXPIRED")).toBe(401);
  });

  it("rejects another guest on the same booking and another organization", () => {
    expect(
      assertChallengeUsable({
        now,
        organizationId: org,
        expectedGuestId: "pax-2",
        challenge: {
          organizationId: org,
          reservationGuestId: guest,
          expiresAt: new Date("2026-11-11T12:05:00.000Z"),
          consumedAt: null,
        },
      }),
    ).toBe("WRONG_GUEST");
    expect(statusForLinkError("WRONG_GUEST")).toBe(403);
    expect(
      assertChallengeUsable({
        now,
        organizationId: "org-b",
        challenge: {
          organizationId: org,
          reservationGuestId: guest,
          expiresAt: new Date("2026-11-11T12:05:00.000Z"),
          consumedAt: null,
        },
      }),
    ).toBe("WRONG_ORG");
    expect(statusForLinkError("WRONG_ORG")).toBe(404);
  });

  it("builds a trip pack without a foreign reservation transfer", () => {
    const pack = buildTripPack({
      loadedAt: now,
      reservationGuestId: guest,
      hotel: { name: "Test", address: "Addr", phone: "+994" },
      reservation: {
        id: "res-1",
        status: "CONFIRMED",
        resNo: "R1",
        voucherNo: null,
        checkIn: now,
        checkOut: now,
        paxGuests: [{ id: "pax-1", firstName: "A", lastName: "B", isPrimary: true }],
        transferOrders: [
          {
            direction: "ARRIVAL",
            flightNo: "J2",
            pickupAt: now,
            notes: "driver",
            status: "BOOKED",
            vehicle: { code: "VAN1" },
          },
        ],
      },
    });
    expect(pack.transfers).toHaveLength(1);
    expect(pack.reservationId).toBe("res-1");
  });

  it("lists questionnaire gaps and does not mark ready without a document", () => {
    expect(
      questionnaireGaps({
        sex: "M",
        birthDate: new Date("1990-01-01"),
        nationality: "TR",
        passportNo: null,
        idCardNo: null,
        phone: null,
        ageYears: 36,
      }),
    ).toEqual(["document"]);
  });
});
