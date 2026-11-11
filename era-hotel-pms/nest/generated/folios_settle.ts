import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { settleFolio, getFolioSettlementPreview } from '@/lib/services/folio-settlement.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const lineSchema = z.object({
  method: z.enum([
    'CASH',
    'CARD',
    'COMPANY_ACCOUNT',
    'LOYALTY_POINTS',
    'DEPOSIT',
    'BANK_TRANSFER',
  ]),
  amount: z.number().positive(),
  registerRef: z.string().optional(),
  bankReference: z.string().max(120).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
  loyaltyCustomerRef: z.string().optional(),
  authorizationId: z.string().uuid().optional(),
});

const settleSchema = z.object({
  folioId: z.string().uuid(),
  lines: z.array(lineSchema).min(1),
  discountAmount: z.number().positive().optional(),
  discountDescription: z.string().max(200).optional(),
  applyDeposits: z.boolean().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/folios/settle", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const folioId = new URL(request.url).searchParams.get('folioId');
    if (!folioId) throw new Error('folioId required');
    return sendJson(httpRes, serialize(await getFolioSettlementPreview(folioId)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/folios/settle", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const body = settleSchema.parse(httpReq.body);
    return sendJson(httpRes, 
      serialize(await settleFolio({ ...body, createdByUserId: session?.sub, auditRequest: request })),
      201,
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
