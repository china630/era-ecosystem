import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { getActivePhysioCatalog } from "@/domain/physio/physio-catalog.service";


/** Ops read of active S + programs + substances (W3 type-gated fields). */

@Controller()
export class PhysioCatalogController {

  @UseGuards(ClinicApiGuard)
  @Get("api/physio-catalog")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CATALOG_READ);
    if (denied) return clinicBody(denied);

        return await getActivePhysioCatalog();
  
        });
  }
}
