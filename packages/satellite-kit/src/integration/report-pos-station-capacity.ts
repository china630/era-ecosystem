import { satelliteOrganizationId } from "../orchestrator-gateway";
import { resolveSatelliteEventServiceToken } from "../tenancy/resolve-orchestrator-url";

/**
 * Report ERA till/register count (not KKM rows) to orch capacity meter.
 * Best-effort — never throw to the caller.
 */
export async function reportPosStationCapacity(input: {
  organizationId?: string;
  satelliteKey: string;
  billableStationCount: number;
}): Promise<void> {
  const organizationId =
    input.organizationId?.trim() ||
    (() => {
      try {
        return satelliteOrganizationId();
      } catch {
        return "";
      }
    })();
  if (!organizationId) return;
  const base =
    process.env.CONTROL_PLANE_URL?.trim() ||
    process.env.ORCHESTRATOR_URL?.trim();
  const token = resolveSatelliteEventServiceToken();
  if (!base || !token) return;
  try {
    await fetch(`${base.replace(/\/$/, "")}/v1/internal/capacity/pos-stations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        organizationId,
        satelliteKey: input.satelliteKey,
        billableStationCount: input.billableStationCount,
      }),
    });
  } catch {
    /* meter is best-effort */
  }
}
