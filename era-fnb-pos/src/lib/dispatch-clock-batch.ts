import { randomUUID } from "crypto";
import { SATELLITE_STAFF_CLOCK_BATCH } from "@era/contracts";
import { publishToOrchestratorGateway } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";

export async function dispatchStaffClockBatch(
  events: Array<{ staffCode: string; eventType: "CLOCK_IN" | "CLOCK_OUT"; clockedAt: string }>,
) {
  return publishToOrchestratorGateway({
    type: SATELLITE_STAFF_CLOCK_BATCH,
    organizationId: requestOrganizationId(),
    correlationId: randomUUID(),
    occurredAt: new Date().toISOString(),
    payload: {
      satelliteKey: "industry_fnb_pos",
      events,
    },
  });
}
