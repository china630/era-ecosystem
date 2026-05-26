import axios, { AxiosError } from "axios";
import {
  SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED,
  SATELLITE_HOTEL_RESERVATION_COMPLETED,
  SATELLITE_HOTEL_INVOICE_ISSUED,
  SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT,
  type SatelliteHotelNightAuditClosedEvent,
  type SatelliteHotelReservationCompletedEvent,
  type SatelliteHotelInvoiceIssuedEvent,
  type SatelliteHotelCityLedgerSnapshotEvent,
} from "@era/contracts";
import type { IntegrationEnvelope } from "./event-types";

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
    paymentMethod: string;
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
      paymentMethod: payload.paymentMethod,
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
  const payload = envelope.payload as {
    businessDate: string;
    nightAuditId?: string;
    currency: "AZN";
    revenueLines: Array<{ revenueCode: string; amount: number; glAccountCode?: string }>;
    paymentLines: Array<{ method: string; amount: number }>;
  };
  return {
    type: SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED,
    organizationId,
    correlationId: envelope.correlationId,
    occurredAt: envelope.timestamp,
    payload: {
      businessDate: payload.businessDate,
      nightAuditId: payload.nightAuditId,
      currency: payload.currency,
      revenueLines: payload.revenueLines.map((line) => ({
        revenueCode: line.revenueCode,
        amount: line.amount,
        glAccountCode: line.glAccountCode ?? "601",
      })),
      paymentLines: payload.paymentLines,
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

export type OrchestratorGatewayResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

/**
 * Publishes typed satellite events to era-365-orchestrator ingress.
 * `POST ${ORCHESTRATOR_EVENT_URL}/api/v1/satellite-events` with service token.
 */
export async function publishToOrchestratorGateway(
  event:
    | SatelliteHotelReservationCompletedEvent
    | SatelliteHotelNightAuditClosedEvent
    | SatelliteHotelInvoiceIssuedEvent
    | SatelliteHotelCityLedgerSnapshotEvent,
): Promise<OrchestratorGatewayResult> {
  const baseUrl =
    process.env.ORCHESTRATOR_EVENT_URL ??
    process.env.ORCHESTRATOR_URL ??
    "http://localhost:4100";
  const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN ?? "";
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/satellite-events`;

  try {
    const res = await axios.post(url, event, {
      timeout: Number(process.env.ORCHESTRATOR_EVENT_TIMEOUT_MS ?? 15_000),
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status };
  } catch (err) {
    const message =
      err instanceof AxiosError
        ? `${err.message}${err.response ? ` (${err.response.status})` : ""}`
        : err instanceof Error
          ? err.message
          : "Unknown error";
    return { ok: false, error: message };
  }
}
