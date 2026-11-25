import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { listPersonIdentifiers } from "@era/satellite-kit";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";

@Controller()
export class MdmPersonIdentifiersController {

  @UseGuards(ClinicApiGuard)
  @Get("api/mdm/person-identifiers")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_MDM_READ);
    if (denied) return clinicBody(denied);

        const globalPersonId = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("globalPersonId")?.trim();
    if (!globalPersonId) {
      throw new HttpException({ error: "globalPersonId query parameter is required" }, 400);
    }
    const result = await listPersonIdentifiers(globalPersonId);
    return result;
  
        });
  }
}
