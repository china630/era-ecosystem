import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import {
  handleRouteError,
  requireClinicPermission,
  sessionHasClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  attendanceErrorBody,
  checkInProcedureOrder,
  mapAttendanceHttpStatus,
  ProcedureAttendanceError,
} from "@/domain/procedure/procedure-attendance.service";


/** Legacy alias → check-in (requires QR or override). */
const schema = z.object({
  qrToken: z.string().min(8).optional(),
  overrideReason: z.string().min(3).max(500).optional(),
});

@Controller()
export class ProceduresIdStartController {

  @UseGuards(ClinicApiGuard)
  @Post("api/procedures/:id/start")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_CHECK_IN);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const body = schema.parse((httpReq.body ?? {}));
    const canOverride = sessionHasClinicPermission(session!, CLINIC_PERMISSION.SCREEN_DOCTOR);

    const updated = await checkInProcedureOrder(
      id,
      { userId: session!.sub, canOverrideCheckIn: canOverride },
      body,
    );
    return updated;
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (err instanceof ProcedureAttendanceError) {
      throw new HttpException(attendanceErrorBody(err), mapAttendanceHttpStatus(err));
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
