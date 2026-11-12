import { NextResponse } from "next/server";
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
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const closeSchema = z.object({
  shiftId: z.string().optional(),
  countedCash: z.number().nonnegative(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/shifts/close", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const denied = denyUnlessPermission(session, PERMISSIONS.SHIFTS_CLOSE);
    if (denied) return denied;

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
      { userId: session?.sub, request },
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
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
