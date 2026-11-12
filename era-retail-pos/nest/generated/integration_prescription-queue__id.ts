import { z } from "zod";
import { refundPrescriptionSale, ringPrescriptionSale, settlePrescription } from "@/lib/prescription-sale";
import { getPrescriptionQueueById, markPrescriptionQueueDispensed, markPrescriptionQueueReady, markPrescriptionQueueReturned } from "@/lib/prescription-queue.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const actionSchema = z.object({
  action: z.enum(["paid", "dispense", "return"]),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integration/prescription-queue/:id", async (httpReq, httpRes) => {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {
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
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
