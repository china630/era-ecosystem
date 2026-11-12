import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { refundFolioPayment } from '@/lib/services/folio-refund.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().trim().min(1).max(500),
  paymentMethod: z.enum(['CASH', 'CARD']).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/folios/payments/:id/refund", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
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

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    const payment = await refundFolioPayment({
      paymentId: id,
      amount: body.amount,
      reason: body.reason,
      paymentMethod: body.paymentMethod,
      bankTerminalId: body.bankTerminalId,
      createdByUserId: session?.sub,
      auditRequest: request,
    });
    return sendJson(httpRes, serialize(payment), 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
