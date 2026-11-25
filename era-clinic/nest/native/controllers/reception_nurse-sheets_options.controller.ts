import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listProcedureDeskStaff } from "@/domain/procedure/procedure-desk-staff";
import { requestOrganizationId } from "@/lib/request-organization";
import { listNurseSheetFormOptions } from "@/domain/appointment/appointment-calendar.service";

@Controller()
export class ReceptionNurseSheetsOptionsController {

  @UseGuards(ClinicApiGuard)
  @Get("api/reception/nurse-sheets/options")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.SCREEN_RECEPTION_EXTRA_TICKETS,
    );
    if (denied) return clinicBody(denied);
    const organizationId = requestOrganizationId();
    const [staff, procedures] = await Promise.all([
      listProcedureDeskStaff(),
      listNurseSheetFormOptions(organizationId),
    ]);
    return {
      staff: staff.map((row) => ({ id: row.id, fullName: row.fullName })),
      procedures,
    };
  
        });
  }
}
