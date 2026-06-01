import {
  authCookieName,
  sessionHasRole,
  verifySatelliteSession,
  type SatelliteSessionPayload,
} from "@era/satellite-kit";

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
    return await verifySatelliteSession(token);
  } catch {
    return null;
  }
}

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
} as const;
