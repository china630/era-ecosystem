import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  authCookieName,
  enterSatelliteTenant,
  getBearerOrCookieToken,
  IndustryModuleInactiveError,
  resolveSatelliteOrganizationId,
  verifySatelliteSession,
} from "@era/satellite-kit";
import { requireRetailSatellite } from "@/lib/retail-module-gate";
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
    return jsonError(err.message, 403);
  }
  const msg = err instanceof Error ? err.message : "Internal error";
  return jsonError(msg, 500);
}

/** Resolve org from JWT / header / user / bind and enter ALS. */
export async function enterRetailRequestTenant(): Promise<string | undefined> {
  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  let headerStore: Awaited<ReturnType<typeof headers>>;
  try {
    cookieStore = await cookies();
    headerStore = await headers();
  } catch {
    return undefined;
  }
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

/** Call at the start of operational retail API handlers. Fail-closed. */
export async function assertRetailEntitled(): Promise<void> {
  const org = await enterRetailRequestTenant();
  await requireRetailSatellite(org);
}
