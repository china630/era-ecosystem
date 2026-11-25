import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { createImagingPhrase, listImagingPhrases } from "@/domain/catalog/imaging-phrase.service";


const createSchema = z.object({
  organKey: z.string().min(1),
  code: z.string().min(1),
  textEn: z.string().min(1),
  textRu: z.string().min(1),
  textAz: z.string().min(1),
  measurementKeys: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

@Controller()
export class AdminDiagnosticCatalogImagingPhrasesController {

  @Get("api/admin/diagnostic-catalog/imaging-phrases")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const organKey = url.searchParams.get("organKey") ?? undefined;
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    return await listImagingPhrases({ organKey, includeInactive });
  
        });
  }

  @Post("api/admin/diagnostic-catalog/imaging-phrases")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = createSchema.parse(httpReq.body);
    throw new HttpException(await createImagingPhrase(body), 201);
  
        });
  }
}
