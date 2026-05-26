import {
  sendNotification,
  type PlatformCallOptions,
  type SendNotificationInput,
} from "./control-plane-platform.client";
import { satelliteOrganizationId } from "../orchestrator-gateway";

export { satelliteOrganizationId };

export function platformNotificationsEnabled(): boolean {
  return Boolean(
    process.env.CONTROL_PLANE_URL?.trim() &&
      satelliteOrganizationId() &&
      (process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
        process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim()),
  );
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
