import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { createTransferOrder, listTransferOrders, listVehicles } from '@/lib/services/transfer.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  reservationId: z.string().uuid(),
  direction: z.enum(['IN', 'OUT']),
  flightNo: z.string().optional(),
  pickupAt: z.string().datetime(),
  vehicleId: z.string().uuid().optional(),
  price: z.number().nonnegative(),
  notes: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/transfers", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertPermission(session, PERMISSIONS.TRANSFERS_WRITE);

    const url = new URL(req.url);
    const reservationId = url.searchParams.get('reservationId') ?? undefined;
    const guestId = url.searchParams.get('guestId') ?? undefined;
    const status = url.searchParams.get('status') ?? undefined;
    const direction = url.searchParams.get('direction') ?? undefined;
    const hasFlight = url.searchParams.get('hasFlight');
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');

    const [orders, vehicles] = await Promise.all([
      listTransferOrders({
        reservationId,
        guestId,
        status,
        direction,
        hasFlight: hasFlight === '1' || hasFlight === 'true',
        from: fromStr ? new Date(fromStr) : undefined,
        to: toStr ? new Date(toStr) : undefined,
      }),
      listVehicles(),
    ]);

    return sendJson(httpRes, serialize({ orders, vehicles }));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/transfers", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertPermission(session, PERMISSIONS.TRANSFERS_WRITE);
    const body = bodySchema.parse(httpReq.body);
    const created = await createTransferOrder({
      ...body,
      pickupAt: new Date(body.pickupAt),
    });
    return sendJson(httpRes, serialize(created));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
