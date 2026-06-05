import {
  isSatelliteClinicProcedureCompleted,
  isSatelliteClinicPrescriptionIssued,
  isSatelliteHotelGuestCheckedIn,
  isSatelliteHotelSanatoriumBookingCreated,
} from "@era/contracts";

describe("clinic vNext contracts", () => {
  it("accepts procedure completed event", () => {
    const event = {
      organizationId: "org-1",
      correlationId: "c-1",
      occurredAt: new Date().toISOString(),
      type: "SATELLITE_CLINIC_PROCEDURE_COMPLETED",
      payload: {
        patientRef: "P-1",
        patientOrigin: "WALK_IN",
        procedureCode: "MASSAGE",
        amountNet: 50,
        currency: "AZN",
        lines: [{ sku: "SYR-1", qty: 1 }],
      },
    };
    expect(isSatelliteClinicProcedureCompleted(event)).toBe(true);
  });

  it("accepts prescription issued event", () => {
    const event = {
      organizationId: "org-1",
      correlationId: "c-2",
      occurredAt: new Date().toISOString(),
      type: "SATELLITE_CLINIC_PRESCRIPTION_ISSUED",
      payload: {
        visitId: "v-1",
        patientRef: "P-1",
        patientOrigin: "IN_HOUSE",
        lines: [{ sku: "MED-1", qty: 2 }],
        currency: "AZN",
      },
    };
    expect(isSatelliteClinicPrescriptionIssued(event)).toBe(true);
  });

  it("accepts guest checked in", () => {
    const event = {
      organizationId: "org-1",
      correlationId: "c-3",
      occurredAt: new Date().toISOString(),
      type: "SATELLITE_HOTEL_GUEST_CHECKED_IN",
      payload: { reservationId: "res-1", programCode: "DETOX-7" },
    };
    expect(isSatelliteHotelGuestCheckedIn(event)).toBe(true);
  });

  it("accepts sanatorium booking created", () => {
    const event = {
      organizationId: "org-1",
      correlationId: "c-4",
      occurredAt: new Date().toISOString(),
      type: "SATELLITE_HOTEL_SANATORIUM_BOOKING_CREATED",
      payload: {
        reservationId: "res-2",
        programCode: "DETOX-7",
        checkInDate: "2026-06-10",
        checkOutDate: "2026-06-17",
      },
    };
    expect(isSatelliteHotelSanatoriumBookingCreated(event)).toBe(true);
  });
});
