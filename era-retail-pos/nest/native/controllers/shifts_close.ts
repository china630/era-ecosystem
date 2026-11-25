/** Lifted from nest/generated/shifts_close.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { SATELLITE_RETAIL_SHIFT_CLOSED } from "@era/contracts";
import { assertRevenueEventForPublish } from "@era/satellite-kit";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { requestOrganizationId } from "@/lib/request-organization";
import { resolveOutletPreset } from "@/lib/retail-preset";
import { closeShiftById, getShiftForClose } from "@/lib/shift.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  shiftId: z.string(),
});


@Controller()
export class ShiftsCloseController {
  @Post("api/shifts/close")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = bodySchema.parse(httpReq.body);
    const shift = await getShiftForClose(body.shiftId);
    if (!shift) return sendJson(httpRes, { error: "Shift not found" }, 404);
    if (shift.status === "CLOSED") return sendJson(httpRes, shift);

    // Fail-closed before Z-close (sibling of F&B SATELLITE_FB_SHIFT_CLOSED).
    await assertRevenueEventForPublish({
      organizationId: requestOrganizationId(),
      fromSatelliteKey: "industry_retail",
      eventType: SATELLITE_RETAIL_SHIFT_CLOSED,
    });

    const closed = await closeShiftById(shift.id);

    const totalSales = shift.receipts.reduce(
      (sum, receipt) => sum + Number(receipt.amountNet),
      0,
    );
    const receiptCount = shift.receipts.length;
    const preset = resolveOutletPreset(shift.register.outlet.preset);

    await dispatchSatelliteEvent({
      type: SATELLITE_RETAIL_SHIFT_CLOSED,
      payload: {
        outletId: shift.register.outletId,
        registerId: shift.registerId,
        shiftId: shift.id,
        preset,
        totalSales,
        receiptCount: shift.receipts.length,
        currency: "AZN",
      },
    });

    return sendJson(httpRes, { ...closed, totalSales, receiptCount });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
