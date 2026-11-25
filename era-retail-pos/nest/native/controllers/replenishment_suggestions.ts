/** Lifted from nest/generated/replenishment_suggestions.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { financeReplenishmentSuggestions } from "@era/satellite-kit";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReplenishmentSuggestionsController {
  @Get("api/replenishment/suggestions")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const result = await financeReplenishmentSuggestions({
      authHeader: nestHeader(httpReq, "authorization"),
    });
    return sendJson(httpRes, result);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
