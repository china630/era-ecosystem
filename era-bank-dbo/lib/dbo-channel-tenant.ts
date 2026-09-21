import {
  enterSatelliteTenant,
  ORG_NO_RE,
  readStaffLoginJson,
  resolveStaffLoginTenant,
  satelliteRuntimeConfig,
  type StaffLoginTenantResult,
} from "@era/satellite-kit";

function dboSatelliteKey(): string {
  return process.env.ERA_SATELLITE_KEY?.trim() || "banking_dbo";
}

/** Customer UI must not see staff-login "orgNo is required" copy. */
export function dboPublicTenantError(
  tenant: Extract<StaffLoginTenantResult, { ok: false }>,
): Extract<StaffLoginTenantResult, { ok: false }> {
  if (tenant.status === 429) return tenant;
  if (tenant.error.includes("orgNo is required")) {
    return {
      ok: false,
      status: 400,
      error: "This channel is not available on this host",
    };
  }
  if (tenant.status === 401) {
    return { ok: false, status: 401, error: "Invalid credentials" };
  }
  return tenant;
}

export async function readDboAuthJson(request: Request): Promise<
  | { ok: true; raw: Record<string, unknown>; orgNo?: string }
  | { ok: false; status: 400; error: string }
> {
  const parsed = await readStaffLoginJson(request);
  if (!parsed.ok) return parsed;
  if (!parsed.raw || typeof parsed.raw !== "object" || Array.isArray(parsed.raw)) {
    return { ok: false, status: 400, error: "Invalid JSON" };
  }
  const raw = parsed.raw as Record<string, unknown>;
  const orgNo = typeof raw.orgNo === "string" ? raw.orgNo.trim() : undefined;
  if (orgNo && !ORG_NO_RE.test(orgNo)) {
    return { ok: false, status: 400, error: "Invalid organization code" };
  }
  return { ok: true, raw, orgNo: orgNo || undefined };
}

/** DBO customers never type ERA ID. Resolve via Host / bind / optional lab orgNo. */
export async function resolveDboChannelTenant(
  request: Request,
  orgNo?: string,
): Promise<StaffLoginTenantResult> {
  const result = await resolveStaffLoginTenant({
    orgNo,
    isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
    request,
    satelliteKey: dboSatelliteKey(),
  });
  if (!result.ok) return dboPublicTenantError(result);
  return result;
}

export function enterDboTenant(organizationId: string | undefined | null): void {
  const id = organizationId?.trim();
  if (id) enterSatelliteTenant({ organizationId: id });
}
