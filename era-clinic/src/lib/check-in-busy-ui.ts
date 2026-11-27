import { bakuTimeLabel } from "@/lib/baku-day";
import {
  readResourceBusyDetails,
  type ResourceBusyDetails,
} from "@/domain/procedure/resource-busy-message";

type BusyT = {
  (key: "resourceBusy", values: { cabin: string; guest: string; time: string }): string;
  (key: "resourceBusyNoTime", values: { cabin: string; guest: string }): string;
  (key: "resourceBusyGeneric"): string;
  (key: string, values?: Record<string, string>): string;
};

/**
 * Human message for RESOURCE_BUSY from check-in API body.
 * Returns null when the payload is not a cabin-busy error (caller keeps parseApiError).
 */
export function formatCheckInBusyMessage(
  payload: unknown,
  t: BusyT,
): string | null {
  const details = readResourceBusyDetails(payload);
  if (!details) return null;
  return formatBusyDetails(details, t) ?? t("resourceBusyGeneric");
}

export function formatBusyDetails(
  details: ResourceBusyDetails,
  t: BusyT,
): string | null {
  const cabin = details.resourceName?.trim() || "";
  const guest = details.blockingGuestName?.trim() || "";
  if (!cabin && !guest) return t("resourceBusyGeneric");
  const cabinLabel = cabin || "—";
  const guestLabel = guest || "—";
  if (details.blockingActualEndsAt) {
    return t("resourceBusy", {
      cabin: cabinLabel,
      guest: guestLabel,
      time: bakuTimeLabel(details.blockingActualEndsAt),
    });
  }
  return t("resourceBusyNoTime", { cabin: cabinLabel, guest: guestLabel });
}
