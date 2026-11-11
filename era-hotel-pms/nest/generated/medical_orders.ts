import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { addLabResult, createOrder, postProcedureToFolio } from '@/lib/services/medical.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const orderSchema = z.object({
  reservationId: z.string().uuid(),
  orderType: z.string().min(1),
});

const labSchema = z.object({
  orderId: z.string().uuid(),
  testName: z.string(),
  resultValue: z.string(),
  flag: z.enum(['NORMAL', 'HIGH', 'LOW']).optional(),
});

const procSchema = z.object({
  reservationId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  amount: z.number().positive(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/medical/orders", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.MEDICAL_MANAGE);
    const body = httpReq.body;
    if (body.orderId && body.testName) {
      return sendJson(httpRes, serialize(await addLabResult(body.orderId, labSchema.parse(body))), 201);
    }
    if (body.code && body.name && body.amount) {
      return sendJson(httpRes, serialize(await postProcedureToFolio(body.reservationId, procSchema.parse(body))), 201);
    }
    const data = orderSchema.parse(body);
    return sendJson(httpRes, serialize(await createOrder(data.reservationId, data.orderType)), 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
