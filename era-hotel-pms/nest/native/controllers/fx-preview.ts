/** Lifted from era-hotel-pms/nest/generated/fx-preview.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { financeFxPreview } from "@era/satellite-kit";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const querySchema = z.object({
  from: z.string().min(3),
  amount: z.coerce.number().min(0),
  to: z.string().optional(),
  date: z.string().optional(),
});


@Controller()
export class FxPreviewController {
  @Get("api/fx-preview")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const url = requestUrl;
    const params = querySchema.parse({
      from: url.searchParams.get("from"),
      amount: url.searchParams.get("amount") ?? "100",
      to: url.searchParams.get("to") ?? undefined,
      date: url.searchParams.get("date") ?? undefined,
    });
    const preview = await financeFxPreview(params, {
      authHeader: nestHeader(httpReq, "authorization"),
    });
    return sendJson(httpRes, preview);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
