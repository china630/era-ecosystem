import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { ensureServiceCatalogSeeded } from "@/lib/service-catalog-seed";
import { listServiceCatalogCacheRows } from "@/lib/services/clinic-master-data.service";

@Controller()
export class CatalogServicesController {

  @UseGuards(ClinicApiGuard)
  @Get("api/catalog/services")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CATALOG_READ);
    if (denied) return clinicBody(denied);

    await ensureServiceCatalogSeeded();
    const services = await listServiceCatalogCacheRows();
    return services;
  
        });
  }
}
