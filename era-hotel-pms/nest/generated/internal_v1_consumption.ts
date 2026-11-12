import { z } from 'zod';
import { enterRequestTenant } from '@/lib/request-organization';
import { assertEnvServiceToken } from '@era/satellite-kit';
import { recordInternalConsumption } from '@/lib/services/internal-consumption.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  organizationId: z.string().min(1),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sku: z.string().min(1),
  qty: z.number().finite(),
  warehouseCode: z.string().optional(),
  source: z.string().min(1).default('clinic'),
  sourceRef: z.string().min(1),
});

function unauthorized(message: string) {
  return Response.json({ error: message }, { status: 401 });
}

/** Clinic consumables for the night-audit quantity lines. Bearer SATELLITE_EVENT_SERVICE_TOKEN. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/internal/v1/consumption", async (httpReq, httpRes) => {
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

  try {
    const gate = assertEnvServiceToken({
      expectedEnvKeys: ['SATELLITE_EVENT_SERVICE_TOKEN'],
      authorization: request.headers.get('authorization'),
      xServiceToken: request.headers.get('x-service-token'),
    });
    if (!gate.ok) return unauthorized(gate.error);
    const body = bodySchema.parse(httpReq.body);
    enterRequestTenant(body.organizationId);
    const row = await recordInternalConsumption(body);
    return sendJson(httpRes, { id: row.id, sourceRef: row.sourceRef });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Consumption failed';
    return sendJson(httpRes, { error: message }, 400);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
