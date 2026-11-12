import { z } from "zod";
import { computeLineTotal, validateReceiptLines } from "@/lib/receipt-line-validation";
import { resolveOutletPreset } from "@/lib/retail-preset";
import { createReceiptFromLines, getShiftWithOutletForReceipt } from "@/lib/receipt.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

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

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/receipts", async (httpReq, httpRes) => {
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
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
