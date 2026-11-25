import { Controller, Get, HttpCode, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { getCatalogFavorites, updateCatalogFavorites } from "@/domain/catalog/catalog-favorites.service";
import { getDiagnosticCatalog } from "@/domain/catalog/diagnostic-catalog";


const patchSchema = z.object({
  keys: z.array(z.string()).optional(),
  mode: z.enum(["first", "only"]).optional(),
});

@Controller()
export class AdminCatalogFavoritesController {

  @Get("api/admin/catalog-favorites")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const favorites = await getCatalogFavorites();
    const catalog = await getDiagnosticCatalog();
    return {
      ...favorites,
      groups: catalog.groups,
      items: catalog.items.map((i) => ({
        code: i.code,
        kind: i.kind,
        modality: i.modality,
        category: i.category,
        title: i.title,
      })),
    };
  
        });
  }

  @Patch("api/admin/catalog-favorites")
  @HttpCode(200)
  async patch_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = patchSchema.parse(httpReq.body);
    const favorites = await updateCatalogFavorites(body);
    return favorites;
  
        });
  }
}
