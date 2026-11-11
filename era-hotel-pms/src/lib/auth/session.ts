import { cookies, headers } from "next/headers";
import { nestHttpFrame } from "@/lib/nest-http-context";
import {
  readSatelliteStaffSession,
  type SatelliteStaffSession,
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
export type HotelSessionUser = {
  organizationId: string;
  active: boolean;
  role: { code: string; permissionsJson: string | null };
};

export async function loadHotelSessionUser(session: {
  sub: string;
}): Promise<HotelSessionUser | null> {
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

export async function enrichHotelStaffSession(
  staff: SatelliteStaffSession<HotelSessionUser>,
  pathname?: string,
): Promise<SatelliteStaffSessionPayload> {
  const { session, user } = staff;
  await assertHotelApiEntitled(pathname, session.organizationId);
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

export async function getSatelliteSession(): Promise<SatelliteStaffSessionPayload | null> {
  let cookieStore: { get(name: string): { value: string } | undefined };
  let headerStore: { get(name: string): string | null };
  try {
    cookieStore = await cookies();
    headerStore = await headers();
  } catch {
    const frame = nestHttpFrame();
    if (!frame) return null;
    cookieStore = frame.cookies;
    headerStore = frame.headers;
  }
  const staff = await readSatelliteStaffSession({
    cookies: cookieStore,
    headers: headerStore,
    loadUser: loadHotelSessionUser,
  });
  if (!staff) return null;
  return enrichHotelStaffSession(staff);
}
