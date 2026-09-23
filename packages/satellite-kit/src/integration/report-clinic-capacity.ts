import { satelliteOrganizationId } from "../orchestrator-gateway";
import { resolveSatelliteEventServiceToken } from "../tenancy/resolve-orchestrator-url";

/**
 * Report clinic Room and Bed counts to orch capacity meters.
 * Best-effort — never throw to the caller.
 */
export async function reportClinicCapacity(input: {
  organizationId?: string;
  roomCount: number;
  bedCount: number;
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
    await fetch(`${base.replace(/\/$/, "")}/v1/internal/capacity/clinic`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        organizationId,
        roomCount: input.roomCount,
        bedCount: input.bedCount,
      }),
    });
  } catch {
    /* meter is best-effort */
  }
}
