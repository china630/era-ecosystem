import { z } from "zod";
import { SATELLITE_RETAIL_SHIFT_CLOSED } from "@era/contracts";
import { assertRevenueEventForPublish } from "@era/satellite-kit";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { requestOrganizationId } from "@/lib/request-organization";
import { resolveOutletPreset } from "@/lib/retail-preset";
import { closeShiftById, getShiftForClose } from "@/lib/shift.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  shiftId: z.string(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/shifts/close", async (httpReq, httpRes) => {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
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
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
