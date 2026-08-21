import { randomUUID } from "crypto";
import { publishToOrchestratorGateway, satelliteOrganizationId } from "@era/satellite-kit";

export async function dispatchSatelliteEvent(event: {
  type: string;
  payload: Record<string, unknown>;
  globalPersonId?: string;
  /** Prefer stable entity id for Finance idempotency (e.g. procedureOrderId). */
  correlationId?: string;
}) {
  const { correlationId, ...rest } = event;
  return publishToOrchestratorGateway({
    ...rest,
    organizationId: satelliteOrganizationId(),
    correlationId: correlationId?.trim() || randomUUID(),
    occurredAt: new Date().toISOString(),
  });
}
