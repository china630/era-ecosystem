import {
  SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED,
  SATELLITE_HOTEL_RESERVATION_COMPLETED,
  SATELLITE_HOTEL_INVOICE_ISSUED,
  SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT,
  SATELLITE_HOTEL_AGENCY_COMMISSION_PAYABLE,
  SATELLITE_HOTEL_GUEST_CHECKED_IN,
  SATELLITE_HOTEL_GUEST_CHECKED_OUT,
  SATELLITE_HOTEL_ROOM_CHANGED,
  type SatelliteHotelNightAuditClosedEvent,
  type SatelliteHotelReservationCompletedEvent,
  type SatelliteHotelInvoiceIssuedEvent,
  type SatelliteHotelCityLedgerSnapshotEvent,
  type SatelliteHotelAgencyCommissionPayableEvent,
  type SatelliteHotelGuestCheckedInEvent,
  type SatelliteHotelGuestCheckedOutEvent,
  type SatelliteHotelRoomChangedEvent,
} from "@era/contracts";
import { publishToOrchestratorGateway as publishViaKit } from "@era/satellite-kit/orchestrator-gateway";
import type { IntegrationEnvelope, NightAuditPayload } from "./event-types";

export function envelopeToReservationCompletedEvent(
  envelope: IntegrationEnvelope,
  organizationId: string,
): SatelliteHotelReservationCompletedEvent | null {
  if (envelope.eventType !== SATELLITE_HOTEL_RESERVATION_COMPLETED) {
    return null;
  }
  const payload = envelope.payload as {
    reservationId: string;
    guestVoen: string | null;
    amountNet: number;
    currency: "AZN";
    breakdown: Array<{
      sku: string;
      qty: number;
      price: number;
      itemType?: string;
    }>;
  };
  return {
    type: SATELLITE_HOTEL_RESERVATION_COMPLETED,
    organizationId,
    correlationId: envelope.correlationId,
    occurredAt: envelope.timestamp,
    payload: {
      reservationId: payload.reservationId,
      amountNet: payload.amountNet,
      guestVoen: payload.guestVoen,
      currency: payload.currency,
      items: payload.breakdown.map((line) => ({
        sku: line.sku,
        qty: line.qty,
        price: line.price,
        itemType: line.itemType,
      })),
    },
  };
}

export function envelopeToNightAuditClosedEvent(
  envelope: IntegrationEnvelope,
  organizationId: string,
): SatelliteHotelNightAuditClosedEvent | null {
  if (envelope.eventType !== SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED) {
    return null;
  }
  const payload = envelope.payload as NightAuditPayload;
  return {
    type: SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED,
    organizationId,
    correlationId: envelope.correlationId,
    occurredAt: envelope.timestamp,
    payload: {
      businessDate: payload.businessDate,
      nightAuditId: payload.nightAuditId,
      currency: payload.currency,
      documentVersion: payload.documentVersion,
      moneyLines: (payload.moneyLines ?? []).map((line) => ({
        revenueCode: line.revenueCode,
        amount: line.amount,
        vatRate: line.vatRate,
        glAccountCode: line.glAccountCode?.trim() ?? "",
        unmapped: line.unmapped,
      })),
      qtyLines: (payload.qtyLines ?? []).map((line) => ({
        sku: line.sku.trim(),
        qty: line.qty,
        warehouseCode: line.warehouseCode?.trim() ?? "",
        purpose: line.purpose,
      })),
      saleLines: (payload.saleLines ?? [])
        .filter((line) => line.sku.trim().length > 0)
        .map((line) => ({
          sku: line.sku.trim(),
          qty: line.qty,
          amount: line.amount,
          revenueCode: line.revenueCode?.trim() ?? "",
          glAccountCode: line.glAccountCode?.trim() ?? "",
        })),
      revenueLines: (payload.revenueLines ?? []).map((line) => ({
        revenueCode: line.revenueCode,
        amount: line.amount,
        glAccountCode: line.glAccountCode ?? "",
        unmapped: line.unmapped,
      })),
      paymentLines: payload.paymentLines,
      depositReceiptLines: payload.depositReceiptLines,
      depositCarryLines: payload.depositCarryLines,
      depositPayoutLines: payload.depositPayoutLines,
    },
  };
}

