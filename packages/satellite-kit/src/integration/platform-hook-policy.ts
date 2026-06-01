import { getSubscriptionMe, type PlatformCallOptions } from "./control-plane-platform.client";

export type PlatformModuleKey =
  | "platform_booking"
  | "platform_portal"
  | "platform_payments"
  | "platform_loyalty"
  | "platform_domain"
  | "platform_delivery"
  | "platform_storage";

export function parseActiveModules(snapshot: Record<string, unknown>): Set<string> {
  const raw = snapshot.activeModules;
  if (!Array.isArray(raw)) return new Set();
  return new Set(
    raw.filter((m): m is string => typeof m === "string").map((m) => m.trim()),
  );
}

export function hasActiveModule(
  snapshot: Record<string, unknown>,
  moduleKey: PlatformModuleKey | string,
): boolean {
  const modules = parseActiveModules(snapshot);
  const canonical = moduleKey.startsWith("hotel_")
    ? resolveHotelModuleKeyForSnapshot(moduleKey)
    : moduleKey;
  if (modules.has(moduleKey) || modules.has(canonical)) return true;
  const hotelModules = snapshot.hotelModules as Record<string, boolean> | undefined;
  if (hotelModules && typeof hotelModules === "object") {
    if (hotelModules[canonical] === true || hotelModules[moduleKey] === true) return true;
  }
  const short = moduleKey.replace(/^platform_/, "");
  return modules.has(short);
}

function resolveHotelModuleKeyForSnapshot(moduleKey: string): string {
  const aliases: Record<string, string> = {
    hotel_front_office: "hotel_core",
    hotel_front_cash: "hotel_core",
    hotel_night_audit: "hotel_core",
    hotel_channel_ota: "hotel_distribution",
    hotel_contracts_yield: "hotel_distribution",
  };
  return aliases[moduleKey] ?? moduleKey;
}

export async function fetchSubscriptionSnapshot(
  organizationId: string,
  opts?: PlatformCallOptions,
): Promise<Record<string, unknown> | null> {
  try {
    return await getSubscriptionMe({ organizationId, ...opts });
  } catch {
    return null;
  }
}

export function moduleEnabled(
  snapshot: Record<string, unknown> | null,
  moduleKey: PlatformModuleKey,
  opts?: { allowWhenNoSnapshot?: boolean },
): boolean {
  if (!snapshot) return opts?.allowWhenNoSnapshot === true;
  return hasActiveModule(snapshot, moduleKey);
}
