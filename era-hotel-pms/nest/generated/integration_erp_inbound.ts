import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { applyE6FiscalStatusChanged } from '@/lib/services/fiscal-document.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const e6Schema = z.object({
  eventType: z.literal('invoice_fiscal_status_changed'),
  invoiceRef: z.string().min(1),
  fiscalStatus: z.string().min(1),
  fiscalExternalId: z.string().optional(),
  rejectionReason: z.string().optional(),
  updatedAt: z.string().optional(),
});

function verifyErpToken(request: Request): boolean {
  const expected = process.env.ERP_INBOUND_WEBHOOK_SECRET;
  if (!expected) return process.env.NODE_ENV !== 'production';
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7) === expected;
  const header = request.headers.get('x-erp-webhook-secret');
  return header === expected;
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integration/erp/inbound", async (httpReq, httpRes) => {
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

  
    if (!verifyErpToken(request)) {
      return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    }
    const body = e6Schema.parse(httpReq.body);
    const doc = await applyE6FiscalStatusChanged(body);
    return sendJson(httpRes, serialize({ applied: true, document: doc }));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
