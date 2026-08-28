import { randomUUID } from "crypto";
import { publishToOrchestratorGateway } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";

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
    organizationId: requestOrganizationId(),
    correlationId: correlationId?.trim() || randomUUID(),
    occurredAt: new Date().toISOString(),
  });
}
