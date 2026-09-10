import {
  isSatelliteHotelGuestCheckedIn,
  isSatelliteHotelGuestDeparted,
  isSatelliteHotelGuestMoved,
  SATELLITE_HOTEL_GUEST_CHECKED_IN,
  SATELLITE_HOTEL_GUEST_DEPARTED,
  SATELLITE_HOTEL_GUEST_MOVED,
  SATELLITE_HOTEL_RESERVATION_COMPLETED,
} from "@era/contracts";
import { isClinicLifecycleEvent } from "./clinic-lifecycle-event";

describe("clinic lifecycle fan-out selection", () => {
  const base = {
    organizationId: "org-1",
    correlationId: "corr-1",
    occurredAt: new Date().toISOString(),
  };

  const checkedIn = {
    ...base,
    type: SATELLITE_HOTEL_GUEST_CHECKED_IN,
    payload: { reservationId: "res-1" },
  };

  const departed = {
    ...base,
    type: SATELLITE_HOTEL_GUEST_DEPARTED,
    payload: { reservationId: "res-1", paxKey: "pax-1" },
  };

  const moved = {
    ...base,
    type: SATELLITE_HOTEL_GUEST_MOVED,
    payload: {
      reservationId: "res-2",
      fromReservationId: "res-1",
      toReservationId: "res-2",
      paxKey: "pax-1",
      newRoomNumber: "102",
    },
  };

  it("recognizes guest checked-in as clinic lifecycle", () => {
    expect(isSatelliteHotelGuestCheckedIn(checkedIn)).toBe(true);
    expect(isClinicLifecycleEvent(checkedIn)).toBe(true);
  });

  it("fans out person-level Depart guest to clinic", () => {
    expect(isSatelliteHotelGuestDeparted(departed)).toBe(true);
    expect(isClinicLifecycleEvent(departed)).toBe(true);
  });

  it("fans out person-level Move guest to clinic", () => {
    expect(isSatelliteHotelGuestMoved(moved)).toBe(true);
    expect(isClinicLifecycleEvent(moved)).toBe(true);
  });

  it("does not treat reservation completed as clinic lifecycle", () => {
    const other = {
      ...base,
      correlationId: "corr-2",
      type: SATELLITE_HOTEL_RESERVATION_COMPLETED,
      payload: {
        reservationId: "res-1",
        amountNet: 0,
        currency: "AZN",
        paymentMethod: "CASH",
        items: [],
      },
    };
    expect(isSatelliteHotelGuestCheckedIn(other)).toBe(false);
    expect(isClinicLifecycleEvent(other)).toBe(false);
  });
});
