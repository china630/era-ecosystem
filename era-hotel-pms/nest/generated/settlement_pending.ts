import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createPendingCharge } from '@/lib/services/settlement-hub.service';
import { enterSatelliteTenant, satelliteRuntimeConfig } from '@era/satellite-kit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z
  .object({
    sourceSystem: z.enum(['FNB_POS', 'CLINIC', 'RETAIL']),
    sourceOrgId: z.string().min(1),
    hotelOrganizationId: z.string().uuid().optional(),
    sourceRef: z.string().min(1),
    amount: z.number().finite(),
    sku: z.string().min(1).optional(),
    qty: z.number().int().refine((qty) => qty !== 0).optional(),
    revenueCode: z.string().min(1).max(32).optional(),
    currency: z.string().default('AZN'),
    description: z.string().min(1),
    payerLabel: z.string().optional(),
    globalPersonId: z.string().optional(),
    reservationId: z.string().uuid().optional(),
    basketRef: z.string().min(1).max(64).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.amount !== 0 && !body.revenueCode?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['revenueCode'],
        message: 'revenueCode is required when amount is not zero',
      });
    }
  });

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/settlement/pending", async (httpReq, httpRes) => {
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

  
    await assertPosBridgeOrPermission(request, PERMISSIONS.FOLIO_PAYMENT);
    const body = schema.parse(httpReq.body);
    const orgFromHeader = request.headers.get('x-era-organization-id')?.trim();
    const hotelOrganizationId = body.hotelOrganizationId?.trim() || orgFromHeader || '';
    if (satelliteRuntimeConfig().deploymentTopology === 'SHARED' && !hotelOrganizationId) {
      return sendJson(httpRes, 
        { error: 'hotelOrganizationId required on SHARED pool' }, 400);
    }
    if (hotelOrganizationId) {
      enterSatelliteTenant({ organizationId: hotelOrganizationId });
    }
    const headerKey = request.headers.get('idempotency-key')?.trim();
    const idempotencyKey =
      headerKey || `${body.sourceSystem.toLowerCase()}-${body.sourceRef}`;
    const { hotelOrganizationId: _hotelOrganizationId, ...charge } = body;

    const result = await createPendingCharge({
      ...charge,
      idempotencyKey,
    });

    return sendJson(httpRes, 
      serialize({
        ...result.charge,
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
  http.get("/api/settlement/pending", async (httpReq, httpRes) => {
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

  
    await assertPosBridgeOrPermission(request, PERMISSIONS.FOLIO_PAYMENT);
    const url = new URL(request.url);
    const status = (url.searchParams.get('status') ?? 'PENDING') as
      | 'PENDING'
      | 'PAID'
      | 'VOID';
    const { listPendingCharges } = await import('@/lib/services/settlement-hub.service');
    const rows = await listPendingCharges(status);
    return sendJson(httpRes, serialize(rows));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
