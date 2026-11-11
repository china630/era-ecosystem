import { z } from "zod";
import { findPaymentSignRequestByEngineOrder, markSignRequestSigned } from "@/lib/customer-session";
import { dboPaths, engineDboJson } from "@/lib/engine-dbo-client";
import { requireCustomerSession } from "@/lib/api-utils";
import { enterDboStaff, dboNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithDboTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  asanTransactionId: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/payments/orders/:id/sign", async (httpReq, httpRes) => {
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

  
    const { id } = httpReq.params;
    const body = schema.parse((httpReq.body ?? {}));
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;

    const data = await engineDboJson("POST", dboPaths.paymentOrderSign(id), body, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });

    const signRequest = await findPaymentSignRequestByEngineOrder(id);
    if (signRequest && signRequest.status === "PENDING") {
      await markSignRequestSigned({
        id: signRequest.id,
        signedBySessionId: auth.session.id,
        asanTransactionId: body.asanTransactionId,
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
