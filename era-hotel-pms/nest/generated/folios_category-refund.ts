import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { PAYMENT_CATEGORIES } from '@/lib/payment-category';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  reservationId: z.string().uuid(),
  paymentCategory: z.enum(PAYMENT_CATEGORIES),
  amount: z.number().positive(),
  reason: z.string().trim().min(1).max(500),
  paymentMethod: z.enum(['CASH', 'CARD']).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
  folioType: z.enum(['GUEST', 'AGENCY', 'COMPANY']).optional(),
  reservationGuestId: z.string().uuid().optional(),
});

/** Mid-stay return of unused credit in one cashier category on one pocket. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/folios/category-refund", async (httpReq, httpRes) => {
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
    const body = schema.parse(httpReq.body);
    const { refundStayCategoryCredit } = await import('@/lib/services/booking-folio.service');
    const rows = await refundStayCategoryCredit({
      reservationId: body.reservationId,
      paymentCategory: body.paymentCategory,
      amount: body.amount,
      reason: body.reason,
      paymentMethod: body.paymentMethod,
      bankTerminalId: body.bankTerminalId,
      folioType: body.folioType,
      reservationGuestId: body.reservationGuestId,
      createdByUserId: session?.sub,
      auditRequest: request,
    });
    return sendJson(httpRes, serialize(rows), 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
