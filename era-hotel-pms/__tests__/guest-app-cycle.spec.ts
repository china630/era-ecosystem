import {
  assertBookingRequestDates,
  assertStayOrderKind,
  familyGrantAllowsResults,
  familyGrantAllowsTimetable,
  guestBookingPublicStatus,
  isOtaEmail,
  stayOrderKindAllowed,
} from "@/lib/services/guest-app-cycle.service";

describe("guest-app-cycle", () => {
  it("rejects inverted booking dates", () => {
    expect(
      assertBookingRequestDates(
        new Date("2026-11-12T00:00:00.000Z"),
        new Date("2026-11-10T00:00:00.000Z"),
      ),
    ).toBe("BAD_DATES");
  });

  it("maps answered reservation statuses for the guest", () => {
    expect(
      guestBookingPublicStatus({ requestStatus: "REQUESTED", reservationStatus: null }),
    ).toBe("requested");
    expect(
      guestBookingPublicStatus({
        requestStatus: "ANSWERED",
        reservationStatus: "CONFIRMED",
      }),
    ).toBe("confirmed");
    expect(
      guestBookingPublicStatus({
        requestStatus: "ANSWERED",
        reservationStatus: "OPTION",
      }),
    ).toBe("awaiting_payment");
  });

  it("accepts stay order kinds and rejects unknown", () => {
    expect(assertStayOrderKind("HOUSEKEEPING")).toBe(true);
    expect(assertStayOrderKind("CONCIERGE")).toBe(false);
  });

  it("honors owner enabledOrderKinds when the list is non-empty", () => {
    expect(stayOrderKindAllowed("HOUSEKEEPING", null)).toBe(true);
    expect(stayOrderKindAllowed("HOUSEKEEPING", [])).toBe(true);
    expect(stayOrderKindAllowed("HOUSEKEEPING", ["DND"])).toBe(false);
    expect(stayOrderKindAllowed("DND", ["DND", "TOWELS"])).toBe(true);
  });

  it("family grant needs desk confirm and never opens results", () => {
    expect(
      familyGrantAllowsTimetable({ revokedAt: null, deskConfirmedAt: null }),
    ).toBe(false);
    expect(
      familyGrantAllowsTimetable({
        revokedAt: null,
        deskConfirmedAt: new Date(),
      }),
    ).toBe(true);
    expect(familyGrantAllowsResults()).toBe(false);
  });

  it("rejects OTA relay emails for OTP", () => {
    expect(isOtaEmail("x@guest.booking.com")).toBe(true);
    expect(isOtaEmail("guest@example.com")).toBe(false);
  });
});
