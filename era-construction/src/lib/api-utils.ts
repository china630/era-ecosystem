import { nestHttpFrame } from "@/lib/nest-http-context";
import {
  readSatelliteStaffSession,
  type SatelliteStaffSessionPayload,
} from "@era/satellite-kit";
import { isSatelliteBillingBlockedError } from "@era/satellite-kit/billing/gate";
import { requireConstructionSatellite, IndustryModuleInactiveError } from "@/lib/construction-module-gate";
import { prisma } from "@/lib/prisma";
import { assertApiRouteGrant } from "@/lib/auth/require";
import type { RoleGrantRow } from "@/lib/auth/permission-catalog";
import { grantsForUser, ROLE_GRANT_SELECT } from "@/lib/auth/construction-permission.service";

/** Same value as the kit `ERA_PATHNAME_HEADER`; Nest ALS stamps path/method on the frame. */
const PATHNAME_HEADER = "x-era-pathname";

export type RouteErrorBody = Record<string, unknown>;
export type RouteErrorResult = { status: number; body: RouteErrorBody };

export function jsonErrorBody(message: string): RouteErrorBody {
  return { error: message };
}

/** Nest-safe error map (no NextResponse). */
export function handleRouteError(err: unknown): RouteErrorResult {
  if (isSatelliteBillingBlockedError(err)) {
    return {
      status: err.status,
      body: { error: err.message, code: err.code, billingStatus: err.billingStatus },
    };
  }
  if (err && typeof err === "object" && "issues" in err) {
    return { status: 400, body: jsonErrorBody("Validation failed") };
  }
  if (err instanceof IndustryModuleInactiveError) {
    return { status: err.status ?? 403, body: jsonErrorBody(err.message) };
  }
  if (err instanceof Error && err.name === "IndustryModuleInactiveError") {
    const status =
      "status" in err && typeof (err as { status?: number }).status === "number"
        ? (err as { status: number }).status
        : 403;
    return { status, body: jsonErrorBody(err.message) };
  }
  if (err instanceof Error && (err.name === "UnauthorizedError" || err.name === "PermissionDeniedError")) {
    return {
      status: err.name === "UnauthorizedError" ? 401 : 403,
      body: jsonErrorBody(err.message),
    };
  }
  const msg = err instanceof Error ? err.message : "Internal error";
  return { status: 500, body: jsonErrorBody(msg) };
}

export type StaffSession = SatelliteStaffSessionPayload & { permissions: string[] };

/**
 * Staff session for the Nest edge: org from the signed token, active user row,
 * module gate, then the grant for this API path (CN-RBAC-01).
 * Pass cookie and header readers from the Express request.
 * With neither readers nor a test frame, there is no session.
 */
export async function getSatelliteSession(explicit?: {
  cookies: { get(name: string): { value: string } | undefined };
  headers: { get(name: string): string | null };
}): Promise<StaffSession | null> {
  const frame = nestHttpFrame();
  const cookieStore = explicit?.cookies ?? frame?.cookies;
  const headerStore = explicit?.headers ?? frame?.headers;
  if (!cookieStore || !headerStore) return null;
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
  await requireConstructionSatellite(staff.session.organizationId);
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
  assertApiRouteGrant(session, headerStore.get(PATHNAME_HEADER), headerStore.get("x-era-method"));
  return session;
}
