/** Lifted from nest/generated/integration_prescription-queue__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { refundPrescriptionSale, ringPrescriptionSale, settlePrescription } from "@/lib/prescription-sale";
import { getPrescriptionQueueById, markPrescriptionQueueDispensed, markPrescriptionQueueReady, markPrescriptionQueueReturned } from "@/lib/prescription-queue.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const actionSchema = z.object({
  action: z.enum(["paid", "dispense", "return"]),
});


@Controller()
export class IntegrationPrescriptionQueueIdController {
  @Post("api/integration/prescription-queue/:id")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    const body = actionSchema.parse(httpReq.body);
    const row = await getPrescriptionQueueById(id);
    if (!row) return sendJson(httpRes, { error: "Prescription not found" }, 404);

    if (body.action === "paid") {
      if (row.status !== "AWAITING_PAY") return sendJson(httpRes, { error: "Payment already recorded" }, 409);
      await settlePrescription(row);
      if (!row.reservationId) {
        return sendJson(httpRes, { id, status: row.status, waitingForHotel: true });
      }
      const updated = await markPrescriptionQueueReady(id);
      return sendJson(httpRes, { id, status: updated.status });
    }

    if (body.action === "dispense") {
      if (row.status !== "READY") {
        return sendJson(httpRes, { error: "Dispense only after payment" }, 409);
      }
      const receiptId = await ringPrescriptionSale(row);
      const updated = await markPrescriptionQueueDispensed(id, receiptId);
      return sendJson(httpRes, { id, status: updated.status, receiptId, lines: JSON.parse(row.linesJson) });
    }

    if (row.status !== "DISPENSED") {
      return sendJson(httpRes, { error: "Return the goods before refunding money" }, 409);
    }
    await refundPrescriptionSale(row);
    const updated = await markPrescriptionQueueReturned(id);
    const money = row.reservationId ? "FOLIO" : "CASHIER";
    return sendJson(httpRes, { id, status: updated.status, refundChannel: money });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
