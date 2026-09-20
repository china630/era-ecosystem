import {
  authCookieName,
  sessionHasRole,
  verifySatelliteSession,
  type SatelliteSessionPayload,
} from "@era/satellite-kit";
import {
  permissionsForUserId,
  permissionsForRoleCode,
} from "@/lib/auth/fnb-permission.service";
import { isSystemFnbRoleCode } from "@/lib/auth/permissions";

export async function getSessionFromRequest(
  request: Request,
): Promise<SatelliteSessionPayload | null> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const name = authCookieName();
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  const token = decodeURIComponent(match.slice(name.length + 1));
  try {
    const session = await verifySatelliteSession(token);
    // Reload grants from DB for User-backed sessions (API authority).
    if (session.organizationId && session.pin !== true) {
      try {
        const permissions = await permissionsForUserId(session.sub);
        return { ...session, permissions };
      } catch {
        return session;
      }
    }
    if (session.organizationId && session.pin === true && isSystemFnbRoleCode(session.role)) {
      try {
        const permissions = await permissionsForRoleCode(
          session.organizationId,
          session.role,
        );
        return { ...session, permissions };
      } catch {
        return session;
      }
    }
    return session;
  } catch {
    return null;
  }
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
