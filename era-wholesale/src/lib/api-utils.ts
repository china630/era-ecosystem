import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  authCookieName,
  enterSatelliteTenant,
  getBearerOrCookieToken,
  resolveSatelliteOrganizationId,
  verifySatelliteSession,
  type SatelliteSessionPayload,
} from "@era/satellite-kit";
import { requireWholesaleSatellite, IndustryModuleInactiveError } from "@/lib/wholesale-module-gate";
import { prisma } from "@/lib/prisma";

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

/** Resolve org from JWT / header / user / bind and enter ALS. */
export async function enterWholesaleRequestTenant(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  let organizationId = headerStore.get("x-era-organization-id")?.trim() || undefined;

  const token = getBearerOrCookieToken(
    cookieStore,
    headerStore,
    authCookieName(),
  );
  if (token) {
    try {
      const session = await verifySatelliteSession(token);
      organizationId = organizationId || session.organizationId?.trim() || undefined;
      if (!organizationId) {
        const row = await prisma.user.findUnique({
          where: { id: session.sub },
          select: { organizationId: true },
        });
        organizationId = row?.organizationId || undefined;
      }
    } catch {
      /* ignore — entitlement gate still runs */
    }
  }
  if (!organizationId) {
    try {
      organizationId = resolveSatelliteOrganizationId().organizationId;
    } catch {
      organizationId = undefined;
    }
  }
  if (organizationId) {
    enterSatelliteTenant({ organizationId });
  }
  return organizationId;
}

/** Call at the start of authenticated API handlers (session helper). */
export async function assertWholesaleEntitled(): Promise<void> {
  await requireWholesaleSatellite();
  await enterWholesaleRequestTenant();
}

export async function getRouteSession(): Promise<SatelliteSessionPayload | null> {
  await assertWholesaleEntitled();
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
