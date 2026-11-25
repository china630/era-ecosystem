/** Lifted from nest/generated/admin_links.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { fetchCpChannels, patchCpChannel } from "@/lib/cp-channels-client";
import { resolveOperatingMode } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class AdminLinksController {
  @Get("api/admin/links")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    assertPermission(session, PERMISSIONS.ADMIN_SETTINGS);
    const channels = await fetchCpChannels();
    const mode = await resolveOperatingMode(requestOrganizationId()).catch(() => null);
    return sendJson(httpRes, {
      ...channels,
      operatingMode: mode,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/admin/links")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    assertPermission(session, PERMISSIONS.ADMIN_SETTINGS);
    const body = (httpReq.body) as { channelId?: string; enabled?: boolean };
    if (!body.channelId || typeof body.enabled !== "boolean") {
      return sendJson(httpRes, { error: "channelId and enabled required" }, 400);
    }
    const result = await patchCpChannel(body.channelId, body.enabled);
    if (!result.ok) {
      return sendJson(httpRes, 
        { error: "Channel update failed", status: result.status }, (
        { status: result.status >= 400 ? result.status : 502 }).status ?? 200);
    }
    return sendJson(httpRes, { ok: true });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
