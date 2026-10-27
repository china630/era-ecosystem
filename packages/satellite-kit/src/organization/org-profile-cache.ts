import type { OrganizationProfileSnapshot } from "@era/contracts";
import { getRuntimeConfigMemory } from "../tenancy/runtime-config-memory";

const byOrg = new Map<string, OrganizationProfileSnapshot>();

export function setCachedOrgProfile(
  organizationId: string,
  profile: OrganizationProfileSnapshot | null | undefined,
): void {
  const id = organizationId.trim();
  if (!id) return;
  if (!profile) {
    byOrg.delete(id);
    return;
  }
  byOrg.set(id, profile);
}

export function getCachedOrgProfile(
  organizationId?: string | null,
): OrganizationProfileSnapshot | null {
  const id = organizationId?.trim();
  if (id && byOrg.has(id)) return byOrg.get(id) ?? null;
  const mem = getRuntimeConfigMemory().orgProfile;
  if (mem && (!id || mem.organizationId === id)) return mem;
  return null;
}

export function clearOrgProfileCacheForTests(): void {
  byOrg.clear();
}
