import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { payGuestDebt } from '@/lib/services/folio.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER']),
  bankTerminalId: z.string().uuid().optional().nullable(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/front-cash/guest-debt/:id/pay", async (httpReq, httpRes) => {
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
    return sendJson(httpRes, 
      serialize(
        await payGuestDebt({
          entryId: id,
          amount: body.amount,
          paymentMethod: body.paymentMethod,
          bankTerminalId: body.bankTerminalId,
          createdByUserId: session?.sub,
          auditRequest: request,
        }),
      ),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
