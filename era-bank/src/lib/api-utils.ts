import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  authCookieName,
  getBearerOrCookieToken,
  verifySatelliteSession,
  type SatelliteSessionPayload,
} from "@era/satellite-kit";
import {
  BankingEntitlementError,
  BankEngineError,
} from "@/lib/engine-client";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(err: unknown) {
  if (err instanceof BankingEntitlementError) {
    return jsonError(err.message, 403);
  }
  if (err instanceof BankEngineError) {
    return NextResponse.json(err.body ?? { error: err.message }, {
      status: err.status,
    });
  }
  if (err && typeof err === "object" && "issues" in err) {
    return jsonError("Validation failed", 400);
  }
  const msg = err instanceof Error ? err.message : "Internal error";
  return jsonError(msg, 500);
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
  try {
    return await verifySatelliteSession(token);
  } catch {
    return null;
  }
}

export async function requireRouteSession(): Promise<
  SatelliteSessionPayload | NextResponse
> {
  const session = await getRouteSession();
  if (!session) return jsonError("Unauthorized", 401);
  return session;
}
