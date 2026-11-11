import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { ingestMinibarSensorEvent } from '@/lib/services/minibar-iot.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  roomNumber: z.string().min(1),
  sensorId: z.string().optional(),
  itemCode: z.string().min(1),
  deltaQty: z.number().int().optional(),
  raw: z.record(z.unknown()).optional(),
});

function verifyWebhook(request: Request): boolean {
  const secret = process.env.MINIBAR_IOT_WEBHOOK_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  return request.headers.get('x-minibar-secret') === secret;
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integrations/minibar-sensor", async (httpReq, httpRes) => {
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

  
    if (!verifyWebhook(request)) {
      return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    }
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await ingestMinibarSensorEvent(body)), 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
