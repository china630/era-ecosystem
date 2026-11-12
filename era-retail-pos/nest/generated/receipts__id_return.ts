import { type ReceiptLine } from "@prisma/client";
import { z } from "zod";
import { SATELLITE_RETAIL_SALE_COMPLETED } from "@era/contracts";
import { assertRevenueEventForPublish, departmentFinanceEventsSilenced } from "@era/satellite-kit";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { postHotelSettlementPending, postRoomCharge } from "@/lib/pms-bridge-client";
import { revenueCodeForSaleLine } from "@/lib/revenue-code";
import { requestOrganizationId } from "@/lib/request-organization";
import { resolveOutletPreset } from "@/lib/retail-preset";
import { createReturnReceipt, getPaidReceiptForReturn } from "@/lib/receipt.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  reason: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/receipts/:id/return", async (httpReq, httpRes) => {
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
    bodySchema.parse((httpReq.body ?? {}));

    const original = await getPaidReceiptForReturn(id);
    if (!original) return sendJson(httpRes, { error: "Receipt not found" }, 404);
    if (original.status !== "PAID") {
      return sendJson(httpRes, { error: "Only paid receipts can be returned" }, 400);
    }
    if (original.shift.status !== "OPEN") {
      return sendJson(httpRes, { error: "Shift must be open to process a return" }, 400);
    }

    const amountNet = -Number(original.amountNet);
    const preset = resolveOutletPreset(original.outlet.preset);
    const orgId = requestOrganizationId();
    const dayDocSilenced =
      Boolean(orgId) && (await departmentFinanceEventsSilenced(orgId));
    // Local return → Finance: assert before creating the PAID return receipt.
    if (!dayDocSilenced) {
      await assertRevenueEventForPublish({
        organizationId: orgId,
        fromSatelliteKey: "industry_retail",
        eventType: SATELLITE_RETAIL_SALE_COMPLETED,
      });
    }

    const returnReceipt = await createReturnReceipt({
      outletId: original.outletId,
      registerId: original.registerId,
      shiftId: original.shiftId,
      amountNet,
      paymentMethod: original.paymentMethod,
      originalReceiptId: original.id,
      lines: original.lines,
    });

    if (dayDocSilenced) {
      const lines = returnReceipt.lines.filter((line: ReceiptLine) => line.lineStatus === "ACTIVE");
      for (const line of lines) {
        const sku = line.plu?.trim();
        if (!sku) return sendJson(httpRes, { error: `Finance SKU is required for ${line.description}` }, 400);
        const revenueCode = await revenueCodeForSaleLine({
          plu: sku,
          outletRevenueCode: original.outlet.revenueCode,
        });
        const { retailRoomReturnRef, retailReturnLineRef } = await import(
          "@era/satellite-kit/integration/folio-charge-ref"
        );
        if (original.reservationId || original.roomNumber) {
          const roomKey = retailRoomReturnRef(returnReceipt.id, line.id);
          const charge = await postRoomCharge(
            {
              reservationId: original.reservationId ?? undefined,
              roomNumber: original.roomNumber ?? undefined,
              revenueCode,
              amount: Number(line.lineTotal),
              qty: line.qty,
              productSku: sku,
              description: line.description,
              outletCode: original.outlet.code,
              externalTicketId: roomKey,
            },
            roomKey,
          );
          if (!charge.ok) {
            return sendJson(httpRes, { error: `Hotel folio return failed: ${charge.status}` }, 502);
          }
        } else {
          await postHotelSettlementPending({
            sourceRef: returnReceipt.id,
            amount: Number(line.lineTotal),
            description: line.description,
            payerLabel: original.outlet.code,
            idempotencyKey: retailReturnLineRef(returnReceipt.id, line.id),
            sku,
            qty: line.qty,
            revenueCode,
          });
        }
      }
      return sendJson(httpRes, { originalReceiptId: original.id, returnReceipt }, 201);
    }

    await dispatchSatelliteEvent({
      type: SATELLITE_RETAIL_SALE_COMPLETED,
      payload: {
        outletId: returnReceipt.outletId,
        registerId: returnReceipt.registerId,
        shiftId: returnReceipt.shiftId,
        receiptId: returnReceipt.id,
        originalReceiptId: original.id,
        preset,
        amountNet,
        currency: "AZN",
        paymentMethod: returnReceipt.paymentMethod ?? "return",
        lineCount: returnReceipt.lines.length,
        isReturn: true,
      },
    });

    return sendJson(httpRes, { originalReceiptId: original.id, returnReceipt }, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
