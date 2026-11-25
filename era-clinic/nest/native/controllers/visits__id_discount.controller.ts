import { expressKitHeaders } from "../../express-kit-headers";
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
import { recordClinicAudit } from "@/lib/satellite-audit";
import { applyVisitDiscountTransaction, getVisitForWrite } from "@/domain/visit/visit.service";


const bodySchema = z.object({
  percent: z.number().min(0).max(100),
  reason: z.string().min(3),
});

@Controller()
export class VisitsIdDiscountController {

  @UseGuards(ClinicApiGuard)
  @Post("api/visits/:id/discount")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const visit = await getVisitForWrite(id);
    if (!visit) throw new HttpException({ error: "Visit not found" }, 404);
    if (visit.status === "COMPLETED") {
      throw new HttpException({ error: "Cannot discount a completed visit" }, 400);
    }

    const currentAmount = Number(visit.amountNet);
    const discountedAmount =
      Math.round(currentAmount * (1 - body.percent / 100) * 100) / 100;

    const [updatedVisit, audit] = await applyVisitDiscountTransaction({
      visitId: id,
      discountedAmount,
      percent: body.percent,
      approvedBy: session.sub,
      reason: body.reason,
    });

    await recordClinicAudit(
      { userId: session.sub, request: expressKitHeaders(httpReq) },
      "Visit",
      id,
      "DISCOUNT",
      {
        percent: body.percent,
        reason: body.reason,
        amountBefore: currentAmount,
        amountAfter: discountedAmount,
        domainAuditId: audit.id,
      },
    );

    return { visit: updatedVisit, audit };
  
        });
  }
}
