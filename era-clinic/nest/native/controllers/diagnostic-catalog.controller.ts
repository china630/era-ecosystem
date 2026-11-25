import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { filterAndSortCatalogItems, getDiagnosticCatalog } from "@/domain/catalog/diagnostic-catalog";
import { getCatalogFavorites } from "@/domain/catalog/catalog-favorites.service";


const querySchema = z.object({
  kinds: z.string().optional(),
  search: z.string().optional(),
  applyFavorites: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

@Controller()
export class DiagnosticCatalogController {

  @UseGuards(ClinicApiGuard)
  @Get("api/diagnostic-catalog")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CATALOG_READ);
    if (denied) return clinicBody(denied);

        const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const query = querySchema.parse({
      kinds: url.searchParams.get("kinds") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      applyFavorites: url.searchParams.get("applyFavorites") ?? undefined,
    });

    const catalog = await getDiagnosticCatalog();
    const favorites = await getCatalogFavorites();
    const kinds = query.kinds
      ? query.kinds.split(",").map((k) => k.trim()).filter(Boolean)
      : undefined;

    const items = query.applyFavorites
      ? filterAndSortCatalogItems(catalog.items, favorites.keys, favorites.mode, {
          kinds,
          search: query.search,
        })
      : filterAndSortCatalogItems(catalog.items, [], "first", {
          kinds,
          search: query.search,
        });

    return {
      version: catalog.version,
      metaFields: catalog.metaFields,
      groups: catalog.groups,
      items,
      favorites,
    };
  
        });
  }
}
