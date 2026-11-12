import { NextResponse } from 'next/server';
import { listPaymentMethodsForSatellite, paymentMethodsSynced } from '@era/satellite-kit';
import { fnbDeskPaymentMethods } from '@/lib/org-payment-methods';
import { requestOrganizationId } from '@/lib/request-organization';
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/payment-methods", async (httpReq, httpRes) => {
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

  const organizationId = requestOrganizationId();
  const locale = (request.headers.get('accept-language') ?? 'en').slice(0, 2);
  const loc = locale === 'az' || locale === 'ru' ? locale : 'en';
  if (paymentMethodsSynced(organizationId)) {
    const rows = listPaymentMethodsForSatellite({
      organizationId,
      satelliteKey: 'fnb',
    });
    return sendJson(httpRes, {
      synced: true,
      methods: rows.map((row) => ({
        code: row.code,
        label: loc === 'az' ? row.nameAz : loc === 'ru' ? row.nameRu : row.nameEn,
        fiscalHint: row.fiscalHint,
      })),
    });
  }
  return sendJson(httpRes, {
    synced: false,
    methods: fnbDeskPaymentMethods().map((code) => ({
      code,
      label: code,
      fiscalHint: code === 'CASH' ? 'CASH' : code === 'CARD' ? 'CARD' : 'NONE',
    })),
  });

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
