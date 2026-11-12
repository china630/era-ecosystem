import { NextResponse } from "next/server";
import { z } from "zod";
import { getSubscriptionMe } from "@/integration/control-plane-platform.client";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    if (!session?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_INTEGRATION);
    if (denied) return denied;
    if (!session.financeRole?.trim()) {
      return NextResponse.json(
        {
          error: "Platform SSO session required (launch from Finance)",
          code: "PLATFORM_SESSION_REQUIRED",
        },
        { status: 403 },
      );
    }

    const { organizationId } = session;
    const { listDevicesForSatellite } = await import("@era/satellite-kit");
    const devices = listDevicesForSatellite({ organizationId });
    let platformSubscription: unknown = null;
    try {
      platformSubscription = await getSubscriptionMe({ organizationId });
    } catch {
      platformSubscription = null;
    }

    return jsonOk({
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
  } catch (err) {
    return handleRouteError(err);
  }
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/integration-settings", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!session?.organizationId) {
      return sendJson(httpRes, { error: "Unauthorized" }, 401);
    }
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_INTEGRATION);
    if (denied) return denied;
    if (!session.financeRole?.trim()) {
      return sendJson(httpRes, 
        {
          error: "Platform SSO session required (launch from Finance)",
          code: "PLATFORM_SESSION_REQUIRED",
        }, 403);
    }

    const { organizationId } = session;
    const { listDevicesForSatellite } = await import("@era/satellite-kit");
    const devices = listDevicesForSatellite({ organizationId });
    let platformSubscription: unknown = null;
    try {
      platformSubscription = await getSubscriptionMe({ organizationId });
    } catch {
      platformSubscription = null;
    }

    return sendJson(httpRes, {
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
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/admin/integration-settings", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_INTEGRATION);
    if (denied) return denied;

    z.object({ stockConsumptionEnabled: z.boolean().optional() }).parse(
      httpReq.body,
    );
    const getRes = await GET(request);
    const data = httpReq.body;
    return sendJson(httpRes, {
      ...data,
      note: "Set STOCK_CONSUMPTION_ENABLED on server to enable E8 dispatch.",
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
