import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertAnyPermission, assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createLaundryTicket, deliverLaundryTicket, listLaundryWorkspace } from '@/lib/services/hk-nafta.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

function laundryReadWritePerms() {
  return [PERMISSIONS.HOUSEKEEPING_MANAGE, PERMISSIONS.FOLIO_CHARGE] as const;
}



const createTicket = z.object({
  roomId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  guestName: z.string().optional(),
  express: z.boolean().optional(),
  intakeNote: z.string().optional(),
  lines: z.array(
    z.object({
      itemId: z.string().uuid(),
      washQty: z.number().int().min(0),
      ironQty: z.number().int().min(0),
      guestQty: z.number().int().min(0).optional(),
      hotelQty: z.number().int().min(0).optional(),
    }),
  ),
});

const deliverBody = z.object({
  deliverTicketId: z.string().uuid(),
  returnScanKey: z.string().min(1),
  actorRole: z.enum(['HK', 'FO']).optional(),
});

const voidBody = z.object({
  voidTicketId: z.string().uuid(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/housekeeping/laundry", async (httpReq, httpRes) => {
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

  
    assertAnyPermission(session, [...laundryReadWritePerms()]);
    const reservationId = new URL(request.url).searchParams.get('reservationId');
    const board = await listLaundryWorkspace(reservationId);
    return sendJson(httpRes, serialize(board));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/housekeeping/laundry", async (httpReq, httpRes) => {
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
    if (body.voidTicketId) {
      assertAnyPermission(session, [...laundryReadWritePerms()]);
      const data = voidBody.parse(body);
      const { voidOpenLaundryTicket } = await import('@/lib/services/hk-nafta.service');
      return sendJson(httpRes, serialize(await voidOpenLaundryTicket(data.voidTicketId)));
    }
    if (body.deliverTicketId) {
      assertAnyPermission(session, [...laundryReadWritePerms()]);
      const data = deliverBody.parse(body);
      const { sessionHasHotelPermission } = await import('@/lib/auth/permission-check');
      const hk =
        session &&
        sessionHasHotelPermission(
          {
            login: session.login,
            email: session.email,
            role: session.role,
            permissions: session.permissions,
            isOwner: session.isOwner,
          },
          PERMISSIONS.HOUSEKEEPING_MANAGE,
        );
      const role: 'HK' | 'FO' = data.actorRole ?? (hk ? 'HK' : 'FO');
      return sendJson(httpRes, 
        serialize(
          await deliverLaundryTicket({
            ticketId: data.deliverTicketId,
            actorUserId: session!.sub,
            actorRole: role,
            returnScanKey: data.returnScanKey,
          }),
        ),
      );
    }
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const data = createTicket.parse(body);
    const ticket = await createLaundryTicket({
      roomId: data.roomId,
      reservationId: data.reservationId,
      guestName: data.guestName,
      express: data.express,
      now: new Date(),
      lines: data.lines,
    });
    return sendJson(httpRes, serialize(ticket));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
