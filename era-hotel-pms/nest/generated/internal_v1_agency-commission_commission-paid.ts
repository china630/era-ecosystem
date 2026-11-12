import { z } from 'zod';
import { applyCommissionPaid, findAgencyCommissionBatchById } from '@/lib/services/agency-commission.service';
import { enterRequestTenant } from '@/lib/request-organization';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  batchId: z.string().min(1).optional(),
  lineIds: z.array(z.string().min(1)).optional(),
  financePayableId: z.string().min(1),
  paymentId: z.string().min(1),
  currency: z.literal('AZN').optional(),
});

/**
 * Finance → Hotel: mark commission batch/lines PAID after AP bank payment.
 * Idempotent by financePayableId on batch when already PAID.
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/internal/v1/agency-commission/commission-paid", async (httpReq, httpRes) => {
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
    enterRequestTenant(body.organizationId);

    if (body.batchId) {
      const batch = await findAgencyCommissionBatchById(body.batchId);
      if (!batch) {
        return sendJson(httpRes, { error: 'Batch not found' }, 404);
      }
      if (batch.status === 'PAID' && batch.financePayableId === body.financePayableId) {
        return sendJson(httpRes, { alreadyApplied: true, batchId: batch.id, paymentId: body.paymentId });
      }
    }

    const result = await applyCommissionPaid({
      batchId: body.batchId,
      lineIds: body.lineIds,
      financePayableId: body.financePayableId,
      paymentRef: body.paymentId,
    });
    return sendJson(httpRes, { ...result, alreadyApplied: false });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
