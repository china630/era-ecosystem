import { Controller, Get, HttpCode, Post, Put, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { getTenantIcdFavorites, retireIcdCode, setTenantIcdFavorites } from "@/domain/icd/icd-search.service";
import { getLocalIcd10Version, syncIcd10FromGatewayOrFile } from "@/domain/icd/icd-sync.service";


const putSchema = z.object({
  codes: z.array(z.string().min(1).max(16)).max(80),
});
const retireSchema = z.object({
  code: z.string().min(1).max(16),
});

@Controller()
export class AdminIcdFavoritesController {

  @Get("api/admin/icd-favorites")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const [codes, version] = await Promise.all([
      getTenantIcdFavorites(),
      getLocalIcd10Version(),
    ]);
    return { codes, version };
  
        });
  }

  @Put("api/admin/icd-favorites")
  @HttpCode(200)
  async put_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = putSchema.parse(httpReq.body);
    const tenant = await setTenantIcdFavorites(body.codes);
    return { codes: tenant.icdFavoriteCodes };
  
        });
  }

  @Post("api/admin/icd-favorites")
  @HttpCode(200)
  async post_2(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const action = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("action");
    if (action === "sync") {
      return await syncIcd10FromGatewayOrFile();
    }
    if (action === "retire") {
      const body = retireSchema.parse(httpReq.body);
      const row = await retireIcdCode(body.code);
      return { code: row.code, active: row.active, retiredAt: row.retiredAt };
    }
    throw new HttpException({ error: "Unknown action" }, 400);
  
        });
  }
}
