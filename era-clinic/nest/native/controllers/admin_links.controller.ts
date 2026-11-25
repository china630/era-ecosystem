import { Controller, Get, HttpCode, Patch, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { fetchCpChannels, patchCpChannel } from "@/lib/cp-channels-client";
import { resolveOperatingMode } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";

@Controller()
export class AdminLinksController {

  @Get("api/admin/links")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const channels = await fetchCpChannels();
    const mode = await resolveOperatingMode(requestOrganizationId()).catch(() => null);
    return {
      ...channels,
      operatingMode: mode,
    };
  
        });
  }

  @Patch("api/admin/links")
  @HttpCode(200)
  async patch_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = (httpReq.body) as { channelId?: string; enabled?: boolean };
    if (!body.channelId || typeof body.enabled !== "boolean") {
      throw new HttpException({ error: "channelId and enabled required" }, 400);
    }
    const result = await patchCpChannel(body.channelId, body.enabled);
    if (!result.ok) {
      throw new HttpException({ error: "Channel update failed", status: result.status }, (
        { status: result.status >= 400 ? result.status : 502 }).status ?? 200);
    }
    return { ok: true };
  
        });
  }
}
