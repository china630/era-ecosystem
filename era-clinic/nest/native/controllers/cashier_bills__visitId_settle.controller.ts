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
import { settleVisitBill } from "@/domain/cashier/cashier-settle.service";


const paySchema = z.object({
  shiftId: z.string().optional(),
  payments: z
    .array(
      z.object({
        method: z.string().min(1),
        amount: z.number().nonnegative(),
      }),
    )
    .optional(),
  extraDiscount: z.number().nonnegative().optional(),
  forceLocal: z.boolean().optional(),
  paymentMethod: z.string().optional(),
});

@Controller()
export class CashierBillsVisitIdSettleController {

  @UseGuards(ClinicApiGuard)
  @Post("api/cashier/bills/:visitId/settle")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return clinicBody(denied);

    const { visitId } = httpReq.params;
    const body = paySchema.parse(httpReq.body);

    let payments = body.payments;
    if (!payments && body.paymentMethod) {
      // amount filled inside settle as full amountNet via default CASH path;
      // pass single method by forcing default after peek — settle defaults CASH.
      payments = undefined;
    }

    const result = await settleVisitBill({
      visitId,
      shiftId: body.shiftId,
      payments,
      extraDiscount: body.extraDiscount,
      forceLocal: body.forceLocal,
      userId: session?.sub ?? null,
    });
    return result;
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (err instanceof Error) {
      if (err.message.includes("not found")) throw new HttpException({ error: err.message }, 404);
      if (
        err.message.includes("must equal") ||
        err.message.includes("No reservation") ||
        err.message.includes("Shift")
      ) {
        throw new HttpException({ error: err.message }, 400);
      }
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
