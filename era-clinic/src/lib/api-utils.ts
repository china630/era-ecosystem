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

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(err: unknown) {
  if (err && typeof err === "object" && "issues" in err) {
    return jsonError("Validation failed", 400);
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
  return (
    sessionHasRole(session, "CLINIC_ADMIN") ||
    sessionHasRole(session, SATELLITE_ROLE.BUSINESS_OWNER) ||
    session.isOwner === true
  );
}

export function hasBusinessOwnerRole(
  session: SatelliteSessionPayload,
): boolean {
  return (
    sessionHasRole(session, SATELLITE_ROLE.BUSINESS_OWNER) ||
    session.isOwner === true
  );
}
