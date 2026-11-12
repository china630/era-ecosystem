import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { carryDepositRemainder, payoutDepositRemainder } from '@/lib/services/folio-deposit.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  depositId: z.string().uuid(),
  action: z.enum(['payout', 'carry']),
  paymentMethod: z.enum(['CASH', 'CARD']).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/reservations/:id/deposits/settle", async (httpReq, httpRes) => {
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
    const body = bodySchema.parse(httpReq.body);
    const audit = { userId: session?.sub, request };
    if (body.action === 'carry') {
      return sendJson(httpRes, serialize(await carryDepositRemainder(body.depositId, audit)));
    }
    if (!body.paymentMethod) {
      throw new Error('Payout needs cash or card');
    }
    return sendJson(httpRes, 
      serialize(
        await payoutDepositRemainder(
          body.depositId,
          body.paymentMethod,
          body.bankTerminalId,
          audit,
        ),
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
