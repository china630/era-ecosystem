import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { reservationPaymentMethodSchema } from '@/lib/reservation-full-patch.schema';
import { addStayToBooking, listBookingStays, updateBookingEnvelope } from '@/lib/services/booking-stays.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().nullable().optional(),
  agencyId: z.string().uuid().nullable().optional(),
  folioMode: z.enum(['INDIVIDUAL', 'MASTER', 'SPLIT']).optional(),
  allotmentBlockId: z.string().uuid().nullable().optional(),
  checkInDate: z.coerce.date().nullable().optional(),
  checkOutDate: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const addStaySchema = z.object({
  roomTypeId: z.string().uuid(),
  guestId: z.string().uuid(),
  ratePlanId: z.string().uuid(),
  mealPlanId: z.string().uuid().optional(),
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
  paymentMethod: reservationPaymentMethodSchema,
  agencyId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  salesContractId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  adults: z.number().int().positive().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reservation-groups/:id", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await listBookingStays(id)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/reservation-groups/:id", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await updateBookingEnvelope(id, body)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/reservation-groups/:id", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = httpReq.params;
    const body = addStaySchema.parse(httpReq.body);
    const stay = await addStayToBooking({
      groupId: id,
      ...body,
      paymentMethod: body.paymentMethod ?? null,
      audit: { userId: session?.sub, request },
    });
    return sendJson(httpRes, serialize(stay), 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
