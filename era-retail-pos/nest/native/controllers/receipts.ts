/** Lifted from nest/generated/receipts.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { computeLineTotal, validateReceiptLines } from "@/lib/receipt-line-validation";
import { resolveOutletPreset } from "@/lib/retail-preset";
import { createReceiptFromLines, getShiftWithOutletForReceipt } from "@/lib/receipt.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const lineSchema = z.object({
  description: z.string(),
  qty: z.number().int().positive().default(1),
  unitPrice: z.number().nonnegative(),
  plu: z.string().optional(),
  barcode: z.string().optional(),
  isWeighted: z.boolean().optional(),
  weightKg: z.number().positive().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  serial: z.string().optional(),
  batch: z.string().optional(),
  rxRequired: z.boolean().optional(),
  rxApprovedBy: z.string().optional(),
});

const bodySchema = z.object({
  shiftId: z.string(),
  lines: z.array(lineSchema).min(1),
});


@Controller()
export class ReceiptsController {
  @Post("api/receipts")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = bodySchema.parse(httpReq.body);
    const shift = await getShiftWithOutletForReceipt(body.shiftId);
    if (!shift) return sendJson(httpRes, { error: "Shift not found" }, 404);
    if (shift.status !== "OPEN") return sendJson(httpRes, { error: "Shift is not open" }, 400);

    const preset = resolveOutletPreset(shift.register.outlet.preset);
    const validationError = validateReceiptLines(preset, body.lines);
    if (validationError) return sendJson(httpRes, { error: validationError }, 400);

    const subtotalAmount = body.lines.reduce(
      (sum, line) => sum + computeLineTotal(line),
      0,
    );

    const receipt = await createReceiptFromLines({
      outletId: shift.register.outletId,
      registerId: shift.registerId,
      shiftId: shift.id,
      subtotalAmount,
      lines: body.lines,
    });
    return sendJson(httpRes, receipt, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
