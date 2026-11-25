/** Lifted from nest/generated/shifts_close.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { assertFbRevenueChannel, dispatchFbShiftClosed } from "@/lib/fb-finance-events";
import { SATELLITE_FB_SHIFT_CLOSED } from "@era/contracts";
import { reportPosShiftStatus } from "@/lib/pms-bridge-client";
import { countOpenHeldTicketsOnOutlet, finalizePosShiftClose, resolvePosShiftForOps, revokeOutletTerminal } from "@/lib/shift.service";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { saleReportForShift } from "@/lib/sales-report";
import { cashDrawerForShift } from "@/lib/cash-drawer";
import { recordFbAudit } from "@/lib/satellite-audit";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const closeSchema = z.object({
  shiftId: z.string().optional(),
  countedCash: z.number().nonnegative(),
});


@Controller()
export class ShiftsCloseController {
  @Post("api/shifts/close")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.SHIFTS_CLOSE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const parsed = closeSchema.safeParse((httpReq.body ?? {}));
    if (!parsed.success) return sendJson(httpRes, { error: "Counted cash is required" }, 400);
    const body = parsed.data;

    const shift = await resolvePosShiftForOps(body.shiftId);

    if (!shift) {
      return sendJson(httpRes, { error: "Open shift not found" }, 404);
    }
    if (shift.status === "CLOSED") {
      await reportPosShiftStatus({
        outletCode: shift.outlet.code,
        status: "CLOSED",
        shiftId: shift.id,
        closedAt: shift.closedAt?.toISOString(),
      });
      return sendJson(httpRes, shift);
    }

    const openTickets = await countOpenHeldTicketsOnOutlet(shift.outletId);
    if (openTickets > 0) {
      return sendJson(httpRes, 
        { error: "Cannot Z-close with open tickets", openTickets }, 409);
    }

    const report = await saleReportForShift(shift.id);
    const closedAt = new Date();
    const drawer = await cashDrawerForShift({
      ...shift,
      closedAt,
      countedCash: body.countedCash,
    });

    // Fail-closed before Z-close: post-close void dispatch cannot reopen the shift.
    await assertFbRevenueChannel(SATELLITE_FB_SHIFT_CLOSED);

    const closed = await finalizePosShiftClose(shift.id, {
      closedAt,
      countedCash: body.countedCash,
      expectedCash: drawer.expected,
      cashVariance: drawer.variance,
    });

    await reportPosShiftStatus({
      outletCode: shift.outlet.code,
      status: "CLOSED",
      shiftId: shift.id,
      closedAt: closed.closedAt?.toISOString(),
    });

    if (closed.closedAt) {
      await revokeOutletTerminal(closed.outletId, closed.closedAt);
      void dispatchFbShiftClosed({
        shiftId: closed.id,
        outletId: closed.outletId,
        outletCode: closed.outlet.code,
        openedAt: closed.openedAt,
        closedAt: closed.closedAt,
      }).catch(() => {
        // Shift already closed; Finance recon is best-effort
      });
    }

    await recordFbAudit(
      { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
      "PosShift",
      closed.id,
      "CLOSE",
      {
        outletId: closed.outletId,
        outletCode: closed.outlet.code,
        countedCash: body.countedCash,
        expectedCash: drawer.expected,
        cashVariance: drawer.variance,
      },
    );

    return sendJson(httpRes, { ...closed, report, drawer });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
