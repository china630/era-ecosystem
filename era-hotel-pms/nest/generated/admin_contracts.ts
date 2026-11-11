import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { createSalesContract, listSalesContracts } from '@/lib/services/sales-contract.service';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1),
  counterpartyType: z.enum(['AGENCY', 'CORPORATE']),
  agencyId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  companyGuestId: z.string().uuid().optional(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED']).optional(),
  ratePlanId: z.string().uuid(),
  minStay: z.number().int().positive().optional(),
  cta: z.boolean().optional(),
  ctd: z.boolean().optional(),
  commissionPercent: z.number().min(0).max(100).optional(),
  commissionBasis: z.enum(['GROSS', 'NET']).optional(),
  depositRequired: z.boolean().optional(),
  depositAmount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  externalRef: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/contracts", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertAnyPermission(session, [
      PERMISSIONS.CONTRACTS_ADMIN,
      PERMISSIONS.CONTRACTS_READ,
    ]);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const url = new URL(req.url);
    const status = url.searchParams.get('status') as
      | 'DRAFT'
      | 'ACTIVE'
      | 'EXPIRED'
      | 'CANCELLED'
      | null;
    const agencyId = url.searchParams.get('agencyId') ?? undefined;
    const companyId = url.searchParams.get('companyId') ?? undefined;
    return sendJson(httpRes, 
      serialize(
        await listSalesContracts({
          status: status ?? undefined,
          agencyId,
          companyId,
        }),
      ),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/contracts", async (httpReq, httpRes) => {
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

  
    assertMasterDataWrite(session, PERMISSIONS.CONTRACTS_ADMIN);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const body = createSchema.parse(httpReq.body);
    const created = await createSalesContract(body);
    return sendJson(httpRes, serialize(created), 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
