import type { SatelliteSessionPayload } from "./session";
import { sessionHasRole } from "./roles";

export class SatelliteForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "SatelliteForbiddenError";
  }
}

/** Throws if session lacks required satellite role code. */
export function requireRole(
  session: SatelliteSessionPayload,
  role: string,
): void {
  if (!sessionHasRole(session, role)) {
    throw new SatelliteForbiddenError(`Role ${role} required`);
  }
}

/** Next.js route helper: returns 403 Response or null if allowed. */
export function forbidUnlessRole(
  session: SatelliteSessionPayload,
  role: string,
): Response | null {
  if (!sessionHasRole(session, role)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}
