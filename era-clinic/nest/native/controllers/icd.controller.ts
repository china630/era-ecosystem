import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { getTenantIcdFavorites, listIcdChapters, searchSelectableIcd } from "@/domain/icd/icd-search.service";

@Controller()
export class IcdController {

  @UseGuards(ClinicApiGuard)
  @Get("api/icd")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_ICD_READ);
    if (denied) return clinicBody(denied);

        const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const q = url.searchParams.get("q") ?? "";
    const chapter = url.searchParams.get("chapter") ?? "";
    const locale = url.searchParams.get("locale") ?? "en";
    const take = Number(url.searchParams.get("take") ?? "20");
    const favorites = await getTenantIcdFavorites();
    if (url.searchParams.get("chapters") === "1") {
      return { chapters: await listIcdChapters(locale) };
    }
    return await searchSelectableIcd({
        q,
        chapter: chapter || undefined,
        locale,
        take: Number.isFinite(take) ? take : 20,
        favoriteCodes: favorites,
      });
  
        });
  }
}
