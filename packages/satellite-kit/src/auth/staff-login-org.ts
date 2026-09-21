import { burnPasswordVerifyCost } from "./password";
import {
  assertLoginOrgRateLimit,
  ORG_NO_RE,
  resolveLoginOrganizationId,
} from "./resolve-login-org";
export {
  LOGIN_ORG_NO_STORAGE_KEY,
  readLoginOrgNoPrefill,
  persistLoginOrgNo,
} from "./staff-login-org-storage";
import {
  assertOrgNoMatchesHost,
  loginPoolHostSuffixesFromEnv,
  parseEraOrgSubdomain,
} from "../tenancy/era-org-subdomain";
import {
  resolveLoginHost,
  satelliteKeyFromEnv,
} from "../tenancy/login-hostname-memory";

export function clientIpFromRequest(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export type StaffLoginTenantResult =
  | { ok: true; organizationId?: string; orgNo?: string }
  | { ok: false; status: 400 | 401 | 429; error: string };

/**
 * Resolve public org number to tenant UUID for local staff login (SHARED / DEDICATED).
 * SHARED: orgNo required (from body or ERA subdomain Host). Miss → generic 401.
 */
export async function resolveStaffLoginTenant(input: {
  orgNo?: string;
  isShared: boolean;
  request: Request;
  /** Current satellite gate key (defaults to ERA_SATELLITE_KEY). */
  satelliteKey?: string;
}): Promise<StaffLoginTenantResult> {
  const host =
    input.request.headers.get("x-forwarded-host") ||
    input.request.headers.get("host");
  const sub = parseEraOrgSubdomain(host, loginPoolHostSuffixesFromEnv());
  const hostOrgNo = sub && "orgNo" in sub ? sub.orgNo : undefined;
  const satelliteKey = input.satelliteKey ?? satelliteKeyFromEnv();
  const customHost =
    input.isShared && !hostOrgNo
      ? resolveLoginHost(host ?? "", satelliteKey)
      : null;

  const orgNo = input.orgNo?.trim() || hostOrgNo;

  const match = assertOrgNoMatchesHost(hostOrgNo, input.orgNo?.trim());
  if (!match.ok) {
    return { ok: false, status: 400, error: match.error };
  }

  if (customHost) {
    const rate = assertLoginOrgRateLimit({
      ip: clientIpFromRequest(input.request),
      orgNo: `host:${customHost.organizationId}`,
    });
    if (!rate.ok) {
      return { ok: false, status: 429, error: "Too many login attempts" };
    }
    const sent = input.orgNo?.trim();
    if (sent) {
      if (!ORG_NO_RE.test(sent)) {
        return { ok: false, status: 400, error: "Invalid organization code" };
      }
      const resolved = await resolveLoginOrganizationId(sent);
      if ("invalid" in resolved) {
        return { ok: false, status: 400, error: "Invalid organization code" };
      }
      if ("miss" in resolved) {
        await burnPasswordVerifyCost("org-miss");
        return { ok: false, status: 401, error: "Invalid credentials" };
      }
      if (resolved.organizationId !== customHost.organizationId) {
        return { ok: false, status: 400, error: "Organization code does not match host" };
      }
    }
    return sent
      ? { ok: true, organizationId: customHost.organizationId, orgNo: sent }
      : { ok: true, organizationId: customHost.organizationId };
  }

  if (input.isShared && !orgNo) {
    return { ok: false, status: 400, error: "orgNo is required on SHARED pool" };
  }

  if (!orgNo) {
    return { ok: true, organizationId: undefined };
  }

  if (!ORG_NO_RE.test(orgNo)) {
    return { ok: false, status: 400, error: "Invalid organization code" };
  }

  const rate = assertLoginOrgRateLimit({
    ip: clientIpFromRequest(input.request),
    orgNo,
  });
  if (!rate.ok) {
    return { ok: false, status: 429, error: "Too many login attempts" };
  }

  const resolved = await resolveLoginOrganizationId(orgNo);
  if ("invalid" in resolved) {
    return { ok: false, status: 400, error: "Invalid organization code" };
  }
  if ("miss" in resolved) {
    await burnPasswordVerifyCost("org-miss");
    return { ok: false, status: 401, error: "Invalid credentials" };
  }

  return { ok: true, organizationId: resolved.organizationId, orgNo };
}

export type LoginHostBinding = {
  hostBound: boolean;
  orgNo?: string;
};

/** Public GET /api/auth/login — hide orgNo field only for ERA-owned `{orgNo}.pool` Host.
 * Custom white-label hosts are not advertised here (Host-header enumeration).
 */
export function describeLoginHostBinding(request: Request): LoginHostBinding {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host");
  const sub = parseEraOrgSubdomain(host, loginPoolHostSuffixesFromEnv());
  if (sub && "orgNo" in sub) {
    return { hostBound: true, orgNo: sub.orgNo };
  }
  return { hostBound: false };
}

export function jsonLoginHostBinding(request: Request): Response {
  return Response.json(describeLoginHostBinding(request));
}

/** Cut UUID from local login JSON: reject leftover `organizationId` (Zod strips extras). */
export async function readStaffLoginJson(
  request: Request,
): Promise<
  { ok: true; raw: unknown } | { ok: false; status: 400; error: string }
> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON" };
  }
  if (
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    Object.prototype.hasOwnProperty.call(raw, "organizationId")
  ) {
    return { ok: false, status: 400, error: "Invalid organization code" };
  }
  return { ok: true, raw };
}
