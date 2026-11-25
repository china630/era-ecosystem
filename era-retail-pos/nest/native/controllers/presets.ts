/** Lifted from nest/generated/presets.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { RETAIL_PRESET_CONFIG, RETAIL_PRESETS } from "@/lib/retail-preset";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class PresetsController {
  @Get("api/presets")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    return sendJson(httpRes, {
      presets: RETAIL_PRESETS,
      config: RETAIL_PRESET_CONFIG,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
