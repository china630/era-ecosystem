import { Controller, Delete, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertLabOrderDataScope } from "@/lib/auth/clinic-data-scope";
import { cancelLabOrder } from "@/domain/lab/lab-order-cancel.service";
import { findLabOrderDetail } from "@/domain/lab/lab-order-write.service";


const cancelSchema = z.object({
  reason: z.string().max(500).optional(),
});

/** Single lab order with items + structural results + patient ref, for the workflow detail page. */


/** Cancel an ORDERED lab order (sets CANCELLED + audit fields). */

@Controller()
export class LabOrdersIdController {

  @UseGuards(ClinicApiGuard)
  @Get("api/lab-orders/:id")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const scopeDenied = await assertLabOrderDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);
    const order = await findLabOrderDetail(id);
    if (!order) throw new HttpException({ error: "Lab order not found" }, 404);
    const { labAwaitingPaymentDenied } = await import("@/domain/lab/lab-order-pay-gate");
    const unpaid = labAwaitingPaymentDenied(order);
    if (unpaid) throw new HttpException({ error: unpaid.message, ...{ code: unpaid.code } }, unpaid.status);
    return order;
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Delete("api/lab-orders/:id")
  @HttpCode(200)
  async delete_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
    if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS_WRITE);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const scopeDenied = await assertLabOrderDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);
    let reason: string | undefined;
    try {
      const raw = typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "");
      if (raw.trim()) {
        reason = cancelSchema.parse(JSON.parse(raw)).reason;
      }
    } catch {
      /* optional body */
    }
    const order = await cancelLabOrder(id, {
      userId: session.sub,
      reason,
    });
    return order;
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (err instanceof Error && (err as { code?: string }).code === "NOT_FOUND") {
      throw new HttpException({ error: "Lab order not found" }, 404);
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
