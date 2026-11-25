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
import { settleChargeLogLocally } from "@/domain/cashier/cashier-settle.service";


const bodySchema = z.object({
  shiftId: z.string().optional(),
  payments: z
    .array(
      z.object({
        method: z.string().min(1),
        amount: z.number().nonnegative(),
      }),
    )
    .optional(),
});

@Controller()
export class CashierOverQuotaIdSettleController {

  @UseGuards(ClinicApiGuard)
  @Post("api/cashier/over-quota/:id/settle")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const body = bodySchema.parse((httpReq.body ?? {}));
    const result = await settleChargeLogLocally({
      chargeLogId: id,
      shiftId: body.shiftId,
      payments: body.payments,
      userId: session?.sub ?? null,
    });
    return result;
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (err instanceof Error) {
      if (err.message.includes("not found")) throw new HttpException({ error: err.message }, 404);
      throw new HttpException({ error: err.message }, 400);
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
