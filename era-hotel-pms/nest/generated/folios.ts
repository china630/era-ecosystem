import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { listFolios, postCharge, postPayment } from '@/lib/services/folio.service';
import { PAYMENT_CATEGORIES } from '@/lib/payment-category';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const chargeSchema = z.object({
  reservationId: z.string().uuid(),
  revenueCodeId: z.string().uuid(),
  amount: z.number(), // allow negative for DISCOUNT posts via API if needed
  qty: z.number().int().positive().optional(),
  description: z.string().min(1),
  folioType: z.enum(['GUEST', 'AGENCY', 'COMPANY']).optional(),
  reservationGuestId: z.string().uuid().optional(),
});

const paymentSchema = z
  .object({
    folioId: z.string().uuid().optional(),
    reservationId: z.string().uuid().optional(),
    revenueCodeId: z.string().uuid().optional(),
    paymentCategory: z.enum(PAYMENT_CATEGORIES).optional(),
    amount: z.number().positive(),
    paymentMethod: z.string().min(1).max(64),
    registerRef: z.string().optional(),
    bankReference: z.string().max(120).optional(),
    bankTerminalId: z.string().min(1).max(64).optional(),
    folioType: z.enum(['GUEST', 'AGENCY', 'COMPANY']).optional(),
    reservationGuestId: z.string().uuid().optional(),
    /** Explicit prepay / credit when the stay still has open debt on other articles. */
    allowCredit: z.boolean().optional(),
  })
  .refine((row) => Boolean(row.folioId || row.reservationId), {
    message: 'folioId or reservationId is required',
  })
  .refine((row) => Boolean(row.folioId || row.revenueCodeId || row.paymentCategory), {
    message: 'revenueCodeId or paymentCategory is required for stay payment',
  });

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/folios", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const reservationId = new URL(request.url).searchParams.get('reservationId') ?? undefined;
    return sendJson(httpRes, serialize(await listFolios(reservationId)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/folios", async (httpReq, httpRes) => {
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

  
    const body = httpReq.body;
    if (body.folioId || (body.reservationId && body.paymentMethod)) {
      assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
      const data = paymentSchema.parse(body);
      let folioId = data.folioId;
      if (!folioId && data.reservationId) {
        if (data.paymentCategory) {
          const { postStayCategoryPayment } = await import('@/lib/services/booking-folio.service');
          const payment = await postStayCategoryPayment({
            reservationId: data.reservationId,
            paymentCategory: data.paymentCategory,
            amount: data.amount,
            paymentMethod: data.paymentMethod,
            registerRef: data.registerRef,
            bankReference: data.bankReference,
            bankTerminalId: data.bankTerminalId,
            folioType: data.folioType,
            reservationGuestId: data.reservationGuestId,
            createdByUserId: session?.sub,
            auditRequest: request,
          });
          return sendJson(httpRes, serialize(payment), 201);
        }
        if (!data.revenueCodeId) throw new Error('Revenue code is required');
        const { postStayArticlePayment } = await import('@/lib/services/booking-folio.service');
        const payment = await postStayArticlePayment({
          reservationId: data.reservationId,
          revenueCodeId: data.revenueCodeId,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          registerRef: data.registerRef,
          bankReference: data.bankReference,
          bankTerminalId: data.bankTerminalId,
          explicit: data.folioType,
          reservationGuestId: data.reservationGuestId,
          allowCredit: data.allowCredit === true,
          createdByUserId: session?.sub,
          auditRequest: request,
        });
        return sendJson(httpRes, serialize(payment), 201);
      }
      const payment = await postPayment({
        folioId: folioId!,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        registerRef: data.registerRef,
        bankReference: data.bankReference,
        bankTerminalId: data.bankTerminalId,
        revenueCodeId: data.revenueCodeId,
        allowCredit: data.allowCredit === true,
        createdByUserId: session?.sub,
        auditRequest: request,
      });
      return sendJson(httpRes, serialize(payment), 201);
    }
    assertPermission(session, PERMISSIONS.FOLIO_CHARGE);
    const data = chargeSchema.parse(body);
    return sendJson(httpRes, 
      serialize(
        await postCharge({
          ...data,
          folioType: data.folioType,
          reservationGuestId: data.reservationGuestId,
          audit: { userId: session?.sub, request },
        }),
      ),
      201,
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
