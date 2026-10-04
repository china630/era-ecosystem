import { cookies, headers } from "next/headers";
import {
  readSatelliteStaffSession,
  type SatelliteStaffSessionPayload,
  sessionHasRole,
  type SatelliteSessionPayload,
} from "@era/satellite-kit";
import {
  editionForOrg,
  permissionsForRoleCode,
} from "@/lib/auth/fnb-permission.service";
import { effectiveRolePermissions, isSystemFnbRoleCode } from "@/lib/auth/permissions";
import { requireFnbSatellite } from "@/lib/fnb-module-gate";
import { prisma } from "@/lib/prisma";

export function sessionActorName(
  session: { fullName?: string | null; login?: string | null } | null | undefined,
): string | null {
  const name = session?.fullName?.trim() || session?.login?.trim() || "";
  return name || null;
}

type FnbStaffRow = {
  organizationId: string;
  active: boolean;
  role: { code: string; permissionsJson: string } | null;
};

/** PIN tokens carry a `StaffRoster` id; every other token a `User` id. */
async function loadFnbStaff(session: SatelliteSessionPayload): Promise<FnbStaffRow | null> {
  if (session.pin === true) {
    const staff = await prisma.staffRoster.findUnique({
      where: { id: session.sub },
      select: { organizationId: true, active: true },
    });
    return staff ? { ...staff, role: null } : null;
  }
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

/**
 * Staff session: org from the signed token, active user (or PIN staff) row,
 * F&B gate, grants from the DB. No session → null (401); module off →
 * IndustryModuleInactiveError (403). Call once per handler, inside try.
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
    loadUser: loadFnbStaff,
  });
  if (!staff) return null;
  const { session, user } = staff;
  await requireFnbSatellite(session.organizationId);

  if (user.role) {
    const edition = await editionForOrg(session.organizationId);
    const permissions = effectiveRolePermissions(
      user.role.code,
      user.role.permissionsJson,
      edition,
    );
    return { ...session, permissions };
  }
  if (isSystemFnbRoleCode(session.role)) {
    const permissions = await permissionsForRoleCode(session.organizationId, session.role);
    return { ...session, permissions };
  }
  return session;
}

/** @deprecated Prefer denyUnlessPermission / assertPermission — role name grants nothing. */
export function requireAnyRole(
  session: SatelliteSessionPayload | null,
  roles: string[],
): Response | null {
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!roles.some((role) => sessionHasRole(session, role))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

export const FB_ROLES = {
  WAITER: "FB_WAITER",
  MANAGER: "FB_MANAGER",
  CASHIER: "FB_CASHIER",
  KITCHEN: "FB_KITCHEN",
} as const;
