/** Lifted from nest/generated/settings_business-day.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { normalizeBusinessDayStart, upsertOrganizationBusinessDayStart } from "@/lib/business-day";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  businessDayStart: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});


@Controller()
export class SettingsBusinessDayController {
  @Get("api/settings/business-day")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const profile = await getFnbOrgProfile();
    return sendJson(httpRes, { businessDayStart: profile.businessDayStart });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Patch("api/settings/business-day")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const body = patchSchema.parse(httpReq.body);
    const businessDayStart = normalizeBusinessDayStart(body.businessDayStart.slice(0, 5));
    const organizationId = requestOrganizationId();
    await upsertOrganizationBusinessDayStart(organizationId, businessDayStart);
    return sendJson(httpRes, { businessDayStart });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
