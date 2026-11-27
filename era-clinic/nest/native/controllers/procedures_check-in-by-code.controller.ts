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
import { findScheduledProcedureByAccessCode } from "@/domain/procedure/procedure-order.service";
import { requestOrganizationId } from "@/lib/request-organization";


const ACCESS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ACCESS_CODE_RE = new RegExp(`^[${ACCESS_CODE_ALPHABET}]{5}$`);

const schema = z.object({
  code: z
    .string()
    .trim()
    .length(5)
    .refine((v) => ACCESS_CODE_RE.test(v.toUpperCase()), {
      message: "Invalid access code format",
    }),
});

@Controller()
export class ProceduresCheckInByCodeController {

  @UseGuards(ClinicApiGuard)
  @Post("api/procedures/check-in-by-code")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_CHECK_IN);
    if (denied) return clinicBody(denied);

    const { code } = schema.parse(httpReq.body);
    const normalized = code.toUpperCase();
    const organizationId = requestOrganizationId();

    const order = await findScheduledProcedureByAccessCode(organizationId, normalized);
    if (!order) {
      throw new HttpException({ error: "Procedure not found" }, 404);
    }

    const canOverride = sessionHasClinicPermission(session!, CLINIC_PERMISSION.SCREEN_DOCTOR);

    const updated = await checkInProcedureOrder(
      order.id,
      { userId: session!.sub, canOverrideCheckIn: canOverride },
      { accessCode: normalized },
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
