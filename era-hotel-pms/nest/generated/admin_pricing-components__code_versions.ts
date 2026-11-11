import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { addPricingComponentVersion, getPricingComponent } from '@/lib/services/pricing-components.service';
import { recordHotelAudit } from '@/lib/satellite-audit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  sellAmount: z.number().nonnegative().nullable().optional(),
  cogsAmount: z.number().nonnegative().nullable().optional(),
  effectiveFrom: z.string().min(8),
  note: z.string().max(500).nullable().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/pricing-components/:code/versions", async (httpReq, httpRes) => {
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

  
    assertMasterDataRead(session, PERMISSIONS.PRICING_ADMIN);
    const { code } = httpReq.params;
    return sendJson(httpRes, serialize(await getPricingComponent(code)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/pricing-components/:code/versions", async (httpReq, httpRes) => {
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

  
    assertMasterDataWrite(session, PERMISSIONS.PRICING_ADMIN);
    const { code } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    if (body.sellAmount == null && body.cogsAmount == null) {
      throw new Error('Provide sellAmount and/or cogsAmount');
    }
    if (!session) throw new Error('Unauthorized');
    const version = await addPricingComponentVersion({
      code,
      sellAmount: body.sellAmount,
      cogsAmount: body.cogsAmount,
      effectiveFrom: new Date(body.effectiveFrom),
      note: body.note,
      createdById: session.sub,
    });
    await recordHotelAudit(
      { userId: session.sub, request },
      'PricingComponent',
      code,
      'VERSION_CREATE',
      version as unknown as Record<string, unknown>,
    );
    return sendJson(httpRes, serialize(version), 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
