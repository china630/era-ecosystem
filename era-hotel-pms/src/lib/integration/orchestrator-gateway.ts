import axios, { AxiosError } from "axios";
import {
  SATELLITE_HOTEL_RESERVATION_COMPLETED,
  type SatelliteHotelReservationCompletedEvent,
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
  event: SatelliteHotelReservationCompletedEvent,
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
