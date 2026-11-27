import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { handleRouteError, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { completeProcedureOrder } from "@/domain/procedure/procedure-completion.service";
import { mapAttendanceHttpStatus, ProcedureAttendanceError } from "@/domain/procedure/procedure-attendance.service";

@Controller()
export class ProceduresIdCompleteController {

  @UseGuards(ClinicApiGuard)
  @Post("api/procedures/:id/complete")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_COMPLETE);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const body = ((httpReq.body ?? {})) as {
      consumableLines?: Array<{ sku: string; qty: number; description?: string }>;
      amountNet?: number;
      confirmOverQuota?: boolean;
    };

    const result = await completeProcedureOrder(
      id,
      { userId: session!.sub, canOverrideCheckIn: false },
      body,
    );
    return result;
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (err instanceof ProcedureAttendanceError) {
      throw new HttpException({ error: err.message, ...{ code: err.code } }, mapAttendanceHttpStatus(err));
    }
    if (err instanceof Error && err.message.includes("quota exceeded")) {
      throw new HttpException({ error: err.message }, 409);
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
