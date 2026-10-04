import { cookies, headers } from "next/headers";
import {
  readSatelliteStaffSession,
  type SatelliteStaffSessionPayload,
} from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { assertHotelApiEntitled } from "@/lib/hotel-module-gate";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { ALL_PERMISSIONS, effectiveRolePermissions } from "@/lib/auth/permissions";

/**
 * Staff session: org from the signed token, active user row, hotel gate
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

  await assertHotelApiEntitled(undefined, session.organizationId);

  const isOwner = session.isOwner === true || session.role === "BUSINESS_OWNER";
  const isPlatformSuperAdmin = isPlatformSuperAdminUser({
    login: session.login,
    email: session.email,
  });
  const permissions =
    isOwner || isPlatformSuperAdmin
      ? [...ALL_PERMISSIONS]
      : effectiveRolePermissions(user.role.code, user.role.permissionsJson);

  return { ...session, permissions, isOwner };
}
