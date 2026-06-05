import {
  isSatelliteHotelGuestCheckedIn,
  SATELLITE_HOTEL_GUEST_CHECKED_IN,
  SATELLITE_HOTEL_RESERVATION_COMPLETED,
} from "@era/contracts";

describe("clinic lifecycle fan-out selection", () => {
  const checkedIn = {
    type: SATELLITE_HOTEL_GUEST_CHECKED_IN,
    organizationId: "org-1",
    correlationId: "corr-1",
    occurredAt: new Date().toISOString(),
    payload: { reservationId: "res-1" },
  };

  it("recognizes guest checked-in as clinic lifecycle", () => {
    expect(isSatelliteHotelGuestCheckedIn(checkedIn)).toBe(true);
  });

  it("does not treat reservation completed as clinic lifecycle", () => {
    const other = {
      type: SATELLITE_HOTEL_RESERVATION_COMPLETED,
      organizationId: "org-1",
      correlationId: "corr-2",
      occurredAt: new Date().toISOString(),
      payload: {
        reservationId: "res-1",
        amountNet: 0,
        currency: "AZN" as const,
        paymentMethod: "CASH",
        items: [],
      },
    };
    expect(isSatelliteHotelGuestCheckedIn(other)).toBe(false);
  });
});
