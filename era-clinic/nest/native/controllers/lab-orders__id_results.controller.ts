import { Controller, HttpCode, Post, Req, Res, UseGuards, HttpException } from "@nestjs/common";
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
import { findLabOrderById, writeLabResultsForOrder } from "@/domain/lab/lab-order-write.service";
import { labResultsDenied, labResultsPreservePublication } from "@/lib/lab-order-status-gates";


const bodySchema = z.object({
  lines: z
    .array(
      z.object({
        code: z.string(),
        value: z.string(),
        unit: z.string().optional(),
        refMin: z.string().optional(),
        refMax: z.string().optional(),
        normTextEn: z.string().optional(),
        normTextRu: z.string().optional(),
        normTextAz: z.string().optional(),
        boundKind: z
          .enum(["INTERVAL", "UPPER_ONLY", "LOWER_ONLY", "QUALITATIVE", "ZONES"])
          .optional(),
        flag: z.enum(["NORMAL", "HIGH", "LOW", "CRITICAL"]).optional(),
      }),
    )
    .min(1),
});

@Controller()
export class LabOrdersIdResultsController {

  @UseGuards(ClinicApiGuard)
  @Post("api/lab-orders/:id/results")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS_WRITE);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const scopeDenied = await assertLabOrderDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);
    const body = bodySchema.parse(httpReq.body);
    const order = await findLabOrderById(id);
    if (!order) throw new HttpException({ error: "Lab order not found" }, 404);
    const { labAwaitingPaymentDenied } = await import("@/domain/lab/lab-order-pay-gate");
    const unpaid = labAwaitingPaymentDenied(order);
    if (unpaid) throw new HttpException({ error: unpaid.message, ...{ code: unpaid.code } }, unpaid.status);
    const statusDenied = labResultsDenied(order.status);
    if (statusDenied) {
      throw new HttpException({ error: statusDenied }, 400);
    }

    const result = await writeLabResultsForOrder(id, body.lines, {
      preservePublication: labResultsPreservePublication(order.status),
    });
    if (!result) throw new HttpException({ error: "Lab order not found" }, 404);

    return {
      ...result.order,
      hasCritical: result.hasCritical,
      resultLines: result.enrichedLines,
    };
  
        });
  }
}
