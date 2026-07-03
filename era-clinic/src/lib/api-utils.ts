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
  if (err instanceof Error && err.name === "PatientMdmRequiredError") {
    return jsonError(err.message, 400);
  }
  const msg = err instanceof Error ? err.message : "Internal error";
  return jsonError(msg, 500);
}

export async function getRouteSession(): Promise<SatelliteSessionPayload | null> {
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
