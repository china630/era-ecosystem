import { getBearerOrCookieToken } from "../auth/middleware-helpers";
import { authCookieName, verifySatelliteSession } from "../auth/session";
import { resolveSatelliteBillingStatus } from "./satellite-billing-gate";

export type SatelliteBillingStatusBody = {
  billingStatus: "ACTIVE" | "SOFT_BLOCK" | "HARD_BLOCK" | null;
  readOnly: boolean;
  exportsBlocked: boolean;
};

function cookieReader(header: string | null) {
  const jar = new Map<string, string>();
  for (const part of (header ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const raw = part.slice(eq + 1).trim();
    try {
      jar.set(name, decodeURIComponent(raw));
    } catch {
      jar.set(name, raw);
    }
  }
  return {
    get(name: string) {
      const value = jar.get(name);
      return value === undefined ? undefined : { value };
    },
  };
}

/**
 * `GET /api/platform/billing-status` for the shell banner. Each satellite
 * re-exports it from `app/api/platform/billing-status/route.ts`.
 * The org comes from the signed session token only.
 */
export async function GET(request: Request): Promise<Response> {
  const token = getBearerOrCookieToken(
    cookieReader(request.headers.get("cookie")),
    request.headers,
    authCookieName(),
  );
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let organizationId: string | undefined;
  try {
    organizationId = (await verifySatelliteSession(token)).organizationId?.trim();
  } catch {
    return Response.json({ error: "Invalid session" }, { status: 401 });
  }
  if (!organizationId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const billingStatus = await resolveSatelliteBillingStatus(organizationId);
  const body: SatelliteBillingStatusBody = {
    billingStatus,
    readOnly: billingStatus === "HARD_BLOCK",
    exportsBlocked: billingStatus === "SOFT_BLOCK",
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
