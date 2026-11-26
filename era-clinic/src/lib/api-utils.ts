import { AsyncLocalStorage } from "node:async_hooks";
import { ClinicJson } from "@/lib/clinic-json";
import {
  readSatelliteStaffSession,
  type SatelliteStaffSession,
  type SatelliteStaffSessionPayload,
  SATELLITE_ROLE,
  sessionHasRole,
  type SatelliteSessionPayload,
} from "@era/satellite-kit";
import { nestHttpFrame } from "@/lib/nest-http-context";
import { isSatelliteBillingBlockedError } from "@era/satellite-kit/billing/gate";
import {
  hasClinicAdminAccess,
  hasClinicPermissionBypass,
} from "@/lib/auth/clinic-admin-access";
import { sessionHasClinicPermission } from "@/lib/auth/clinic-permission-check";
import { assertClinicPermission } from "@/lib/auth/clinic-permission.service";
import {
  ALL_CLINIC_PERMISSIONS,
  effectiveRolePermissions,
  type ClinicPermission,
} from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";

export { ClinicJson } from "@/lib/clinic-json";

export function jsonOk<T>(data: T, status = 200) {
  return new ClinicJson(status, data);
}

export function jsonError(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return new ClinicJson(status, { error: message, ...extra });
}

function isCodeUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Error) || !("code" in err) || (err as { code?: string }).code !== "P2002") {
    return false;
  }
  const target = (err as { meta?: { target?: unknown } }).meta?.target;
  const tokens = Array.isArray(target)
    ? target.map((part) => String(part))
    : typeof target === "string"
      ? target.split(/[^A-Za-z0-9]+/)
      : [];
  return tokens.includes("code");
}

/** Nest HttpException (or duck-typed) — keep status/body; never collapse to "Http Exception". */
function clinicJsonFromHttpException(err: unknown): ClinicJson | null {
  if (!err || typeof err !== "object") return null;
  const candidate = err as {
    getStatus?: () => number;
    getResponse?: () => string | Record<string, unknown>;
  };
  if (typeof candidate.getStatus !== "function" || typeof candidate.getResponse !== "function") {
    return null;
  }
  const status = candidate.getStatus();
  if (typeof status !== "number" || status < 400) return null;
  const body = candidate.getResponse();
  if (typeof body === "string") return jsonError(body, status);
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.error === "string" || typeof record.message === "string") {
      return new ClinicJson(status, record);
    }
    return new ClinicJson(status, { error: "Request failed", ...record });
  }
  return jsonError("Request failed", status);
}

export function handleRouteError(err: unknown) {
  const fromHttp = clinicJsonFromHttpException(err);
  if (fromHttp) return fromHttp;
  if (isSatelliteBillingBlockedError(err)) {
    return new ClinicJson(
      err.status,
      { error: err.message, code: err.code, billingStatus: err.billingStatus },
    );
  }
  if (err && typeof err === "object" && "issues" in err) {
    return jsonError("Validation failed", 400);
  }
  if (err instanceof Error && err.name === "IndustryModuleInactiveError") {
    const status =
      "status" in err && typeof (err as { status?: number }).status === "number"
        ? (err as { status: number }).status
        : 403;
    return jsonError(err.message, status);
  }
  if (err instanceof Error && err.name === "SatelliteChannelDisabledError") {
    const code =
      "code" in err && typeof (err as { code?: string }).code === "string"
        ? (err as { code: string }).code
        : "SATELLITE_CHANNEL_DISABLED";
    return jsonError(err.message, 403, { code });
  }
  if (err instanceof Error && err.name === "FiscalError") {
    return jsonError(err.message, 400);
  }
  if (err instanceof Error && err.name === "PatientMdmRequiredError") {
    return jsonError(err.message, 400);
  }
  if (err instanceof Error && err.name === "StaffDutyError") {
    const status = "status" in err && typeof err.status === "number" ? err.status : 400;
    return jsonError(err.message, status);
  }
  if (err instanceof Error && err.name === "IcdCatalogError") {
    const status = "status" in err && typeof err.status === "number" ? err.status : 400;
    return jsonError(err.message, status);
  }
  if (err instanceof Error && err.name === "PhysioCatalogError") {
    const status = "status" in err && typeof err.status === "number" ? err.status : 400;
    return jsonError(err.message, status);
  }
  if (err instanceof Error && "code" in err && typeof (err as { code?: string }).code === "string") {
    const code = (err as { code: string }).code;
    const conflictCodes = new Set([
      "ANAMNESIS_REQUIRED",
      "COMPLAINT_REQUIRED",
      "DIAGNOSIS_REQUIRED",
      "WALK_IN_OPEN_EXISTS",
      "EPISODE_CLOSED",
      "EPISODE_NOT_IDLE",
      "NO_OPEN_EPISODE",
      "LAB_NOT_ORDERED",
      "LAB_ALREADY_OPEN",
      "LAB_UNPAID_EXISTS",
      "LAB_ALREADY_COMPLETED",
      "LAB_OVER_QUOTA_BLOCKED",
      "IN_USE",
      "CLOSED",
      "CROSS_DAY",
      "DAY_FULL",
      "BATH_REST",
      "SERIES_RHYTHM",
      "WEEK_FULL",
      "PAST_CHECKOUT",
      "CHECKOUT_NOON",
      "NO_STAFF",
      "STAFF_BUSY",
      "CABIN_BUSY",
      "CABIN_SEX",
      "NO_CABIN",
      "SAME_DAY",
      "LUNCH",
      "RULE",
      "NO_SLOT",
    ]);
    if (conflictCodes.has(code)) {
      const testCode =
        "testCode" in err && typeof (err as { testCode?: string }).testCode === "string"
          ? (err as { testCode: string }).testCode
          : undefined;
      return jsonError(err.message, 409, {
        code,
        ...(testCode ? { testCode } : {}),
      });
    }
  }
  if (isCodeUniqueViolation(err)) {
    return jsonError("Code already exists", 409, { code: "CODE_EXISTS" });
  }
  const msg = err instanceof Error ? err.message : "Internal error";
  if (/Failed to parse body as FormData/i.test(msg)) {
    return jsonError(
      "File too large for one request. Split into 26-Slots-p01.xlsx … (5k rows) and upload the chunks.",
      413,
    );
  }
  return jsonError(msg, 500);
}

