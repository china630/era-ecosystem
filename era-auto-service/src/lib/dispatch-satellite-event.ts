import { randomUUID } from "crypto";
import { publishToOrchestratorGateway } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";

export async function dispatchSatelliteEvent(event: {
  type: string;
  payload: Record<string, unknown>;
}) {
  return publishToOrchestratorGateway({
    ...event,
    organizationId: requestOrganizationId(),
    correlationId: randomUUID(),
    occurredAt: new Date().toISOString(),
  });
}
