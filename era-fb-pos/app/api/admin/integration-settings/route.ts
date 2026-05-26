import { NextResponse } from "next/server";
import { z } from "zod";
import { SATELLITE_ROLE } from "@era/satellite-kit";
import { getSubscriptionMe } from "@/integration/control-plane-platform.client";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  const denied = requireAnyRole(session, [
    FB_ROLES.MANAGER,
    SATELLITE_ROLE.BUSINESS_OWNER,
    SATELLITE_ROLE.PLATFORM_MEMBER,
  ]);
  if (denied) return denied;
  if (!session?.financeRole?.trim()) {
    return NextResponse.json(
      {
        error: "Platform SSO session required (launch from Finance)",
        code: "PLATFORM_SESSION_REQUIRED",
      },
      { status: 403 },
    );
  }

  const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ?? "";
  let platformSubscription: unknown = null;
  if (organizationId) {
    try {
      platformSubscription = await getSubscriptionMe({ organizationId });
    } catch {
      platformSubscription = null;
    }
  }

  return NextResponse.json({
    organizationId: organizationId || null,
    controlPlaneUrl: process.env.CONTROL_PLANE_URL ?? null,
    platformSubscription,
    kkmDriver: process.env.KKM_DRIVER ?? "mock",
    stockConsumptionEnabled: process.env.STOCK_CONSUMPTION_ENABLED === "true",
  });
}

export async function PATCH(request: Request) {
  const session = await getSessionFromRequest(request);
  const denied = requireAnyRole(session, [FB_ROLES.MANAGER]);
  if (denied) return denied;

  z.object({ stockConsumptionEnabled: z.boolean().optional() }).parse(
    await request.json(),
  );
  const getRes = await GET(request);
  const data = await getRes.json();
  return NextResponse.json({
    ...data,
    note: "Set STOCK_CONSUMPTION_ENABLED on server to enable E8 dispatch.",
  });
}
