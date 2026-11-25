import { Controller, HttpCode, Post, Req, Res, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
} from "../../bridge";
import { z } from "zod";
import { importClinicOrgSlice } from "@/lib/placement-slice.service";
import { ORG_FULL_SLICE_FORMAT_VERSION } from "@era/satellite-kit";


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
  const auth = request.get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  return auth === token;
}

@Controller()
export class InternalV1PlacementImportSliceController {

  @Post("api/internal/v1/placement/import-slice")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      if (!assertServiceToken(httpReq)) return unauthorized();
    const body = bodySchema.parse(httpReq.body);
    const result = await importClinicOrgSlice({
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
      throw new HttpException({ error: result.reason }, 400);
    }
    return result;
  
        });
  }
}
