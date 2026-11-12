import { z } from 'zod';
import { applyFiscalGlPostedStatus } from '@/lib/services/hotel-integration-status.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  fiscalDocumentId: z.string().uuid().optional(),
  invoiceNumber: z.string().optional(),
  glReference: z.string().min(1),
  glPostedAt: z.coerce.date().optional(),
});

/** Finance / 1C adapter callback — read-only GL posted status on fiscal document. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integration/gl-status", async (httpReq, httpRes) => {
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

  
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
    const auth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (token && auth !== token) {
      return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    }

    const body = bodySchema.parse(httpReq.body);
    const updated = await applyFiscalGlPostedStatus(body);

    if (!updated) {
      return sendJson(httpRes, { error: 'Fiscal document not found' }, 404);
    }

    return sendJson(httpRes, {
      id: updated.id,
      glPostedAt: updated.glPostedAt?.toISOString(),
      glReference: updated.glReference,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
