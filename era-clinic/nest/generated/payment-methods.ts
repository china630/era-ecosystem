import { NextResponse } from 'next/server';
import { listPaymentMethodsForSatellite, paymentMethodsSynced } from '@era/satellite-kit';
import { requireClinicPermission } from '@/lib/api-utils';
import { CLINIC_PERMISSION } from '@/lib/auth/clinic-permissions';
import { clinicDeskPaymentMethods } from '@/lib/org-payment-methods';
import { requestOrganizationId } from '@/lib/request-organization';
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/payment-methods", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_BILLING_READ);
    if (denied) return denied;

    const organizationId = requestOrganizationId();
    const locale = (request.headers.get('accept-language') ?? 'en').slice(0, 2);
    const loc = locale === 'az' || locale === 'ru' ? locale : 'en';
    if (paymentMethodsSynced(organizationId)) {
      const rows = listPaymentMethodsForSatellite({
        organizationId,
        satelliteKey: 'clinic',
      });
      return sendJson(httpRes, {
        synced: true,
        methods: rows.map((row) => ({
          code: row.code,
          label: loc === 'az' ? row.nameAz : loc === 'ru' ? row.nameRu : row.nameEn,
        })),
      });
    }
    return sendJson(httpRes, {
      synced: false,
      methods: clinicDeskPaymentMethods().map((code) => ({ code, label: code })),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
