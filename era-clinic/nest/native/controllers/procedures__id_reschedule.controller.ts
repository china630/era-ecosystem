import { Controller, HttpCode, Patch, Req, Res, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { receptionRescheduleProcedure } from "@/domain/procedure/procedure-attendance.service";
import { evaluateAndPublishCapacity } from "@/lib/capacity.service";


const schema = z.object({
  scheduledAt: z.string().datetime(),
  resourceId: z.string().optional(),
  allowOtherDay: z.boolean().optional(),
});

@Controller()
export class ProceduresIdRescheduleController {

  @UseGuards(ClinicApiGuard)
  @Patch("api/procedures/:id/reschedule")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_RECEPTION);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    const updated = await receptionRescheduleProcedure(
      id,
      new Date(body.scheduledAt),
      { userId: session!.sub, canOverrideCheckIn: false },
      { resourceId: body.resourceId, allowOtherDay: body.allowOtherDay },
    );
    void evaluateAndPublishCapacity().catch(() => null);
    return updated;
  
        });
  }
}
