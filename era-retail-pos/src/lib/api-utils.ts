import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { nestHttpFrame } from "@/lib/nest-http-context";
import {
  readSatelliteStaffSession,
  type SatelliteStaffSessionPayload,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";
import { isSatelliteBillingBlockedError } from "@era/satellite-kit/billing/gate";
import { requireRetailSatellite } from "@/lib/retail-module-gate";
import { prisma } from "@/lib/prisma";
import { assertApiRouteGrant } from "@/lib/auth/require";
import type { RoleGrantRow } from "@/lib/auth/permission-catalog";
import { grantsForUser, ROLE_GRANT_SELECT } from "@/lib/auth/retail-permission.service";

/** Same value as the kit `ERA_PATHNAME_HEADER`; the staff middleware overwrites any client copy. */
const PATHNAME_HEADER = "x-era-pathname";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export type RouteErrorResult = { status: number; body: Record<string, unknown> };

export function describeRouteError(err: unknown): RouteErrorResult {
  if (isSatelliteBillingBlockedError(err)) {
    return {
      status: err.status,
      body: { error: err.message, code: err.code, billingStatus: err.billingStatus },
    };
  }
  if (err && typeof err === "object" && "issues" in err) {
    return { status: 400, body: { error: "Validation failed" } };
  }
  if (err instanceof IndustryModuleInactiveError) {
    return { status: 403, body: { error: err.message } };
  }
  if (err instanceof Error && err.name === "SatelliteChannelDisabledError") {
    return {
      status: 403,
      body: {
        error: err.message,
        code:
          "code" in err && typeof (err as { code?: string }).code === "string"
            ? (err as { code: string }).code
            : "SATELLITE_CHANNEL_DISABLED",
      },
    };
  }
  if (err instanceof Error && (err.name === "UnauthorizedError" || err.name === "PermissionDeniedError")) {
    return { status: err.name === "UnauthorizedError" ? 401 : 403, body: { error: err.message } };
  }
  if (err instanceof Error && err.name === "FiscalError") {
    return { status: 400, body: { error: err.message } };
  }
  const msg = err instanceof Error ? err.message : "Internal error";
  return { status: 500, body: { error: msg } };
}

export function handleRouteError(err: unknown) {
  const described = describeRouteError(err);
  return NextResponse.json(described.body, { status: described.status });
}

export type StaffSession = SatelliteStaffSessionPayload & { permissions: string[] };

/**
 * Staff session: org from the signed token, active user row, module gate, then
 * the grant for this API path from the role row (RET-RBAC-01).
 * No session → null (401); module off → IndustryModuleInactiveError (403);
 * missing grant → PermissionDeniedError (403).
 * Call once per handler, inside try, and pass the session on.
 */
export async function getSatelliteSession(explicit?: {
  cookies: { get(name: string): { value: string } | undefined };
  headers: { get(name: string): string | null };
}): Promise<StaffSession | null> {
  let cookieStore: { get(name: string): { value: string } | undefined };
  let headerStore: { get(name: string): string | null };
  if (explicit) {
    cookieStore = explicit.cookies;
    headerStore = explicit.headers;
  } else {
    try {
      cookieStore = await cookies();
      headerStore = await headers();
    } catch {
      const frame = nestHttpFrame();
      if (!frame) return null;
      cookieStore = frame.cookies as Awaited<ReturnType<typeof cookies>>;
      headerStore = frame.headers as Awaited<ReturnType<typeof headers>>;
    }
  }
  const staff = await readSatelliteStaffSession({
    cookies: cookieStore,
    headers: headerStore,
    loadUser: async ({ sub }) => {
      const user = await prisma.user.findUnique({
        where: { id: sub },
        select: {
          organizationId: true,
          status: true,
          login: true,
          email: true,
          role: { select: ROLE_GRANT_SELECT },
        },
      });
      return user
        ? {
            organizationId: user.organizationId,
            active: user.status === "ACTIVE",
            login: user.login,
            email: user.email,
            role: user.role as RoleGrantRow | null,
          }
        : null;
    },
  });
  if (!staff) return null;
  await requireRetailSatellite(staff.session.organizationId);
  const role = staff.user.role ?? null;
  const session: StaffSession = {
    ...staff.session,
    role: role?.code ?? staff.session.role,
    permissions: grantsForUser({
      login: staff.user.login ?? staff.session.login,
      email: staff.user.email ?? staff.session.email,
      role,
      isOwner: staff.session.isOwner === true,
      pin: staff.session.pin === true,
    }),
  };
  assertApiRouteGrant(session, headerStore.get(PATHNAME_HEADER));
  return session;
}
