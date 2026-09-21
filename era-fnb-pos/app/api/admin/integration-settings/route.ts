import { assertFnbEntitled } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveSatelliteOrganizationId } from "@era/satellite-kit";
import { getSubscriptionMe } from "@/integration/control-plane-platform.client";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(request: Request) {
  await assertFnbEntitled();
  const session = await getSessionFromRequest(request);
  const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_INTEGRATION);
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

  const { organizationId, source } = resolveSatelliteOrganizationId({ allowFallback: true });
  const { listDevicesForSatellite } = await import("@era/satellite-kit");
  const devices = listDevicesForSatellite({ organizationId });
  let platformSubscription: unknown = null;
  if (source !== "fallback") {
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
    kkmSource: devices.length > 0 ? "org-catalog" : "env-fallback-deprecated",
    kkmDriver:
      devices.find((d) => d.kind === "FISCAL_KKM")?.providerId ??
      process.env.ERA_FISCAL_PROVIDER ??
      process.env.KKM_DRIVER ??
      "mock",
    fiscalDeviceCount: devices.length,
    stockConsumptionEnabled: process.env.STOCK_CONSUMPTION_ENABLED === "true",
  });
}

export async function PATCH(request: Request) {
  await assertFnbEntitled();
  const session = await getSessionFromRequest(request);
  const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_INTEGRATION);
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
