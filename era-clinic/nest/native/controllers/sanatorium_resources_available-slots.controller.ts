import { Controller, Get, HttpCode, Req, Res, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listAvailableResourceSlots } from "@/domain/procedure/procedure-inventory.service";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";

@Controller()
export class SanatoriumResourcesAvailableSlotsController {

  @UseGuards(ClinicApiGuard)
  @Get("api/sanatorium/resources/available-slots")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_SANATORIUM_RESOURCES);
    if (denied) return clinicBody(denied);

    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const dateParam = url.searchParams.get("date") ?? todayBakuYmd();
    const resourceId = url.searchParams.get("resourceId") ?? undefined;
    const procedureCode = url.searchParams.get("procedureCode") ?? undefined;
    const patientRefId = url.searchParams.get("patientRefId") ?? undefined;
    const excludeOrderId = url.searchParams.get("excludeOrderId") ?? undefined;

    const { clinicDayIsClosed } = await import("@/domain/planning/slot-decision");
    if (await clinicDayIsClosed(dateParam)) {
      return { date: dateParam, closed: true, slots: [] };
    }
    const slots = await listAvailableResourceSlots({
      date: bakuDayBounds(dateParam).start,
      resourceId,
      procedureCode,
      patientRefId,
      excludeOrderId,
    });
    return { date: dateParam, closed: false, slots };
  
        });
  }
}
