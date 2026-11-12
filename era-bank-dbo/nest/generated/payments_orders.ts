import { z } from "zod";
import { createPaymentSignRequest } from "@/lib/customer-session";
import { dboPaths, engineDboFetch, engineDboJson } from "@/lib/engine-dbo-client";
import { requireCustomerSession } from "@/lib/api-utils";
import { enterDboStaff, dboNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithDboTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  debitAccountId: z.string().min(1),
  beneficiaryIban: z.string().min(1),
  beneficiaryName: z.string().min(1),
  purpose: z.string().optional(),
  amountMinor: z.number().int().positive(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/payments/orders", async (httpReq, httpRes) => {
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

  
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;

    const data = await engineDboFetch(dboPaths.paymentOrders, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return sendJson(httpRes, data);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/payments/orders", async (httpReq, httpRes) => {
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

  
    const body = createSchema.parse(httpReq.body);
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;

    const idempotencyKey = request.headers.get("idempotency-key") ?? crypto.randomUUID();
    const data = await engineDboJson<{ order?: { id: string }; id?: string }>(
      "POST",
      dboPaths.paymentOrders,
      body,
      {
        customerJwt: auth.session.customerJwt ?? undefined,
        idempotencyKey,
      },
    );

    const engineOrderId = data.order?.id ?? data.id;
    if (engineOrderId && auth.session.channel === "CORPORATE") {
      await createPaymentSignRequest({
        engineOrderId,
        customerId: auth.session.customerId,
        requestedBySessionId: auth.session.id,
      });
    }

    return sendJson(httpRes, data);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
