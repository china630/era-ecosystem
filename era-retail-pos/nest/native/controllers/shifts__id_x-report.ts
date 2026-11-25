/** Lifted from nest/generated/shifts__id_x-report.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { getShiftForXReport } from "@/lib/shift.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ShiftsIdXReportController {
  @Get("api/shifts/:id/x-report")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    const shift = await getShiftForXReport(id);
    if (!shift) return sendJson(httpRes, { error: "Shift not found" }, 404);

    const totalSales = shift.receipts.reduce(
      (sum, r) => sum + Number(r.amountNet),
      0,
    );

    return sendJson(httpRes, {
      shiftId: shift.id,
      status: shift.status,
      outletCode: shift.register.outlet.code,
      registerCode: shift.register.code,
      openedAt: shift.openedAt,
      paidReceiptCount: shift.receipts.length,
      totalSales,
      currency: "AZN",
      reportType: "X",
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
