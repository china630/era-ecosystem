import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  readSatelliteStaffSession,
  type SatelliteStaffSessionPayload,
} from "@era/satellite-kit";
import { requireAutoSatellite, IndustryModuleInactiveError } from "@/lib/auto-module-gate";
import { prisma } from "@/lib/prisma";
import { assertApiRouteGrant } from "@/lib/auth/require";
import type { RoleGrantRow } from "@/lib/auth/permission-catalog";
import { grantsForUser, ROLE_GRANT_SELECT } from "@/lib/auth/auto-permission.service";

/** Same value as the kit `ERA_PATHNAME_HEADER`; the staff middleware overwrites any client copy. */
const PATHNAME_HEADER = "x-era-pathname";

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
  if (err instanceof IndustryModuleInactiveError) {
    return jsonError(err.message, err.status ?? 403);
  }
  if (err instanceof Error && err.name === "IndustryModuleInactiveError") {
    const status =
      "status" in err && typeof (err as { status?: number }).status === "number"
        ? (err as { status: number }).status
        : 403;
    return jsonError(err.message, status);
  }
  if (err instanceof Error && (err.name === "UnauthorizedError" || err.name === "PermissionDeniedError")) {
    return jsonError(err.message, err.name === "UnauthorizedError" ? 401 : 403);
  }
  const msg = err instanceof Error ? err.message : "Internal error";
  return jsonError(msg, 500);
}

export type StaffSession = SatelliteStaffSessionPayload & { permissions: string[] };

/**
 * Staff session: org from the signed token, active user row, module gate, then
 * the grant for this API path from the role row (AS-RBAC-01).
 * No session → null (401); module off → IndustryModuleInactiveError (403);
 * missing grant → PermissionDeniedError (403).
 * Call once per handler, inside try, and pass the session on.
 */
export async function getSatelliteSession(): Promise<StaffSession | null> {
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
          login: true,
          email: true,
          role: { select: ROLE_GRANT_SELECT },
        },
      });
      return user
        ? {
            organizationId: user.organizationId,
            active: user.status === "ACTIVE",
            login: user.login,
            email: user.email,
            role: user.role as RoleGrantRow | null,
          }
        : null;
    },
  });
  if (!staff) return null;
  await requireAutoSatellite(staff.session.organizationId);
  const role = staff.user.role ?? null;
  const session: StaffSession = {
    ...staff.session,
    role: role?.code ?? staff.session.role,
    permissions: grantsForUser({
      login: staff.user.login ?? staff.session.login,
      email: staff.user.email ?? staff.session.email,
      role,
      isOwner: staff.session.isOwner === true,
      pin: staff.session.pin === true,
    }),
  };
  assertApiRouteGrant(session, headerStore.get(PATHNAME_HEADER));
  return session;
}
