/** Lifted from nest/generated/admin_integration-settings.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { getSubscriptionMe } from "@/integration/control-plane-platform.client";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

@Controller()
export class AdminIntegrationSettingsController {
  @Get("api/admin/integration-settings")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    if (!session?.organizationId) {
      return sendJson(httpRes, { error: "Unauthorized" }, 401);
    }
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_INTEGRATION);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Patch("api/admin/integration-settings")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_INTEGRATION);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    z.object({ stockConsumptionEnabled: z.boolean().optional() }).parse(
      httpReq.body,
    );
    const data = httpReq.body;
    return sendJson(httpRes, {
      ...data,
      note: "Set STOCK_CONSUMPTION_ENABLED on server to enable E8 dispatch.",
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
