/** Lifted from nest/generated/receipts__id_bopis.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { createBookingSlot, createShipment } from "@/integration/control-plane-platform.client";
import { requestOrganizationId } from "@/lib/request-organization";
import { getReceiptWithOutlet, markReceiptBopis } from "@/lib/receipt.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  pickupSlotKey: z.string().default("pickup"),
  customerPhone: z.string().max(32).optional(),
});


@Controller()
export class ReceiptsIdBopisController {
  @Post("api/receipts/:id/bopis")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const receipt = await getReceiptWithOutlet(id);
    if (!receipt) return sendJson(httpRes, { error: "Receipt not found" }, 404);
    if (receipt.status !== "OPEN") {
      return sendJson(httpRes, { error: "BOPIS only on OPEN receipt" }, 400);
    }

    const updated = await markReceiptBopis(id, {
      pickupSlotKey: body.pickupSlotKey,
      customerPhone: body.customerPhone?.trim() || receipt.customerPhone,
    });

    const organizationId = requestOrganizationId();
    try {
      await createBookingSlot(
        {
          resourceKey: body.pickupSlotKey,
          label: `Pickup ${receipt.id.slice(0, 8)}`,
          metadata: { receiptId: receipt.id },
        },
        { organizationId },
      );
    } catch {
      // optional CP booking
    }
    try {
      await createShipment(
        {
          sourceEntityType: "retail_receipt",
          sourceEntityId: receipt.id,
          externalRef: body.customerPhone ?? receipt.id,
          metadata: { fulfillmentType: "BOPIS" },
        },
        { organizationId },
      );
    } catch {
      // optional CP delivery
    }

    return sendJson(httpRes, updated);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
