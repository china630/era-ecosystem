import { getSubscriptionMe, type PlatformCallOptions } from "./control-plane-platform.client";

export type PlatformModuleKey =
  | "platform_booking"
  | "platform_portal"
  | "platform_payments"
  | "platform_loyalty"
  | "platform_domain"
  | "platform_delivery";

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
  if (modules.has(moduleKey)) return true;
  const short = moduleKey.replace(/^platform_/, "");
  return modules.has(short);
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
