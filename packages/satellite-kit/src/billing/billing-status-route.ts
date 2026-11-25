import { getBearerOrCookieToken } from "../auth/middleware-helpers";
import { authCookieName, verifySatelliteSession } from "../auth/session";
import { resolveSatelliteBillingStatus } from "./satellite-billing-gate";
import { kitJson, kitResultToNext, type KitHttpResult } from "../tenancy/organization-bind";
import type { KitHeaderSource } from "../http/kit-call";

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
export async function readBillingStatusFrom(headers: KitHeaderSource): Promise<KitHttpResult> {
  const token = getBearerOrCookieToken(
    cookieReader(headers.get("cookie")),
    headers,
    authCookieName(),
  );
  if (!token) return kitJson({ error: "Unauthorized" }, 401);
  let organizationId: string | undefined;
  try {
    organizationId = (await verifySatelliteSession(token)).organizationId?.trim();
  } catch {
    return kitJson({ error: "Invalid session" }, 401);
  }
  if (!organizationId) return kitJson({ error: "Unauthorized" }, 401);

  const billingStatus = await resolveSatelliteBillingStatus(organizationId);
  const body: SatelliteBillingStatusBody = {
    billingStatus,
    readOnly: billingStatus === "HARD_BLOCK",
    exportsBlocked: billingStatus === "SOFT_BLOCK",
  };
  return kitJson(body, 200, { "Cache-Control": "no-store" });
}

export async function readBillingStatus(request: Request): Promise<KitHttpResult> {
  return readBillingStatusFrom(request.headers);
}

export async function GET(request: Request): Promise<Response> {
  return kitResultToNext(await readBillingStatus(request));
}
