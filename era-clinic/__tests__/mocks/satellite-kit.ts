/** Jest stub — kit barrel pulls jose ESM under CJS Jest. */
const als: { organizationId?: string } = {};

export function satelliteOrganizationId(): string {
  return process.env.ERA_SATELLITE_ORGANIZATION_ID || "test-org";
}

export function resolveSatelliteOrganizationId(opts?: {
  allowFallback?: boolean;
}): { organizationId: string; source: string } {
  const id =
    als.organizationId ||
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
    (opts?.allowFallback ? "demo-org" : "");
  if (!id) throw new Error("unbound");
  return { organizationId: id, source: "mock" };
}

export function enterSatelliteTenant(ctx: { organizationId?: string }): void {
  als.organizationId = ctx.organizationId?.trim() || undefined;
}

export function resolveSatelliteTenantOrgId(): string | null {
  if (process.env.ERA_SKIP_TENANT_FILTER === "1") return null;
  if (als.organizationId) return als.organizationId;
  const bind = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim();
  return bind || "test-org";
}

export function getSatelliteTenantContext():
  | { organizationId?: string }
  | undefined {
  return als.organizationId ? { organizationId: als.organizationId } : undefined;
}

export function runWithSatelliteTenant<T>(
  ctx: { organizationId?: string },
  fn: () => T,
): T {
  const prev = als.organizationId;
  als.organizationId = ctx.organizationId?.trim() || undefined;
  try {
    return fn();
  } finally {
    als.organizationId = prev;
  }
}

export async function runCronForEachTenant<T>(
  opts: {
    listOrganizationIds?: () => Promise<string[]>;
    fetchPoolOrganizationIds?: () => Promise<string[]>;
  },
  work: (organizationId: string) => Promise<T>,
): Promise<
  { ok: true; results: T[] } | { ok: false; status: number; reason: string }
> {
  const env =
    process.env.ERA_CRON_ORGANIZATION_IDS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  let ids = env;
  if (!ids.length && opts.fetchPoolOrganizationIds) {
    ids = await opts.fetchPoolOrganizationIds();
  }
  if (!ids.length && opts.listOrganizationIds) {
    ids = await opts.listOrganizationIds();
  }
  if (!ids.length) ids = [resolveSatelliteTenantOrgId() || "test-org"];
  const results: T[] = [];
  for (const organizationId of [...new Set(ids)]) {
    results.push(
      await runWithSatelliteTenant({ organizationId }, () =>
        work(organizationId),
      ),
    );
  }
  return { ok: true, results };
}

export function satelliteRuntimeConfig(): { deploymentTopology?: string } {
  return { deploymentTopology: process.env.ERA_DEPLOYMENT_TOPOLOGY };
}

export function fetchPoolOrganizationIdsFromOrch(): Promise<string[]> {
  return Promise.resolve([]);
}

export async function trySendPlatformNotification(): Promise<void> {}
export function platformNotificationsEnabled(): boolean {
  return false;
}

export function resetSatelliteTenantAlsForTests(): void {
  als.organizationId = undefined;
}

export async function hashPassword(password: string): Promise<string> {
  return `salt:${password}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored === "sso:no-password") return false;
  return stored === `salt:${password}`;
}

export const resolveOperatingMode = jest.fn().mockReturnValue("STANDALONE");
export const resolveSettlementPolicy = jest.fn();
export const shouldDeferWalkInToHub = jest.fn().mockReturnValue(false);
export const shouldRouteRevenueToParent = jest.fn().mockReturnValue(false);
export const linkPersonIdentity = jest.fn();
export const getPersonOpsProfile = jest.fn().mockResolvedValue(null);
export function normalizePersonSex(raw: unknown): "MALE" | "FEMALE" | "UNKNOWN" | undefined {
  if (raw == null || raw === "") return undefined;
  const s = String(raw).trim().toUpperCase();
  if (s === "M" || s === "MALE") return "MALE";
  if (s === "F" || s === "FEMALE") return "FEMALE";
  if (s === "OTHER" || s === "UNKNOWN") return "UNKNOWN";
  return undefined;
}
export function parsePersonBirthDate(): Date | undefined {
  return undefined;
}
export const fetchControlPlaneOrganizationName = jest
  .fn()
  .mockResolvedValue(null);
