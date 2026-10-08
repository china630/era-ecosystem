import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  readSatelliteStaffSession,
  type SatelliteStaffSessionPayload,
} from "@era/satellite-kit";
import { isSatelliteBillingBlockedError } from "@era/satellite-kit/billing/gate";
import { prisma } from "@/lib/prisma";
import { permissionsForSession } from "@/lib/auth/bank-permission.service";
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
  if (isSatelliteBillingBlockedError(err)) {
    return NextResponse.json(
      { error: err.message, code: err.code, billingStatus: err.billingStatus },
      { status: err.status },
    );
  }
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

/**
 * Staff session: org from the signed token, active OpsUser row, banking gate,
 * grants from the DB. No session → null (401); module off →
 * IndustryModuleInactiveError (403). Call once per handler, inside try.
 */
export async function getSatelliteSession(): Promise<SatelliteStaffSessionPayload | null> {
  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  let headerStore: Awaited<ReturnType<typeof headers>>;
  try {
    cookieStore = await cookies();
    headerStore = await headers();
  } catch {
    return null;
  }
  const staff = await readSatelliteStaffSession({
    cookies: cookieStore,
    headers: headerStore,
    loadUser: async ({ sub }) => {
      const user = await prisma.opsUser.findUnique({
        where: { id: sub },
        select: {
          organizationId: true,
          status: true,
          opsRole: { select: { code: true, permissionsJson: true } },
        },
      });
      return user
        ? {
            organizationId: user.organizationId,
            active: user.status === "ACTIVE",
            opsRole: user.opsRole,
          }
        : null;
    },
  });
  if (!staff) return null;
  const { session, user } = staff;
  await requireBankSatellite(session.organizationId);
  return { ...session, permissions: permissionsForSession(session, user.opsRole) };
}
