/** Lifted from nest/generated/settings_integrations.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessAnyPermission, denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getFnbIntegrationSettings, upsertFnbIntegrationSettings } from "@/lib/fnb-integration-settings";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  financeWebUrl: z.string().max(500).optional(),
  hotelPmsUrl: z.string().max(500).optional(),
  orchestratorBaseUrl: z.string().max(500).optional(),
});


@Controller()
export class SettingsIntegrationsController {
  @Get("api/settings/integrations")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    if (!session?.organizationId) {
      return sendJson(httpRes, { error: "Unauthorized" }, 401);
    }
    // Read: Settings, Menu (recipes deep-link), or Buffet (Open Finance).
    const denied = denyUnlessAnyPermission(session, [
      PERMISSIONS.ADMIN_INTEGRATION,
      PERMISSIONS.SCREEN_ADMIN_SETTINGS,
      PERMISSIONS.SCREEN_ADMIN_MENU,
      PERMISSIONS.SCREEN_ADMIN_BUFFET,
    ]);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const settings = await getFnbIntegrationSettings(session.organizationId);
    return sendJson(httpRes, { settings });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Patch("api/settings/integrations")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    if (!session?.organizationId) {
      return sendJson(httpRes, { error: "Unauthorized" }, 401);
    }
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_INTEGRATION);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const body = patchSchema.parse(httpReq.body);
    const settings = await upsertFnbIntegrationSettings(body, session.organizationId);
    return sendJson(httpRes, { settings });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
