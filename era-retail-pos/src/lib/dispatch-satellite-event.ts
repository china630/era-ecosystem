import { randomUUID } from "crypto";
import { departmentFinanceEventsSilenced, publishToOrchestratorGateway } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";

export async function dispatchSatelliteEvent(event: {
  type: string;
  payload: Record<string, unknown>;
}) {
  const organizationId = requestOrganizationId();
  if (
    event.type === "SATELLITE_RETAIL_SALE_COMPLETED" &&
    organizationId &&
    (await departmentFinanceEventsSilenced(organizationId))
  ) {
    return { skipped: true, reason: "day document" };
  }
  return publishToOrchestratorGateway({
    ...event,
    organizationId: requestOrganizationId(),
    correlationId: randomUUID(),
    occurredAt: new Date().toISOString(),
  });
}
