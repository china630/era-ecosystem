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
import { previewWordForOrder } from "@/domain/lab/blank-apply";
import { findLabOrderPayGateFields } from "@/domain/lab/lab-order-write.service";


const bodySchema = z.object({
  profileId: z.string().min(1).optional(),
  docxBase64: z.string().min(1),
});

@Controller()
export class LabOrdersIdBlankController {

  @UseGuards(ClinicApiGuard)
  @Post("api/lab-orders/:id/blank")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS_BLANK);
    if (denied) return clinicBody(denied);
    const { id } = httpReq.params;
    const order = await findLabOrderPayGateFields(id);
    if (!order) throw new HttpException({ error: "Order not found" }, 404);
    const { labAwaitingPaymentDenied } = await import("@/domain/lab/lab-order-pay-gate");
    // Staff Word import is lab work. Guest print stays on labOrderVisibleToGuestWhere until settledAt.
    const unpaid = labAwaitingPaymentDenied(order);
    if (unpaid) throw new HttpException({ error: unpaid.message, ...{ code: unpaid.code } }, unpaid.status);
    const body = bodySchema.parse(httpReq.body);
    const docx = Buffer.from(body.docxBase64, "base64");
    if (docx.length < 4) throw new HttpException({ error: "Empty file" }, 400);
    const preview = await previewWordForOrder({
      orderId: id,
      docx,
      profileId: body.profileId,
    });
    if (!preview) throw new HttpException({ error: "Order not found" }, 404);
    if (preview.mode === "missing") throw new HttpException({ error: "No Word blank for this panel", ...{ code: "NO_BLANK" } }, 404);
    if (preview.mode === "fields" && Object.keys(preview.fields).length === 0) {
      throw new HttpException({ error: "No panel fields in this file", ...{ code: "NO_USM_FIELDS" } }, 422);
    }
    return preview;
  
        });
  }
}
