import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { parseHotelNoon } from '@/lib/hotel-calendar';
import { getSellablePreview } from '@/lib/services/room-type-availability.service';
import { getAvailabilityWithContractAllotment } from '@/lib/services/contract-allotment.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/fo/sellable", async (httpReq, httpRes) => {
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
    const url = new URL(request.url);
    const roomTypeId = url.searchParams.get('roomTypeId');
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    const salesContractId = url.searchParams.get('salesContractId')?.trim() || null;
    if (!roomTypeId || !fromStr || !toStr) {
      throw new Error('roomTypeId, from, and to query params required');
    }
    const from = parseHotelNoon(fromStr);
    const to = parseHotelNoon(toStr);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new Error('Invalid from/to date');
    }

    if (salesContractId) {
      const data = await getAvailabilityWithContractAllotment(
        roomTypeId,
        from,
        to,
        salesContractId,
      );
      const bottleneck = data.nights.find((n) => n.available === data.available) ?? data.nights[0];
      return sendJson(httpRes, 
        serialize({
          roomTypeId,
          from: fromStr.slice(0, 10),
          to: toStr.slice(0, 10),
          salesContractId,
          contractScoped: true,
          available: data.available,
          booked: bottleneck?.contractBooked ?? 0,
          quota: data.quota,
          contractAllotment: bottleneck?.contractAllotment ?? 0,
          reason: bottleneck && 'reason' in bottleneck ? bottleneck.reason ?? null : null,
          stopSell: false,
          nights: data.nights,
        }),
      );
    }

    const data = await getSellablePreview(roomTypeId, from, to);
    return sendJson(httpRes, 
      serialize({
        roomTypeId,
        from: fromStr.slice(0, 10),
        to: toStr.slice(0, 10),
        contractScoped: false,
        ...data,
      }),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
