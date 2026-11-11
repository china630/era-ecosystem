/**
 * Placement hop write-freeze — mutations return 423 while org is frozen.
 * Flag arrives via runtime-config Sync (`placementFreeze` / `placementFrozenOrgIds`)
 * or env `ERA_PLACEMENT_FROZEN_ORG_IDS` (comma-separated UUIDs).
 */

import { getRuntimeConfigMemory } from "../tenancy/runtime-config-memory";

function envFrozenOrgIds(): string[] {
  return (
    process.env.ERA_PLACEMENT_FROZEN_ORG_IDS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? []
  );
}

export function isOrganizationPlacementFrozen(
  organizationId?: string | null,
): boolean {
  const org = organizationId?.trim() || "";
  if (!org) return false;
  const mem = getRuntimeConfigMemory();
  if (mem.placementFreeze === true) {
    // DEDICATED/ONPREM process often stamps organizationId on memory.
    if (!mem.organizationId || mem.organizationId === org) return true;
  }
  if (
    Array.isArray(mem.placementFrozenOrgIds) &&
    mem.placementFrozenOrgIds.includes(org)
  ) {
    return true;
  }
  return envFrozenOrgIds().includes(org);
}

/** JSON 423 body for API mutations while placement freeze is active. */
export function placementFrozenJsonBody(): { error: string } {
  return { error: "Organization frozen for placement hop" };
}

/**
 * When method is a write and org is frozen, return a 423 Response; else null.
 * Safe for Edge middleware (no Node crypto).
 */
export function placementFrozenWriteResponse(input: {
  method: string;
  pathname: string;
  organizationId?: string | null;
  /** Paths that stay writable during freeze (auth, health, internal placement). */
  allowPathPrefixes?: string[];
}): Response | null {
  const verb = input.method.toUpperCase();
  if (verb === "GET" || verb === "HEAD" || verb === "OPTIONS") return null;
  const path = input.pathname || "";
  const allow = [
    "/api/auth/",
    "/api/health",
    "/api/internal/v1/placement/",
    "/api/internal/v1/runtime-config",
    ...(input.allowPathPrefixes ?? []),
  ];
  if (allow.some((p) => path.startsWith(p))) return null;
  if (!isOrganizationPlacementFrozen(input.organizationId)) return null;
  return new Response(JSON.stringify(placementFrozenJsonBody()), {
    status: 423,
    headers: { "content-type": "application/json" },
  });
}
