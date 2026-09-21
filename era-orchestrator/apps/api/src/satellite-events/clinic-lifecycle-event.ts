import {
  isSatelliteHotelGuestCheckedIn,
  isSatelliteHotelGuestCheckedOut,
  isSatelliteHotelGuestDeparted,
  isSatelliteHotelGuestMoved,
  isSatelliteHotelRoomChanged,
  isSatelliteHotelSanatoriumBookingCreated,
  isSatelliteHotelStayProductChanged,
} from "@era/contracts";

/** Hotel → clinic lifecycle events that orchestrator fans out to clinic hotel-lifecycle. */
export function isClinicLifecycleEvent(data: unknown): boolean {
  return (
    isSatelliteHotelGuestCheckedIn(data) ||
    isSatelliteHotelGuestCheckedOut(data) ||
    isSatelliteHotelGuestDeparted(data) ||
    isSatelliteHotelGuestMoved(data) ||
    isSatelliteHotelRoomChanged(data) ||
    isSatelliteHotelSanatoriumBookingCreated(data) ||
    isSatelliteHotelStayProductChanged(data)
  );
}
