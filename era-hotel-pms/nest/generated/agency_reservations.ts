import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { requireAgencyPortalSession } from '@/lib/auth/agency-session';
import { agencyQuoteAvailability, createAgencyPortalReservation, listAgencyContracts, listAgencyOwnReservations } from '@/lib/services/agency-portal.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const quoteSchema = z.object({
  salesContractId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  checkInDate: z.string().min(8),
  checkOutDate: z.string().min(8),
});

const createSchema = quoteSchema.extend({
  guestFullName: z.string().min(2),
  guestPhone: z.string().optional(),
  guestEmail: z.string().email().optional(),
  guestNationality: z.string().optional(),
  adults: z.number().int().min(1).optional(),
  externalRef: z.string().min(1).max(64).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/agency/reservations", async (httpReq, httpRes) => {
    try {
    if (rejectMissingAgency(httpReq, httpRes)) return;
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

  
    const session = await requireAgencyPortalSession();
    const [contracts, reservations] = await Promise.all([
      listAgencyContracts(session.agencyId),
      listAgencyOwnReservations(session.agencyId),
    ]);
    return sendJson(httpRes, 
      serialize({
        agencyId: session.agencyId,
        agencyCode: session.agencyCode,
        email: session.email,
        contracts,
        reservations,
      }),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/agency/reservations", async (httpReq, httpRes) => {
    try {
    if (rejectMissingAgency(httpReq, httpRes)) return;
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

  
    const session = await requireAgencyPortalSession();
    const url = new URL(request.url);
    const action = url.searchParams.get('action') ?? 'create';
    const body = httpReq.body;

    if (action === 'quote') {
      const input = quoteSchema.parse(body);
      const result = await agencyQuoteAvailability({
        agencyId: session.agencyId,
        salesContractId: input.salesContractId,
        roomTypeId: input.roomTypeId,
        checkInDate: new Date(input.checkInDate),
        checkOutDate: new Date(input.checkOutDate),
      });
      return sendJson(httpRes, serialize(result));
    }

    const input = createSchema.parse(body);
    // Force agencyId from session — never trust client agencyId
    const reservation = await createAgencyPortalReservation({
      agencyId: session.agencyId,
      salesContractId: input.salesContractId,
      roomTypeId: input.roomTypeId,
      checkInDate: new Date(input.checkInDate),
      checkOutDate: new Date(input.checkOutDate),
      guest: {
        fullName: input.guestFullName,
        phone: input.guestPhone,
        email: input.guestEmail,
        nationality: input.guestNationality,
      },
      adults: input.adults,
      bookerEmail: session.email,
      externalRef: input.externalRef,
      audit: { userId: session.sub, request },
    });
    return sendJson(httpRes, serialize(reservation), 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
