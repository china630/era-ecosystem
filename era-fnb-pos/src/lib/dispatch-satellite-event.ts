import { randomUUID } from "crypto";
import {
  REVENUE_EVENT_TYPES,
  assertRevenueEventForPublish,
  departmentFinanceEventsSilenced,
  publishToOrchestratorGateway,
} from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";

export async function dispatchSatelliteEvent(event: {
  type: string;
  payload: Record<string, unknown>;
}) {
  const organizationId = requestOrganizationId();
  if (
    REVENUE_EVENT_TYPES.has(event.type) &&
    organizationId &&
    (await departmentFinanceEventsSilenced(organizationId))
  ) {
    return { skipped: true, reason: "day document" };
  }
  if (organizationId) {
    await assertRevenueEventForPublish({
      organizationId,
      fromSatelliteKey: "industry_fnb_pos",
      eventType: event.type,
    });
  }
  return publishToOrchestratorGateway({
    ...event,
    organizationId: requestOrganizationId(),
    correlationId: randomUUID(),
    occurredAt: new Date().toISOString(),
  });
}
