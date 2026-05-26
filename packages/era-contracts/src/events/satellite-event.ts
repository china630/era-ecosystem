import { isSatelliteAutoWorkOrderCompleted } from "./auto-sto.events";
import {
  isSatelliteClinicLabOrderCompleted,
  isSatelliteClinicVisitCompleted,
} from "./clinic.events";
import { isSatelliteConstructionProgressActApproved } from "./construction.events";
import {
  isSatelliteCrmLeadConverted,
  isSatelliteCrmVisitLogged,
} from "./crm-field.events";
import { isSatelliteHotelNightAuditClosed, isSatelliteHotelReservationCompleted, isSatelliteHotelInvoiceIssued, isSatelliteHotelCityLedgerSnapshot } from "./hotel.events";
import { isSatelliteLogisticsTripCompleted } from "./logistics.events";
import {
  isSatelliteRetailSaleCompleted,
  isSatelliteRetailShiftClosed,
} from "./retail.events";
import { isSatelliteWholesaleOrderConfirmed } from "./wholesale.events";
import { isSatelliteFbStockConsumptionCompleted } from "./fb.events";

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
    isSatelliteRetailSaleCompleted(data) ||
    isSatelliteRetailShiftClosed(data) ||
    isSatelliteLogisticsTripCompleted(data) ||
    isSatelliteConstructionProgressActApproved(data) ||
    isSatelliteCrmLeadConverted(data) ||
    isSatelliteCrmVisitLogged(data) ||
    isSatelliteAutoWorkOrderCompleted(data) ||
    isSatelliteClinicVisitCompleted(data) ||
    isSatelliteClinicLabOrderCompleted(data) ||
    isSatelliteWholesaleOrderConfirmed(data) ||
    isSatelliteFbStockConsumptionCompleted(data)
  );
}

export function getSatelliteEventType(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("type" in data)) return null;
  const t = (data as { type: unknown }).type;
  return typeof t === "string" ? t : null;
}
