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
import {
  requireBankSatellite,
  IndustryModuleInactiveError,
} from "@/lib/bank-module-gate";

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

/** Call at the start of authenticated API handlers (session helper). */
export async function assertBankEntitled(): Promise<void> {
  await requireBankSatellite();
}

export async function getRouteSession(): Promise<SatelliteSessionPayload | null> {
  await assertBankEntitled();
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
