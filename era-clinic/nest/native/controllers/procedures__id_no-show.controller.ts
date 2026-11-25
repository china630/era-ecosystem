import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { markProcedureNoShow, mapAttendanceHttpStatus, ProcedureAttendanceError } from "@/domain/procedure/procedure-attendance.service";
import { evaluateAndPublishCapacity } from "@/lib/capacity.service";


const schema = z.object({
  reason: z.string().max(500).optional(),
});

@Controller()
export class ProceduresIdNoShowController {

  @UseGuards(ClinicApiGuard)
  @Post("api/procedures/:id/no-show")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_NO_SHOW);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    await schema.parseAsync((httpReq.body ?? {}));

    const updated = await markProcedureNoShow(id, {
      userId: session!.sub,
      canOverrideCheckIn: false,
    });
    void evaluateAndPublishCapacity().catch(() => null);
    return updated;
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (err instanceof ProcedureAttendanceError) {
      throw new HttpException({ error: err.message, ...{ code: err.code } }, mapAttendanceHttpStatus(err));
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
