import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { handleRouteError, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { cancelProcedureOrder, mapAttendanceHttpStatus, ProcedureAttendanceError } from "@/domain/procedure/procedure-attendance.service";
import { evaluateAndPublishCapacity } from "@/lib/capacity.service";
import { getProcedureOrderSummary } from "@/domain/procedure/procedure-order.service";
import { cancelPaidExtraWithFolioReverse, cancelUnpaidExtra } from "@/domain/sanatorium/extras-assign.service";
import { PackageAssignError } from "@/domain/sanatorium/package-assign.service";


const schema = z.object({
  reason: z.string().max(500).optional(),
});

@Controller()
export class ProceduresIdCancelController {

  @UseGuards(ClinicApiGuard)
  @Post("api/procedures/:id/cancel")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_RECEPTION);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const body = schema.parse((httpReq.body ?? {}));
    const existing = await getProcedureOrderSummary(id);
    if (existing?.status === "PENDING_PAY" && existing.inPackage === false) {
      await cancelUnpaidExtra(id, session!.sub);
      void evaluateAndPublishCapacity().catch(() => null);
      return { ok: true, status: "CANCELLED" };
    }
    if (
      existing &&
      existing.inPackage === false &&
      existing.extraTicketIssuedAt &&
      (existing.status === "SCHEDULED" || existing.status === "PROPOSED")
    ) {
      const reversed = await cancelPaidExtraWithFolioReverse(id, session!.sub);
      void evaluateAndPublishCapacity().catch(() => null);
      return { ok: true, status: "CANCELLED", ...reversed };
    }

    const updated = await cancelProcedureOrder(
      id,
      { userId: session!.sub, canOverrideCheckIn: false },
      body.reason,
    );
    void evaluateAndPublishCapacity().catch(() => null);
    return updated;
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (err instanceof ProcedureAttendanceError) {
      throw new HttpException({ error: err.message, ...{ code: err.code } }, mapAttendanceHttpStatus(err));
    }
    if (err instanceof PackageAssignError) {
      throw new HttpException({ error: err.message, ...{ code: err.code } }, err.status);
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
