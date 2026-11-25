/** Lifted from nest/generated/receipts__id_apply-promo.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { receiptPromoDenied } from "@/lib/receipt-status-gates";
import { resolvePromo } from "@/lib/receipt-promo";
import { applyPromoToReceipt, getReceiptWithLines } from "@/lib/receipt.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  promoCode: z.string().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
});


@Controller()
export class ReceiptsIdApplyPromoController {
  @Post("api/receipts/:id/apply-promo")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const receipt = await getReceiptWithLines(id);
    if (!receipt) return sendJson(httpRes, { error: "Receipt not found" }, 404);
    const promoDenied = receiptPromoDenied(receipt.status);
    if (promoDenied) return sendJson(httpRes, { error: promoDenied }, 400);

    const subtotal = Number(receipt.subtotalAmount) || receipt.lines
      .filter((l) => l.lineStatus === "ACTIVE")
      .reduce((s, l) => s + Number(l.lineTotal), 0);

    const promo = resolvePromo(body, subtotal);

    const updated = await applyPromoToReceipt(id, {
      subtotal,
      promoCode: promo.promoCode,
      discountPercent: promo.discountPercent,
      discountAmount: promo.discountAmount,
      amountNet: promo.amountNet,
    });
    return sendJson(httpRes, updated);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
