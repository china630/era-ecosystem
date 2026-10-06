import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from "../tenancy/resolve-orchestrator-url";

export type SatelliteRolePublishRow = {
  code: string;
  name: string;
  active: boolean;
};

const recentSnapshot = new Map<string, number>();
const SNAPSHOT_TTL_MS = 10 * 60 * 1000;

/**
 * Tell the control plane a satellite role was created, renamed, or disabled.
 * Does not send permission grants. Never throws: the satellite role save stands,
 * and the call is retried a few times.
 */
export async function publishSatelliteRole(input: {
  organizationId: string;
  satelliteKey: string;
  code: string;
  name: string;
  active: boolean;
}): Promise<void> {
  await postRoles(
    input.organizationId,
    input.satelliteKey,
    [{ code: input.code, name: input.name, active: input.active }],
    false,
  );
}

/** Full list after the role screen (or system seed) has loaded. Debounced per org. */
export async function publishSatelliteRoleSnapshot(input: {
  organizationId: string;
  satelliteKey: string;
  roles: SatelliteRolePublishRow[];
}): Promise<void> {
  const key = `${input.organizationId}|${input.satelliteKey}`;
  const now = Date.now();
  const last = recentSnapshot.get(key) ?? 0;
  if (now - last < SNAPSHOT_TTL_MS) return;
  recentSnapshot.set(key, now);
  const ok = await postRoles(
    input.organizationId,
    input.satelliteKey,
    input.roles,
    true,
  );
  if (!ok) recentSnapshot.delete(key);
}

export function resetSatelliteRolePublishForTests(): void {
  recentSnapshot.clear();
}

async function postRoles(
  organizationId: string,
  satelliteKey: string,
  roles: SatelliteRolePublishRow[],
  snapshot: boolean,
): Promise<boolean> {
  const token = resolveSatelliteEventServiceToken();
  if (!token || !organizationId.trim() || roles.length === 0) return false;
  const base = resolveOrchestratorBaseUrl().replace(/\/$/, "");
  const body = JSON.stringify({
    organizationId: organizationId.trim(),
    satelliteKey: satelliteKey.trim(),
    snapshot,
    roles: roles
      .filter((role) => role.code.trim() && role.name.trim())
      .map((role) => ({
        code: role.code.trim(),
        name: role.name.trim(),
        active: role.active,
      })),
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${base}/internal/v1/workforce/satellite-roles`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body,
      });
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  return false;
}
