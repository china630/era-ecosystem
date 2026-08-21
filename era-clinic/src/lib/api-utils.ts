import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  authCookieName,
  getBearerOrCookieToken,
  SATELLITE_ROLE,
  sessionHasRole,
  verifySatelliteSession,
  type SatelliteSessionPayload,
} from "@era/satellite-kit";
import { hasClinicAdminAccess } from "@/lib/auth/clinic-admin-access";
import {
  CLINIC_ROLE,
  sessionHasClinicRole,
  type ClinicRoleCode,
} from "@/lib/clinic-roles";

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
  const msg = err instanceof Error ? err.message : "Internal error";
  return jsonError(msg, 500);
}

/** Call at the start of operational clinic API handlers. */
export async function assertClinicEntitled(): Promise<void> {
  const { assertClinicEntitled: gate } = await import("@/lib/clinic-module-gate");
  await gate();
}

export async function getRouteSession(): Promise<SatelliteSessionPayload | null> {
  const { assertClinicApiEntitled } = await import("@/lib/clinic-module-gate");
  await assertClinicApiEntitled();
  const cookieStore = await cookies();
  const headerStore = await headers();
  const token = getBearerOrCookieToken(
    cookieStore,
    headerStore,
    authCookieName(),
  );
  if (!token) return null;
  try {
    return await verifySatelliteSession(token);
  } catch {
    return null;
  }
}

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

export function requireClinicRole(
  session: SatelliteSessionPayload | null,
  allowed: ClinicRoleCode[],
): NextResponse | null {
  if (!session) return jsonError("Unauthorized", 401);
  if (
    hasClinicAdminRole(session) ||
    sessionHasClinicRole(session.role, allowed)
  ) {
    return null;
  }
  return jsonError("Forbidden", 403);
}
