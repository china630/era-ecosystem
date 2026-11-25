import { randomUUID } from "crypto";
import { publishToOrchestratorGateway } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";

export async function dispatchSatelliteEvent(event: {
  type: string;
  payload: Record<string, unknown>;
  organizationId?: string;
}) {
  const organizationId =
    event.organizationId?.trim() || requestOrganizationId() || "";
  if (!organizationId) {
    throw new Error("organizationId required to dispatch satellite event");
  }
  return publishToOrchestratorGateway({
    type: event.type,
    payload: event.payload,
    organizationId,
    correlationId: randomUUID(),
    occurredAt: new Date().toISOString(),
  });
}
