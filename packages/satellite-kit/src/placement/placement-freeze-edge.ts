/**
 * Edge-safe placement freeze check. Middleware cannot import the Node
 * runtime-config memory (it pulls a dynamic require). The droplet process
 * still enforces the in-memory flag in placement-freeze.ts.
 */

function envFrozenOrgIds(): string[] {
  return (
    process.env.ERA_PLACEMENT_FROZEN_ORG_IDS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? []
  );
}

export function placementFrozenJsonBody(): { error: string } {
  return { error: "Organization frozen for placement hop" };
}

export function placementFrozenWriteResponse(input: {
  method: string;
  pathname: string;
  organizationId?: string | null;
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
  const org = input.organizationId?.trim() || "";
  if (!org || !envFrozenOrgIds().includes(org)) return null;
  return new Response(JSON.stringify(placementFrozenJsonBody()), {
    status: 423,
    headers: { "content-type": "application/json" },
  });
}
