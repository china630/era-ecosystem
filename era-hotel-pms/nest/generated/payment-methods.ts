import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { hotelDeskPaymentMethods, hotelGuestTenders } from '@/lib/org-payment-methods';
import { listPaymentMethodsForSatellite, paymentMethodsSynced } from '@era/satellite-kit';
import { requestOrganizationId } from '@/lib/request-organization';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/payment-methods", async (httpReq, httpRes) => {
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
    const guestOnly = new URL(request.url).searchParams.get('guest') === '1';
    const organizationId = requestOrganizationId();
    const locale = (request.headers.get('accept-language') ?? 'en').slice(0, 2);
    const loc = locale === 'az' || locale === 'ru' ? locale : 'en';

    if (paymentMethodsSynced(organizationId)) {
      const rows = listPaymentMethodsForSatellite({
        organizationId,
        satelliteKey: 'hotel',
      });
      const codes = guestOnly
        ? rows.filter(
            (r) =>
              r.code !== 'DEPOSIT' &&
              r.code !== 'CL_AGENCY' &&
              r.code !== 'CL_COMPANY' &&
              r.code !== 'COMPANY_ACCOUNT',
          )
        : rows;
      return sendJson(httpRes, {
        synced: true,
        methods: codes.map((row) => ({
          code: row.code,
          label: loc === 'az' ? row.nameAz : loc === 'ru' ? row.nameRu : row.nameEn,
          fiscalHint: row.fiscalHint,
          fiscalDeviceId: row.fiscalDeviceId,
        })),
      });
    }

    const codes = guestOnly ? hotelGuestTenders() : hotelDeskPaymentMethods();
    return sendJson(httpRes, {
      synced: false,
      methods: codes.map((code) => ({
        code,
        label: code,
        fiscalHint: code === 'CASH' ? 'CASH' : code === 'CARD' || code === 'EPOINT' ? 'CARD' : 'NONE',
        fiscalDeviceId: null,
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
