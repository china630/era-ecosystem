import { isSatelliteAutoWorkOrderCompleted } from "./auto-sto.events";
import {
  isSatelliteClinicLabOrderCompleted,
  isSatelliteClinicPrescriptionIssued,
  isSatelliteClinicProcedureCompleted,
  isSatelliteClinicVisitCompleted,
} from "./clinic.events";
import { isSatelliteConstructionProgressActApproved } from "./construction.events";
import {
  isSatelliteCrmLeadConverted,
  isSatelliteCrmVisitLogged,
} from "./crm-field.events";
import {
  isSatelliteHotelCityLedgerSnapshot,
  isSatelliteHotelGuestCheckedIn,
  isSatelliteHotelGuestCheckedOut,
  isSatelliteHotelInvoiceIssued,
  isSatelliteHotelNightAuditClosed,
  isSatelliteHotelReservationCompleted,
  isSatelliteHotelRoomChanged,
  isSatelliteHotelSanatoriumBookingCreated,
} from "./hotel.events";
import { isSatelliteLogisticsTripCompleted } from "./logistics.events";
import {
  isSatelliteRetailSaleCompleted,
  isSatelliteRetailShiftClosed,
} from "./retail.events";
import { isSatelliteWholesaleOrderConfirmed } from "./wholesale.events";
import { isSatelliteFbStockConsumptionCompleted } from "./fb.events";
import {
  isSatelliteBankGlDailySummary,
} from "./banking.events";
import {
  isSatelliteStaffClockBatch,
  isSatelliteStaffDeactivated,
  isSatelliteStaffProvisioned,
} from "./hr.events";

export type KnownSatelliteEvent = { type: string };

export function isSatelliteEvent(data: unknown): data is KnownSatelliteEvent & {
  organizationId: string;
  correlationId: string;
} {
  return (
    isSatelliteHotelReservationCompleted(data) ||
    isSatelliteHotelNightAuditClosed(data) ||
    isSatelliteHotelInvoiceIssued(data) ||
    isSatelliteHotelCityLedgerSnapshot(data) ||
    isSatelliteHotelGuestCheckedIn(data) ||
    isSatelliteHotelGuestCheckedOut(data) ||
    isSatelliteHotelRoomChanged(data) ||
    isSatelliteHotelSanatoriumBookingCreated(data) ||
    isSatelliteRetailSaleCompleted(data) ||
    isSatelliteRetailShiftClosed(data) ||
    isSatelliteLogisticsTripCompleted(data) ||
    isSatelliteConstructionProgressActApproved(data) ||
    isSatelliteCrmLeadConverted(data) ||
    isSatelliteCrmVisitLogged(data) ||
    isSatelliteAutoWorkOrderCompleted(data) ||
    isSatelliteClinicVisitCompleted(data) ||
    isSatelliteClinicLabOrderCompleted(data) ||
    isSatelliteClinicProcedureCompleted(data) ||
    isSatelliteClinicPrescriptionIssued(data) ||
    isSatelliteWholesaleOrderConfirmed(data) ||
    isSatelliteFbStockConsumptionCompleted(data) ||
    isSatelliteStaffProvisioned(data) ||
    isSatelliteStaffDeactivated(data) ||
    isSatelliteStaffClockBatch(data) ||
    isSatelliteBankGlDailySummary(data)
  );
}

export function getSatelliteEventType(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("type" in data)) return null;
  const t = (data as { type: unknown }).type;
  return typeof t === "string" ? t : null;
}
