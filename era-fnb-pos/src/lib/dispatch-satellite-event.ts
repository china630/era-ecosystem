import { randomUUID } from "crypto";
import { departmentFinanceEventsSilenced, publishToOrchestratorGateway } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";

const DAY_DOCUMENT_EVENTS = new Set([
  "SATELLITE_FB_SALE_COMPLETED",
  "SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED",
  "SATELLITE_FB_SHIFT_CLOSED",
]);

export async function dispatchSatelliteEvent(event: {
  type: string;
  payload: Record<string, unknown>;
}) {
  const organizationId = requestOrganizationId();
  if (
    DAY_DOCUMENT_EVENTS.has(event.type) &&
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
