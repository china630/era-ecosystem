import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  authCookieName,
  getBearerOrCookieToken,
  verifySatelliteSession,
  type SatelliteSessionPayload,
} from "@era/satellite-kit";
import { requireConstructionSatellite, IndustryModuleInactiveError } from "@/lib/construction-module-gate";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(err: unknown) {
  if (err && typeof err === "object" && "issues" in err) {
    return jsonError("Validation failed", 400);
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
  const msg = err instanceof Error ? err.message : "Internal error";
  return jsonError(msg, 500);
}

/** Call at the start of authenticated API handlers (session helper). */
export async function assertConstructionEntitled(): Promise<void> {
  await requireConstructionSatellite();
}

export async function getRouteSession(): Promise<SatelliteSessionPayload | null> {
  await assertConstructionEntitled();
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
