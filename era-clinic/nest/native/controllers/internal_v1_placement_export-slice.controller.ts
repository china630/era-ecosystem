import { Controller, HttpCode, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
} from "../../bridge";
import { z } from "zod";
import { clinicSliceMetaSummary, exportClinicOrgSlice } from "@/lib/placement-slice.service";


const bodySchema = z.object({
  organizationId: z.string().uuid(),
  includeRows: z.boolean().optional().default(true),
});

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function assertServiceToken(request: Request): boolean {
  const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!token) return process.env.NODE_ENV !== "production";
  const auth = request.get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  return auth === token;
}

/** Full clinic org slice (formatVersion 2). */

@Controller()
export class InternalV1PlacementExportSliceController {

  @Post("api/internal/v1/placement/export-slice")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      if (!assertServiceToken(httpReq)) return unauthorized();
    const body = bodySchema.parse(httpReq.body);
    const slice = await exportClinicOrgSlice(body.organizationId);
    const summary = clinicSliceMetaSummary(slice);
    if (!body.includeRows) return summary;
    return { ...summary, rows: slice.rows };
  
        });
  }
}
