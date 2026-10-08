import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  readSatelliteStaffSession,
  type SatelliteStaffSessionPayload,
  SATELLITE_ROLE,
  sessionHasRole,
  type SatelliteSessionPayload,
} from "@era/satellite-kit";
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

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function handleRouteError(err: unknown) {
  if (isSatelliteBillingBlockedError(err)) {
    return NextResponse.json(
      { error: err.message, code: err.code, billingStatus: err.billingStatus },
      { status: err.status },
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
      "WALK_IN_OPEN_EXISTS",
      "EPISODE_CLOSED",
      "EPISODE_NOT_IDLE",
      "NO_OPEN_EPISODE",
      "LAB_NOT_ORDERED",
      "LAB_ALREADY_OPEN",
      "LAB_ALREADY_COMPLETED",
      "LAB_OVER_QUOTA_BLOCKED",
      "IN_USE",
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
export async function getSatelliteSession(): Promise<SatelliteStaffSessionPayload | null> {
  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  let headerStore: Awaited<ReturnType<typeof headers>>;
  try {
    cookieStore = await cookies();
    headerStore = await headers();
  } catch {
    return null;
  }
  const staff = await readSatelliteStaffSession({
    cookies: cookieStore,
    headers: headerStore,
    loadUser: async ({ sub }) => {
      const user = await prisma.user.findUnique({
        where: { id: sub },
        select: {
          organizationId: true,
          status: true,
          role: { select: { code: true, permissionsJson: true } },
        },
      });
      return user
        ? { organizationId: user.organizationId, active: user.status === "ACTIVE", role: user.role }
        : null;
    },
  });
  if (!staff) return null;
  const { session, user } = staff;

  const { assertClinicApiEntitled } = await import("@/lib/clinic-module-gate");
  await assertClinicApiEntitled(undefined, session.organizationId);

  const permissions = hasClinicPermissionBypass(session)
    ? [...ALL_CLINIC_PERMISSIONS]
    : effectiveRolePermissions(user.role.code, user.role.permissionsJson);
  return { ...session, permissions };
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
): Promise<NextResponse | null> {
  return assertClinicPermission(session, permission);
}

export { sessionHasClinicPermission };