export function envelopeToInvoiceIssuedEvent(
  envelope: IntegrationEnvelope,
  organizationId: string,
): SatelliteHotelInvoiceIssuedEvent | null {
  if (envelope.eventType !== SATELLITE_HOTEL_INVOICE_ISSUED) {
    return null;
  }
  const payload = envelope.payload as SatelliteHotelInvoiceIssuedEvent["payload"];
  return {
    type: SATELLITE_HOTEL_INVOICE_ISSUED,
    organizationId,
    correlationId: envelope.correlationId,
    occurredAt: envelope.timestamp,
    payload,
  };
}

export function envelopeToCityLedgerSnapshotEvent(
  envelope: IntegrationEnvelope,
  organizationId: string,
): SatelliteHotelCityLedgerSnapshotEvent | null {
  if (envelope.eventType !== SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT) {
    return null;
  }
  const payload = envelope.payload as SatelliteHotelCityLedgerSnapshotEvent["payload"];
  return {
    type: SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT,
    organizationId,
    correlationId: envelope.correlationId,
    occurredAt: envelope.timestamp,
    payload,
  };
}

export function envelopeToAgencyCommissionPayableEvent(
  envelope: IntegrationEnvelope,
  organizationId: string,
): SatelliteHotelAgencyCommissionPayableEvent | null {
  if (envelope.eventType !== SATELLITE_HOTEL_AGENCY_COMMISSION_PAYABLE) {
    return null;
  }
  const payload = envelope.payload as SatelliteHotelAgencyCommissionPayableEvent["payload"];
  return {
    type: SATELLITE_HOTEL_AGENCY_COMMISSION_PAYABLE,
    organizationId,
    correlationId: envelope.correlationId,
    occurredAt: envelope.timestamp,
    payload,
  };
}

export function envelopeToGuestCheckedInEvent(
  envelope: IntegrationEnvelope,
  organizationId: string,
): SatelliteHotelGuestCheckedInEvent | null {
  if (envelope.eventType !== SATELLITE_HOTEL_GUEST_CHECKED_IN) return null;
  const payload = envelope.payload as unknown as SatelliteHotelGuestCheckedInEvent["payload"];
  return {
    type: SATELLITE_HOTEL_GUEST_CHECKED_IN,
    organizationId,
    correlationId: envelope.correlationId,
    occurredAt: envelope.timestamp,
    globalPersonId: payload.globalPersonId,
    payload,
  };
}

export function envelopeToGuestCheckedOutEvent(
  envelope: IntegrationEnvelope,
  organizationId: string,
): SatelliteHotelGuestCheckedOutEvent | null {
  if (envelope.eventType !== SATELLITE_HOTEL_GUEST_CHECKED_OUT) return null;
  const payload = envelope.payload as unknown as SatelliteHotelGuestCheckedOutEvent["payload"];
  return {
    type: SATELLITE_HOTEL_GUEST_CHECKED_OUT,
    organizationId,
    correlationId: envelope.correlationId,
    occurredAt: envelope.timestamp,
    globalPersonId: payload.globalPersonId,
    payload,
  };
}

export function envelopeToRoomChangedEvent(
  envelope: IntegrationEnvelope,
  organizationId: string,
): SatelliteHotelRoomChangedEvent | null {
  if (envelope.eventType !== SATELLITE_HOTEL_ROOM_CHANGED) return null;
  const payload = envelope.payload as unknown as SatelliteHotelRoomChangedEvent["payload"];
  return {
    type: SATELLITE_HOTEL_ROOM_CHANGED,
    organizationId,
    correlationId: envelope.correlationId,
    occurredAt: envelope.timestamp,
    globalPersonId: payload.globalPersonId,
    payload,
  };
}

export type OrchestratorGatewayResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

/**
 * Publishes typed satellite events to era-orchestrator ingress.
 * Uses kit resolve (runtime-config + install token) — not raw process.env.
 */
export async function publishToOrchestratorGateway(
  event:
    | SatelliteHotelReservationCompletedEvent
    | SatelliteHotelNightAuditClosedEvent
    | SatelliteHotelInvoiceIssuedEvent
    | SatelliteHotelCityLedgerSnapshotEvent
    | SatelliteHotelAgencyCommissionPayableEvent
    | SatelliteHotelGuestCheckedInEvent
    | SatelliteHotelGuestCheckedOutEvent
    | SatelliteHotelRoomChangedEvent,
): Promise<OrchestratorGatewayResult> {
  return publishViaKit(event as Record<string, unknown>);
}
