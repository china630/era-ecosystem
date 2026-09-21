import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { ZodError } from "zod";
import {
  authCookieName,
  enterSatelliteTenant,
  getBearerOrCookieToken,
  IndustryModuleInactiveError,
  resolveSatelliteOrganizationId,
  verifySatelliteSession,
} from "@era/satellite-kit";
import { requireFnbSatellite } from "@/lib/fnb-module-gate";
import { prisma } from "@/lib/prisma";
import {
  FnbHotelModeError,
  FnbQuotaError,
  FnbSubmoduleInactiveError,
} from "@/lib/fnb-module-gate";
import { FnbSoldOutError } from "@/lib/fnb-sold-out";
import { FnbWaiterNoPayError } from "@/lib/fnb-roles";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(err: unknown) {
  if (err instanceof ZodError) {
    return jsonError(err.errors.map((e) => e.message).join("; "), 400);
  }
  if (err instanceof IndustryModuleInactiveError) {
    return jsonError(err.message, 403);
  }
  if (err instanceof FnbHotelModeError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: 403 },
    );
  }
  if (err instanceof FnbSubmoduleInactiveError) {
    return NextResponse.json(
      { error: err.message, code: err.code, moduleKey: err.moduleKey },
      { status: 403 },
    );
  }
  if (err instanceof FnbQuotaError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: 429 },
    );
  }
  if (err instanceof FnbSoldOutError) {
    return NextResponse.json(
      { error: err.message, code: err.code, plu: err.plu },
      { status: 409 },
    );
  }
  if (err instanceof FnbWaiterNoPayError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: 403 },
    );
  }
  if (err instanceof Error && err.name === "FiscalError") {
    return jsonError(err.message, 400);
  }
  if (err instanceof Error) {
    if (err.message === "Unauthorized") {
      return jsonError(err.message, 401);
    }
    if (err.message.startsWith("Forbidden")) {
      return jsonError(err.message, 403);
    }
    return jsonError(err.message, 500);
  }
  return jsonError("Internal error", 500);
}

/** Resolve org from JWT / header / user / bind and enter ALS. */
export async function enterFnbRequestTenant(): Promise<string | undefined> {
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

/** Call at the start of operational F&B API handlers. */
export async function assertFnbEntitled(): Promise<void> {
  const org = await enterFnbRequestTenant();
  await requireFnbSatellite(org);
}
