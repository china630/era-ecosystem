import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  authCookieName,
  enterSatelliteTenant,
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

/** Call at the start of operational clinic API handlers. */
export async function assertClinicEntitled(): Promise<void> {
  const { assertClinicEntitled: gate } = await import("@/lib/clinic-module-gate");
  await gate();
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
  let session: SatelliteSessionPayload;
  try {
    session = await verifySatelliteSession(token);
  } catch {
    return null;
  }

  let organizationId =
    session.organizationId?.trim() ||
    headerStore.get("x-era-organization-id")?.trim() ||
    undefined;

  // Legacy tokens (pre-org claim): resolve from user row only (no process bind).
  if (!organizationId) {
    const row = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { organizationId: true },
    });
    organizationId = row?.organizationId || undefined;
  }
  if (!organizationId) {
    // SHARED / multi-tenant: refuse silent process-bind; client must re-login.
    return null;
  }

  enterSatelliteTenant({ organizationId });
  session = { ...session, organizationId };

  const { assertClinicApiEntitled } = await import("@/lib/clinic-module-gate");
  await assertClinicApiEntitled(undefined, organizationId);

  return session;
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
