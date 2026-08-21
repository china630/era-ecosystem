import {
  sendNotification,
  type PlatformCallOptions,
  type SendNotificationInput,
} from "./control-plane-platform.client";
import { satelliteOrganizationId } from "../orchestrator-gateway";
import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from "../tenancy/resolve-orchestrator-url";

export { satelliteOrganizationId };

export function platformNotificationsEnabled(): boolean {
  const hasOrch = Boolean(resolveOrchestratorBaseUrl({ fallback: "" }));
  const hasToken = Boolean(
    process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
      resolveSatelliteEventServiceToken(),
  );
  try {
    return Boolean(hasOrch && hasToken && satelliteOrganizationId());
  } catch {
    return false;
  }
}

/** Best-effort transactional notification; no-op when CP env is unset. */
export async function trySendPlatformNotification(
  body: SendNotificationInput,
  opts?: PlatformCallOptions,
): Promise<void> {
  if (!platformNotificationsEnabled()) return;
  const organizationId = opts?.organizationId ?? satelliteOrganizationId();
  if (!organizationId) return;
  try {
    await sendNotification(body, { ...opts, organizationId });
  } catch {
    // Platform notify is optional in satellite flows
  }
}