/**
 * Staff session: org from the signed token, active user row, clinic gate
 * (plus the submodule for the request path), grants from the DB.
 * No session → null (401); module off → IndustryModuleInactiveError (403).
 * Call once per handler, inside try, and pass the session on.
 */
export type ClinicSessionUser = {
  organizationId: string;
  active: boolean;
  role: { code: string; permissionsJson: string | null };
};

export async function loadClinicSessionUser(session: {
  sub: string;
}): Promise<ClinicSessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      organizationId: true,
      status: true,
      role: { select: { code: true, permissionsJson: true } },
    },
  });
  return user
    ? { organizationId: user.organizationId, active: user.status === "ACTIVE", role: user.role }
    : null;
}

export async function enrichClinicStaffSession(
  staff: SatelliteStaffSession<ClinicSessionUser>,
  pathname?: string,
): Promise<SatelliteStaffSessionPayload> {
  const { session, user } = staff;
  const { assertClinicApiEntitled } = await import("@/lib/clinic-module-gate");
  await assertClinicApiEntitled(pathname, session.organizationId);
  const permissions = hasClinicPermissionBypass(session)
    ? [...ALL_CLINIC_PERMISSIONS]
    : effectiveRolePermissions(user.role.code, user.role.permissionsJson ?? "[]");
  return { ...session, permissions };
}

const boundClinicSession = new AsyncLocalStorage<SatelliteStaffSessionPayload>();

/** Staff session already loaded by the Nest guard, visible to admin/ops gates. */
export function runWithBoundClinicSession<T>(
  session: SatelliteStaffSessionPayload,
  fn: () => Promise<T>,
): Promise<T> {
  return boundClinicSession.run(session, fn);
}

export async function getSatelliteSession(): Promise<SatelliteStaffSessionPayload | null> {
  const bound = boundClinicSession.getStore();
  if (bound) return bound;
  let cookieStore: { get(name: string): { value: string } | undefined };
  let headerStore: { get(name: string): string | null };
  const frame = nestHttpFrame();
  if (frame) {
    cookieStore = frame.cookies;
    headerStore = frame.headers;
  } else {
    try {
      const nextHeaders = await import("next/headers");
      cookieStore = await nextHeaders.cookies();
      headerStore = await nextHeaders.headers();
    } catch {
      return null;
    }
  }
  const staff = await readSatelliteStaffSession({
    cookies: cookieStore,
    headers: headerStore,
    loadUser: loadClinicSessionUser,
  });
  if (!staff) return null;
  return enrichClinicStaffSession(staff);
}

/** @deprecated Prefer hasClinicAdminAccess — name implies role-code bypass. */
export function hasClinicAdminRole(session: SatelliteSessionPayload): boolean {
  return hasClinicAdminAccess(session);
}

export function hasBusinessOwnerRole(
  session: SatelliteSessionPayload,
): boolean {
  return (
    sessionHasRole(session, SATELLITE_ROLE.BUSINESS_OWNER) ||
    session.isOwner === true
  );
}

/** Prefer for new guards — checks domain permission from DB (role.permissionsJson). */
export async function requireClinicPermission(
  session: SatelliteSessionPayload | null,
  permission: ClinicPermission,
): Promise<ClinicJson | null> {
  return assertClinicPermission(session, permission);
}

export { sessionHasClinicPermission };
