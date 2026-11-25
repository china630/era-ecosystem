/** Lifted from era-hotel-pms/nest/generated/internal_v1_placement_export-slice.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { exportHotelOrgSlice, hotelSliceMetaSummary } from "@/lib/placement-slice.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

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
  const auth = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  return auth === token;
}

/** Full hotel org slice (formatVersion 2) for PlacementJob. */


@Controller()
export class InternalV1PlacementExportSliceController {
  @Post("api/internal/v1/placement/export-slice")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    if (!assertServiceToken({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() })) return unauthorized();
    const body = bodySchema.parse(httpReq.body);
    const slice = await exportHotelOrgSlice(body.organizationId);
    const summary = hotelSliceMetaSummary(slice);
    if (!body.includeRows) return sendJson(httpRes, summary);
    return sendJson(httpRes, { ...summary, rows: slice.rows });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
