import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission, sessionHasClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { checkInProcedureOrder, mapAttendanceHttpStatus, ProcedureAttendanceError } from "@/domain/procedure/procedure-attendance.service";
import { getClinicSettings } from "@/domain/settings/settings.service";


const schema = z.object({
  qrToken: z.string().min(8).optional(),
  overrideReason: z.string().min(3).max(500).optional(),
  /** Matrix modal reception help path (tenant setting must allow it). */
  source: z.enum(["matrix"]).optional(),
});

@Controller()
export class ProceduresIdCheckInController {

  @UseGuards(ClinicApiGuard)
  @Post("api/procedures/:id/check-in")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
    if (!session) {
      throw new HttpException({ error: "Unauthorized" }, 401);
    }

    const { id } = httpReq.params;
    const body = schema.parse((httpReq.body ?? {}));
    const settings = await getClinicSettings();
    const matrixPath = body.source === "matrix";

    let canOverride = false;
    let overrideReason = body.overrideReason?.trim() || undefined;

    if (matrixPath) {
      const denied = await requireClinicPermission(
        session,
        CLINIC_PERMISSION.API_PROCEDURES_RECEPTION,
      );
      if (denied) return clinicBody(denied);
      if (settings.receptionProcedureCheckIn !== true) {
        throw new HttpException({ error: "Reception check-in is turned off", ...{
          code: "RECEPTION_CHECK_IN_DISABLED",
        } }, 403);
      }
      canOverride = true;
      if (!overrideReason && !body.qrToken) {
        overrideReason = "Reception matrix check-in";
      }
    } else {
      const denied = await requireClinicPermission(
        session,
        CLINIC_PERMISSION.API_PROCEDURES_CHECK_IN,
      );
      if (denied) return clinicBody(denied);
      canOverride = sessionHasClinicPermission(session, CLINIC_PERMISSION.SCREEN_DOCTOR);
    }

    const updated = await checkInProcedureOrder(
      id,
      { userId: session.sub, canOverrideCheckIn: canOverride },
      {
        qrToken: body.qrToken,
        overrideReason,
      },
    );
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
