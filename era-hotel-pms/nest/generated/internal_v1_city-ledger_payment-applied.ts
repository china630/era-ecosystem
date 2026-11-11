import { z } from 'zod';
import { applyCityLedgerPaymentFromFinance } from '@/lib/services/city-ledger-gate.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  folioId: z.string().min(1),
  invoiceId: z.string().min(1),
  paymentId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.literal('AZN'),
  fullyPaid: z.boolean(),
});

/**
 * Finance -> Hotel callback: apply allocated AR payment into hotel folio.
 * Idempotent by `paymentId` (stored into FolioPayment.registerRef).
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/internal/v1/city-ledger/payment-applied", async (httpReq, httpRes) => {
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

    const result = await applyCityLedgerPaymentFromFinance(body);
    if (result === null) {
      return sendJson(httpRes, { error: 'Folio not found' }, 404);
    }

    if (result.alreadyApplied) {
      return sendJson(httpRes, {
        id: result.id,
        paymentId: result.paymentId,
        folioId: result.folioId,
        balance: result.balance,
        status: result.status,
        alreadyApplied: true,
      });
    }

    return sendJson(httpRes, {
      id: result.id,
      paymentId: result.paymentId,
      folioId: result.folioId,
      balance: result.balance,
      status: result.status,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
