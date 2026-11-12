import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { listConciergeProducts, listConciergeOrders, bookConciergeOrder, completeConciergeOrder, createConciergeProduct } from '@/lib/services/concierge.service';
import { assertActiveHotelLookupCode } from '@/lib/services/master-data.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bookSchema = z.object({
  guestId: z.string().uuid(),
  productId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  scheduledAt: z.coerce.date().optional(),
  notes: z.string().optional(),
});

const createProductSchema = z.object({
  action: z.literal('createProduct'),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1),
  price: z.number().nonnegative(),
  supplierName: z.string().trim().max(200).optional(),
  commissionPct: z.number().min(0).max(100).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/concierge", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.CONCIERGE_READ);
    const guestId = new URL(request.url).searchParams.get('guestId') ?? undefined;
    const view = new URL(request.url).searchParams.get('view');
    if (view === 'orders') {
      return sendJson(httpRes, serialize(await listConciergeOrders(guestId)));
    }
    return sendJson(httpRes, serialize(await listConciergeProducts()));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/concierge", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.CONCIERGE_WRITE);
    const body = httpReq.body;
    if (body.action === 'complete') {
      return sendJson(httpRes, serialize(await completeConciergeOrder(body.orderId)));
    }
    if (body.action === 'createProduct') {
      const { action: _action, ...input } = createProductSchema.parse(body);
      await assertActiveHotelLookupCode('CONCIERGE_CATEGORY', input.category);
      return sendJson(httpRes, 
        serialize(
          await createConciergeProduct({
            ...input,
            code: input.code.toUpperCase(),
            supplierName: input.supplierName || undefined,
          }),
        ),
        201,
      );
    }
    return sendJson(httpRes, serialize(await bookConciergeOrder(bookSchema.parse(body))), 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
