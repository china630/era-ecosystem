import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { getSalesContract, updateSalesContract, getContractUtilization } from '@/lib/services/sales-contract.service';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  counterpartyType: z.enum(['AGENCY', 'CORPORATE']).optional(),
  agencyId: z.string().uuid().nullable().optional(),
  companyId: z.string().uuid().nullable().optional(),
  /** Legacy merge FK only — not a substitute for companyId. */
  companyGuestId: z.string().uuid().nullable().optional(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED']).optional(),
  ratePlanId: z.string().uuid().optional(),
  minStay: z.number().int().positive().nullable().optional(),
  cta: z.boolean().optional(),
  ctd: z.boolean().optional(),
  commissionPercent: z.number().min(0).max(100).nullable().optional(),
  commissionBasis: z.enum(['GROSS', 'NET']).optional(),
  depositRequired: z.boolean().optional(),
  depositAmount: z.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  externalRef: z.string().nullable().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/contracts/:id", async (httpReq, httpRes) => {
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

  
    assertMasterDataRead(session, PERMISSIONS.CONTRACTS_ADMIN);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const { id } = httpReq.params;
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (url.searchParams.get('utilization') === '1') {
      return sendJson(httpRes, serialize(await getContractUtilization(id)));
    }
    return sendJson(httpRes, serialize(await getSalesContract(id)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/admin/contracts/:id", async (httpReq, httpRes) => {
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
    const { id } = httpReq.params;
    const body = updateSchema.parse(httpReq.body);
    const updated = await updateSalesContract(id, body);
    return sendJson(httpRes, serialize(updated));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
