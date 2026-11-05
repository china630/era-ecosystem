import { randomUUID } from "node:crypto";
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
  globalPersonId?: string;
  /** Prefer stable entity id for Finance idempotency (e.g. procedureOrderId). */
  correlationId?: string;
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
      fromSatelliteKey: "industry_clinic",
      eventType: event.type,
    });
  }
  const { correlationId, ...rest } = event;
  return publishToOrchestratorGateway({
    ...rest,
    organizationId: requestOrganizationId(),
    correlationId: correlationId?.trim() || randomUUID(),
    occurredAt: new Date().toISOString(),
  });
}
