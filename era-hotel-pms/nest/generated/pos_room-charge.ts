import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { postRoomCharge } from '@/lib/services/pos.service';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterSatelliteTenant, satelliteRuntimeConfig } from '@era/satellite-kit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  organizationId: z.string().uuid().optional(),
  reservationId: z.string().uuid().optional(),
  roomNumber: z.string().optional(),
  revenueCode: z.string().min(1),
  amount: z.number().finite(),
  qty: z.number().int().refine((qty) => qty !== 0).optional(),
  description: z.string().min(1),
  outletCode: z.string().optional(),
  productSku: z.string().min(1).optional(),
  warehouseCode: z.string().min(1).optional(),
  externalTicketId: z.string().min(1).optional(),
  ticketNumber: z.string().optional(),
  sourceOrganizationId: z.string().min(1).optional(),
  posShiftId: z.string().uuid().optional(),
  waiterCode: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/pos/room-charge", async (httpReq, httpRes) => {
    try {
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

  
    await assertPosBridgeOrPermission(request, PERMISSIONS.FOLIO_CHARGE);
    const body = schema.parse(httpReq.body);
    if (!body.reservationId && !body.roomNumber) {
      throw new Error('reservationId or roomNumber required');
    }

    const orgFromHeader = request.headers.get('x-era-organization-id')?.trim();
    const organizationId = body.organizationId?.trim() || orgFromHeader || '';
    if (
      satelliteRuntimeConfig().deploymentTopology === 'SHARED' &&
      !organizationId
    ) {
      return sendJson(httpRes, 
        { error: 'organizationId required on SHARED pool' }, 400);
    }
    if (organizationId) {
      enterSatelliteTenant({ organizationId });
    }

    const headerKey = request.headers.get('idempotency-key')?.trim();
    const idempotencyKey = headerKey || body.externalTicketId;

    const result = await postRoomCharge({
      reservationId: body.reservationId,
      roomNumber: body.roomNumber,
      revenueCode: body.revenueCode,
      amount: body.amount,
      qty: body.qty,
      description: body.description,
      outletCode: body.outletCode,
      productSku: body.productSku,
      warehouseCode: body.warehouseCode,
      sourceOrganizationId: body.sourceOrganizationId,
      idempotencyKey,
    });

    const charge = result.charge;
    return sendJson(httpRes, 
      serialize({
        ...charge,
        reservationId: result.reservationId,
        idempotent: result.idempotent,
      }),
      result.idempotent ? 200 : 201,
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
