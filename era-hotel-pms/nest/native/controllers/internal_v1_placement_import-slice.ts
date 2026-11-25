/** Lifted from era-hotel-pms/nest/generated/internal_v1_placement_import-slice.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { importHotelOrgSlice } from "@/lib/placement-slice.service";
import { ORG_FULL_SLICE_FORMAT_VERSION } from "@era/satellite-kit";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  mode: z.enum(["validate", "upsert"]).default("validate"),
  slice: z.object({
    organizationId: z.string().uuid(),
    formatVersion: z.literal(ORG_FULL_SLICE_FORMAT_VERSION),
    modelOrder: z.array(z.string()).min(1),
    tables: z.array(
      z.object({
        name: z.string(),
        rowCount: z.number().int().nonnegative(),
      }),
    ),
    rows: z.record(z.array(z.record(z.unknown()))),
    note: z.string(),
    checksum: z.string().min(8),
    satelliteKey: z.string().optional(),
    objectStorage: z
      .object({
        prefix: z.string(),
        entries: z.array(
          z.object({
            key: z.string(),
            bytes: z.number().optional(),
            contentType: z.string().nullable().optional(),
          }),
        ),
        stub: z.boolean().optional(),
      })
      .optional(),
  }),
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


@Controller()
export class InternalV1PlacementImportSliceController {
  @Post("api/internal/v1/placement/import-slice")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    if (!assertServiceToken({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() })) return unauthorized();
    const body = bodySchema.parse(httpReq.body);
    const result = await importHotelOrgSlice({
      organizationId: body.organizationId,
      slice: {
        ...body.slice,
        objectStorage: body.slice.objectStorage ?? {
          prefix: `org/${body.organizationId}/`,
          entries: [],
          stub: true,
        },
      },
      mode: body.mode,
    });
    if (!result.ok) {
      return sendJson(httpRes, { error: result.reason }, 400);
    }
    return sendJson(httpRes, result);
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
