import { randomUUID } from "crypto";
import { SATELLITE_STAFF_CLOCK_BATCH } from "@era/contracts";
import { publishToOrchestratorGateway, satelliteOrganizationId } from "@era/satellite-kit";

export async function dispatchStaffClockBatch(
  events: Array<{ staffCode: string; eventType: "CLOCK_IN" | "CLOCK_OUT"; clockedAt: string }>,
) {
  return publishToOrchestratorGateway({
    type: SATELLITE_STAFF_CLOCK_BATCH,
    organizationId: satelliteOrganizationId(),
    correlationId: randomUUID(),
    occurredAt: new Date().toISOString(),
    payload: {
      satelliteKey: "industry_fnb_pos",
      events,
    },
  });
}
