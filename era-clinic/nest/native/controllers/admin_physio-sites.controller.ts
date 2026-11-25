import { expressKitHeaders } from "@era/satellite-kit";
import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { createPhysioSite, listPhysioSites } from "@/domain/physio/physio-catalog.service";


const createSchema = z.object({
  code: z.string().min(1),
  kind: z.enum(["USSR-817", "SHCHERBAK", "HYDRO", "LOCAL"]),
  prikaz817: z.number().int().nullable().optional(),
  laterality: z.boolean().optional(),
  titleAz: z.string().min(1),
  titleRu: z.string().min(1),
  titleEn: z.string().min(1),
  titleLa: z.string().min(1),
  boundary: z.string().nullable().optional(),
  coarse: z.array(z.string()).min(1),
  anatomyJson: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  aliases: z.array(z.string()).optional(),
});

@Controller()
export class AdminPhysioSitesController {

  @Get("api/admin/physio-sites")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const rows = await listPhysioSites({
      q: url.searchParams.get("q") ?? undefined,
      activeOnly: url.searchParams.get("activeOnly") === "1",
    });
    return rows;
  
        });
  }

  @Post("api/admin/physio-sites")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = createSchema.parse(httpReq.body);
    const row = await createPhysioSite(body);
    await recordClinicAudit(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      "PhysioSite",
      row.id,
      "CREATE",
      { code: row.code },
    );
    throw new HttpException(row, 201);
  
        });
  }
}
