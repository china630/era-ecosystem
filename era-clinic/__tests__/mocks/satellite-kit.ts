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
export function parsePersonBirthDate(raw?: string | Date | null): Date | undefined {
  if (raw == null || raw === "") return undefined;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  const s = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function composePersonFullName(
  firstName?: string | null,
  middleName?: string | null,
  lastName?: string | null,
): string {
  return [firstName, middleName, lastName]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
}

export function splitFullNameToParts(fullName: string | null | undefined): {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
} {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, middleName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0]!, middleName: null, lastName: null };
  if (parts.length === 2) {
    return { firstName: parts[0]!, middleName: null, lastName: parts[1]! };
  }
  return {
    firstName: parts[0]!,
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1]!,
  };
}

export function resolveIncomingNameParts(input: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}) {
  const first = input.firstName?.trim() || null;
  const middle = input.middleName?.trim() || null;
  const last = input.lastName?.trim() || null;
  if (first || last) return { firstName: first, middleName: middle, lastName: last };
  const blob = input.fullName?.trim();
  if (!blob) return null;
  return splitFullNameToParts(blob);
}

export function normalizeNationalityIso(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = raw.trim().toUpperCase();
  if (!s || s === "OTHER" || s === "UNKNOWN") return null;
  if (/^[A-Z]{2}$/.test(s)) return s;
  return null;
}

export const listPersonIdentifiers = jest.fn().mockResolvedValue({ identifiers: [] });
export const fetchControlPlaneOrganizationName = jest
  .fn()
  .mockResolvedValue(null);
