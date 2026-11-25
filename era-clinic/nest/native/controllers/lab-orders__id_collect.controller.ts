import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertLabOrderDataScope } from "@/lib/auth/clinic-data-scope";
import { collectLabOrder, findLabOrderWithPatientVisit } from "@/domain/lab/lab-order-write.service";

@Controller()
export class LabOrdersIdCollectController {

  @UseGuards(ClinicApiGuard)
  @Post("api/lab-orders/:id/collect")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS_COLLECT);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const scopeDenied = await assertLabOrderDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);
    const order = await findLabOrderWithPatientVisit(id);
    if (!order) throw new HttpException({ error: "Lab order not found" }, 404);
    const { labAwaitingPaymentDenied } = await import("@/domain/lab/lab-order-pay-gate");
    const unpaid = labAwaitingPaymentDenied(order);
    if (unpaid) throw new HttpException({ error: unpaid.message, ...{ code: unpaid.code } }, unpaid.status);
    if (order.status !== "ORDERED") {
      throw new HttpException({ error: `Cannot collect from status ${order.status}` }, 400);
    }

    const collected = await collectLabOrder(id);
    return collected;
  
        });
  }
}
