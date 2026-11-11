import { z } from "zod";
import { receiptPromoDenied } from "@/lib/receipt-status-gates";
import { resolvePromo } from "@/lib/receipt-promo";
import { applyPromoToReceipt, getReceiptWithLines } from "@/lib/receipt.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  promoCode: z.string().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/receipts/:id/apply-promo", async (httpReq, httpRes) => {
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
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
