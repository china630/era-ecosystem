import { randomUUID } from "crypto";
import { departmentFinanceEventsSilenced, publishToOrchestratorGateway } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";

const DAY_DOCUMENT_EVENTS = new Set([
  "SATELLITE_CLINIC_VISIT_COMPLETED",
  "SATELLITE_CLINIC_PROCEDURE_COMPLETED",
  "SATELLITE_CLINIC_LAB_ORDER_COMPLETED",
  "SATELLITE_CLINIC_WARD_DAY_CHARGE",
]);

export async function dispatchSatelliteEvent(event: {
  type: string;
  payload: Record<string, unknown>;
  globalPersonId?: string;
  /** Prefer stable entity id for Finance idempotency (e.g. procedureOrderId). */
  correlationId?: string;
}) {
  const organizationId = requestOrganizationId();
  if (
    DAY_DOCUMENT_EVENTS.has(event.type) &&
    organizationId &&
    (await departmentFinanceEventsSilenced(organizationId))
  ) {
    return { skipped: true, reason: "day document" };
  }
  const { correlationId, ...rest } = event;
  return publishToOrchestratorGateway({
    ...rest,
    organizationId: requestOrganizationId(),
    correlationId: correlationId?.trim() || randomUUID(),
    occurredAt: new Date().toISOString(),
  });
}
