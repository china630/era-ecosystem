import { Controller, Get, HttpCode, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { listImportEntities } from "@/lib/import/adapters";
import { assertClinicImportAccess } from "@/lib/import/auth";

@Controller()
export class ImportController {

  @Get("api/import")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const access = await assertClinicImportAccess(clinicRoute(httpReq));
    if (access.error) return clinicBody(access.error);
    return listImportEntities();
  
        });
  }
}
