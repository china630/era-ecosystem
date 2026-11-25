import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { ClinicLookupKind } from "@prisma/client";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { ensureBodyPartLookups } from "@/domain/catalog/body-part-lookup";
import { listClinicLookups, createClinicLookup } from "@/lib/services/clinic-master-data.service";


const kindSchema = z.nativeEnum(ClinicLookupKind);

const createSchema = z.object({
  kind: kindSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

@Controller()
export class AdminLookupsController {

  @Get("api/admin/lookups")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const kindRaw = url.searchParams.get("kind");
    const activeOnly = url.searchParams.get("activeOnly") === "1";
    const kind = kindRaw ? kindSchema.parse(kindRaw) : undefined;
    if (!kind || kind === "BODY_PART") await ensureBodyPartLookups();
    const rows = await listClinicLookups({ kind, activeOnly });
    return rows;
  
        });
  }

  @Post("api/admin/lookups")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = createSchema.parse(httpReq.body);
    const row = await createClinicLookup({
      kind: body.kind,
      code: body.code,
      name: body.name,
      sortOrder: body.sortOrder,
    });
    throw new HttpException(row, 201);
  
        });
  }
}
