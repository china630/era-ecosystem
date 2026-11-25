import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
  clinicRoute,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { overlayProcedureTypeNames } from "@/domain/catalog/catalog-display-name.service";
import { readUiLocale } from "@/lib/request-locale";
import { listActiveProcedureTypesRaw, listInactiveServiceDepartmentCodes } from "@/lib/services/clinic-master-data.service";

@Controller()
export class ProcedureTypesController {

  @UseGuards(ClinicApiGuard)
  @Get("api/procedure-types")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CATALOG_READ);
    if (denied) return clinicBody(denied);

    const rows = await listActiveProcedureTypesRaw();
    const locale = await readUiLocale(clinicRoute(httpReq));
    const named = await overlayProcedureTypeNames(rows, locale);
    const deptCodes = [
      ...new Set(named.map((row) => row.departmentCode).filter((code): code is string => Boolean(code))),
    ];
    const inactiveDepts = new Set(await listInactiveServiceDepartmentCodes(deptCodes));
    return named.filter((row) => !row.departmentCode || !inactiveDepts.has(row.departmentCode));
  
        });
  }
}
