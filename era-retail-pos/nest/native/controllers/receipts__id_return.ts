/** Lifted from nest/generated/receipts__id_return.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
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
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  reason: z.string().optional(),
});


@Controller()
export class ReceiptsIdReturnController {
  @Post("api/receipts/:id/return")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
