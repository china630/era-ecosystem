import { randomUUID } from "crypto";
import { publishToOrchestratorGateway, satelliteOrganizationId } from "@era/satellite-kit";

export async function dispatchSatelliteEvent(event: {
  type: string;
  payload: Record<string, unknown>;
}) {
  return publishToOrchestratorGateway({
    ...event,
    organizationId: satelliteOrganizationId(),
    correlationId: randomUUID(),
    occurredAt: new Date().toISOString(),
  });
}
