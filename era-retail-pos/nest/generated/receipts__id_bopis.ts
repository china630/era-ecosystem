import { z } from "zod";
import { createBookingSlot, createShipment } from "@/integration/control-plane-platform.client";
import { requestOrganizationId } from "@/lib/request-organization";
import { getReceiptWithOutlet, markReceiptBopis } from "@/lib/receipt.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  pickupSlotKey: z.string().default("pickup"),
  customerPhone: z.string().max(32).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/receipts/:id/bopis", async (httpReq, httpRes) => {
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
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
