import { z } from "zod";
import { SATELLITE_RETAIL_SALE_COMPLETED } from "@era/contracts";
import { assertRevenueEventForPublish } from "@era/satellite-kit";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { isRetailPreset } from "@/lib/retail-preset";
import { enterRequestTenant } from "@/lib/request-organization";
import { getPrescriptionQueueForSettlement, markPrescriptionQueueReadyFromHub } from "@/lib/prescription-queue.service";
import { getReceiptForHubSettlement, settleReceiptFromHub, updateReceiptHubPendingIds } from "@/lib/receipt.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  pendingId: z.string().min(1),
  sourceRef: z.string().min(1),
  paymentMethod: z.string().optional(),
  fiscalReceiptId: z.string().nullable().optional(),
  organizationId: z.string().min(1),
});

function verifyBridge(request: Request): boolean {
  const secret = process.env.POS_BRIDGE_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("x-pos-bridge-secret");
  const auth = request.headers.get("authorization");
  if (header === secret) return true;
  if (auth?.startsWith("Bearer ") && auth.slice(7) === secret) return true;
  return false;
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integration/settlement-confirmed", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!verifyBridge(request)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = bodySchema.parse(httpReq.body);
    enterRequestTenant(body.organizationId);

    const receipt = await getReceiptForHubSettlement(body.sourceRef);
    if (!receipt) {
      const queued = await getPrescriptionQueueForSettlement(body.sourceRef);
      if (!queued) return sendJson(httpRes, { error: "Receipt not found" }, 404);
      if (queued.status === "AWAITING_PAY") {
        await markPrescriptionQueueReadyFromHub(queued.id);
      }
      return sendJson(httpRes, {
        ok: true,
        prescriptionId: queued.id,
        status: queued.status === "AWAITING_PAY" ? "READY" : queued.status,
      });
    }
    if (receipt.status === "PAID") return sendJson(httpRes, { ok: true, alreadySettled: true });
    if (receipt.status === "VOID") return sendJson(httpRes, { error: "Receipt is void" }, 409);

    const storedPendingIds = receipt.hubPendingIds?.trim() ?? "";
    if (storedPendingIds.startsWith("[")) {
      const parsed = JSON.parse(storedPendingIds) as unknown;
      const ids = Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [];
      const left = ids.filter((id) => id !== body.pendingId);
      if (left.length > 0) {
        await updateReceiptHubPendingIds(receipt.id, JSON.stringify(left));
        return sendJson(httpRes, { ok: true, waiting: left.length });
      }
    }

    // Fail-closed before PAID — hub settle still emits retail sale to Finance.
    await assertRevenueEventForPublish({
      organizationId: body.organizationId,
      fromSatelliteKey: "industry_retail",
      eventType: SATELLITE_RETAIL_SALE_COMPLETED,
    });

    const paid = await settleReceiptFromHub(receipt.id, {
      paymentMethod: body.paymentMethod,
      fiscalNumber: body.fiscalReceiptId,
      existingPaymentMethod: receipt.paymentMethod,
      existingFiscalNumber: receipt.fiscalNumber,
    });

    const presetRaw = receipt.outlet.preset ?? "grocery";
    const preset = isRetailPreset(presetRaw) ? presetRaw : "grocery";
    await dispatchSatelliteEvent({
      type: SATELLITE_RETAIL_SALE_COMPLETED,
      payload: {
        outletId: receipt.outletId,
        registerId: receipt.registerId,
        shiftId: receipt.shiftId,
        receiptId: receipt.id,
        preset,
        amountNet: Number(receipt.amountNet),
        currency: "AZN",
        paymentMethod: paid.paymentMethod ?? body.paymentMethod ?? "CASH",
        lineCount: receipt.lines.length,
        customerPhone: receipt.customerPhone ?? undefined,
        loyaltyRef: receipt.loyaltyRef ?? undefined,
        promoCode: receipt.promoCode ?? undefined,
      },
    });

    return sendJson(httpRes, { ok: true, receiptId: receipt.id, settled: true });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
